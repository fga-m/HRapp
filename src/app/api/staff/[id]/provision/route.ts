import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import {
  getWorkspaceConnection,
  getValidWorkspaceToken,
  getWorkspaceUser,
  createWorkspaceUser,
  generateTempPassword,
} from "@/lib/google-workspace";
import { getValidXeroToken, findOrCreatePayrollEmployee } from "@/lib/xero";

export const dynamic = "force-dynamic";

// Canonical staff columns this feature reads/writes.
const STAFF_COLUMNS =
  "id, full_name, first_name, last_name, email, recovery_email, mobile_phone, " +
  "position, department, birthdate, start_date, address_line1, address_line2, " +
  "suburb, state, postcode, country, xero_employee_id, google_account_created_at";

type StaffRow = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
  recovery_email: string | null;
  mobile_phone: string | null;
  position: string | null;
  department: string | null;
  birthdate: string | null;
  start_date: string | null;
  address_line1: string | null;
  address_line2: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  country: string | null;
  xero_employee_id: string | null;
  google_account_created_at: string | null;
};

/** Derive given/family names, falling back to splitting full_name. */
function resolveNames(s: StaffRow): { firstName: string; lastName: string } {
  let firstName = (s.first_name ?? "").trim();
  let lastName = (s.last_name ?? "").trim();
  if (!firstName || !lastName) {
    const parts = (s.full_name ?? "").trim().split(/\s+/);
    if (!firstName) firstName = parts[0] ?? "";
    if (!lastName) lastName = parts.slice(1).join(" ");
  }
  return { firstName, lastName };
}

/** Which required fields are still missing for each service. */
function missingFields(s: StaffRow) {
  const { firstName, lastName } = resolveNames(s);
  const google: string[] = [];
  if (!firstName) google.push("first_name");
  if (!lastName) google.push("last_name");
  if (!s.email) google.push("email");

  const xero: string[] = [];
  if (!firstName) xero.push("first_name");
  if (!lastName) xero.push("last_name");
  if (!s.birthdate) xero.push("birthdate");
  if (!s.address_line1) xero.push("address_line1");
  if (!s.suburb) xero.push("suburb");
  if (!s.state) xero.push("state");
  if (!s.postcode) xero.push("postcode");

  return { google, xero };
}

async function requireAdmin(email: string) {
  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", email)
    .single();
  return caller?.role === "admin" ? caller : null;
}

async function loadStaff(id: string): Promise<StaffRow | null> {
  const { data } = await supabaseAdmin.from("staff").select(STAFF_COLUMNS).eq("id", id).single();
  return (data as StaffRow | null) ?? null;
}

// GET — provisioning status, connection availability, and missing fields.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const caller = await requireAdmin(session.user?.email ?? "");
  if (!caller) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const { id } = await params;
  const staff = await loadStaff(id);
  if (!staff) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const gws = await getWorkspaceConnection();
  // Cheap Xero connection presence check (no API call).
  const { data: xeroConn } = await supabaseAdmin
    .from("xero_connection")
    .select("tenant_id")
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const missing = missingFields(staff);
  const { firstName, lastName } = resolveNames(staff);

  return NextResponse.json({
    googleConnected: !!gws,
    googleConnectedEmail: gws?.connected_email ?? null,
    xeroConnected: !!xeroConn,
    google: {
      provisioned: !!staff.google_account_created_at,
      provisionedAt: staff.google_account_created_at,
      missing: missing.google,
    },
    xero: {
      provisioned: !!staff.xero_employee_id,
      employeeId: staff.xero_employee_id,
      missing: missing.xero,
    },
    staff: {
      id: staff.id,
      firstName,
      lastName,
      email: staff.email,
      recovery_email: staff.recovery_email,
      mobile_phone: staff.mobile_phone,
      position: staff.position,
      department: staff.department,
      birthdate: staff.birthdate,
      start_date: staff.start_date,
      address_line1: staff.address_line1,
      address_line2: staff.address_line2,
      suburb: staff.suburb,
      state: staff.state,
      postcode: staff.postcode,
      country: staff.country ?? "AU",
    },
  });
}

type ServiceResult = {
  service: "google" | "xero";
  status: "success" | "skipped" | "error";
  detail: string;
  externalId?: string;
  tempPassword?: string; // Google only, returned ONCE
};

// Editable canonical fields the panel/form may send to persist before provisioning.
const EDITABLE_FIELDS = [
  "first_name",
  "last_name",
  "recovery_email",
  "mobile_phone",
  "birthdate",
  "start_date",
  "address_line1",
  "address_line2",
  "suburb",
  "state",
  "postcode",
  "country",
] as const;

// POST — run provisioning for the selected services. Body:
//   { services: { google?: boolean, xero?: boolean }, fields?: {<canonical fields>} }
// Each service runs independently; one failing never blocks the other.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const caller = await requireAdmin(session.user?.email ?? "");
  if (!caller) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const services = body?.services ?? {};
  const wantGoogle = !!services.google;
  const wantXero = !!services.xero;

  if (!wantGoogle && !wantXero) {
    return NextResponse.json({ error: "Select at least one service to provision." }, { status: 400 });
  }

  // Persist any supplied field edits first so the staff record stays the single
  // source of truth (everything is provisioned FROM it).
  if (body?.fields && typeof body.fields === "object") {
    const patch: Record<string, unknown> = {};
    for (const key of EDITABLE_FIELDS) {
      if (key in body.fields) {
        const v = body.fields[key];
        patch[key] = v === "" ? null : v;
      }
    }
    if (Object.keys(patch).length > 0) {
      patch.updated_at = new Date().toISOString();
      // Keep full_name in sync when names are edited.
      if (patch.first_name || patch.last_name) {
        const fn = (patch.first_name as string | undefined) ?? undefined;
        const ln = (patch.last_name as string | undefined) ?? undefined;
        const { data: cur } = await supabaseAdmin
          .from("staff")
          .select("first_name, last_name")
          .eq("id", id)
          .single();
        const newFirst = fn ?? cur?.first_name ?? "";
        const newLast = ln ?? cur?.last_name ?? "";
        const full = `${newFirst} ${newLast}`.trim();
        if (full) patch.full_name = full;
      }
      await supabaseAdmin.from("staff").update(patch).eq("id", id);
    }
  }

  const staff = await loadStaff(id);
  if (!staff) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { firstName, lastName } = resolveNames(staff);
  const missing = missingFields(staff);
  const results: ServiceResult[] = [];
  const staffUpdate: Record<string, unknown> = {};

  const log = (r: ServiceResult) =>
    supabaseAdmin.from("staff_provisioning_log").insert({
      staff_id: id,
      service: r.service,
      status: r.status,
      detail: r.detail,
      external_id: r.externalId ?? null,
      created_by: caller.id,
    });

  // ── Google Workspace account ────────────────────────────────────────────
  if (wantGoogle) {
    const r: ServiceResult = { service: "google", status: "error", detail: "" };
    try {
      if (missing.google.length) {
        throw new Error(`Missing required field(s): ${missing.google.join(", ")}`);
      }
      const token = await getValidWorkspaceToken(); // throws if not connected
      const existing = await getWorkspaceUser(token, staff.email);
      if (existing) {
        r.status = "skipped";
        r.detail = "A Google account already exists for this email — linked, not recreated.";
        r.externalId = existing.primaryEmail;
        staffUpdate.google_account_created_at =
          staff.google_account_created_at ?? new Date().toISOString();
      } else {
        const tempPassword = generateTempPassword();
        const created = await createWorkspaceUser({
          accessToken: token,
          primaryEmail: staff.email,
          givenName: firstName,
          familyName: lastName,
          password: tempPassword,
          recoveryEmail: staff.recovery_email,
          recoveryPhone: staff.mobile_phone, // best effort; ignored by Google if not E.164
          title: staff.position,
          department: staff.department,
          changePasswordAtNextLogin: true,
        });
        r.status = "success";
        r.detail = `Created ${created.primaryEmail}. Temporary password shown once below.`;
        r.externalId = created.primaryEmail;
        r.tempPassword = tempPassword;
        staffUpdate.google_account_created_at = new Date().toISOString();
      }
    } catch (err) {
      r.status = "error";
      r.detail = err instanceof Error ? err.message : "Unknown error creating Google account.";
    }
    results.push(r);
    await log({ ...r, tempPassword: undefined }); // never persist the password
  }

  // ── Xero payroll employee ────────────────────────────────────────────────
  if (wantXero) {
    const r: ServiceResult = { service: "xero", status: "error", detail: "" };
    try {
      if (missing.xero.length) {
        throw new Error(`Missing required field(s): ${missing.xero.join(", ")}`);
      }
      await getValidXeroToken(); // throws "Xero not connected" if no connection
      const { employeeId, created } = await findOrCreatePayrollEmployee({
        firstName,
        lastName,
        dateOfBirth: staff.birthdate!,
        email: staff.email,
        mobile: staff.mobile_phone,
        startDate: staff.start_date,
        title: staff.position,
        homeAddress: {
          addressLine1: staff.address_line1!,
          addressLine2: staff.address_line2,
          city: staff.suburb!,
          region: staff.state!,
          postalCode: staff.postcode!,
          country: staff.country ?? "AU",
        },
      });
      r.status = created ? "success" : "skipped";
      r.detail = created
        ? "Created Xero payroll employee."
        : "A matching Xero employee already exists — linked, not recreated.";
      r.externalId = employeeId;
      staffUpdate.xero_employee_id = employeeId;
    } catch (err) {
      r.status = "error";
      r.detail = err instanceof Error ? err.message : "Unknown error creating Xero employee.";
    }
    results.push(r);
    await log(r);
  }

  if (Object.keys(staffUpdate).length > 0) {
    staffUpdate.updated_at = new Date().toISOString();
    await supabaseAdmin.from("staff").update(staffUpdate).eq("id", id);
  }

  return NextResponse.json({ results });
}
