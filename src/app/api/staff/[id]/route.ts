import { NextRequest, NextResponse } from "next/server";
import { getCaller, callerCan } from "@/lib/caller";
import { supabaseAdmin } from "@/lib/supabase";
import { primaryRoleFor } from "@/lib/access";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const hasManageStaff = callerCan(caller, "manage_staff");

  // Access check: admin, manager with manage_staff, or own profile.
  if (!caller.isAdmin && !hasManageStaff && caller.id !== id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Explicit column whitelist — never return the stored Google OAuth secrets
  // (google_access_token / google_refresh_token / google_token_expires_at).
  const { data, error } = await supabaseAdmin
    .from("staff")
    .select(
      "id, full_name, first_name, last_name, email, recovery_email, mobile_phone, role, roles, position, department, avatar_url, is_active, google_calendar_id, contracted_hours, xero_employee_id, google_account_created_at, birthdate, start_date, address_line1, address_line2, suburb, state, postcode, country, created_at, updated_at"
    )
    .eq("id", id)
    .single();
  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!caller.isAdmin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const {
    full_name, role, roles, position, department, google_calendar_id, is_active, contracted_hours,
    xero_employee_id, birthdate,
    first_name, last_name, recovery_email, mobile_phone, start_date,
    address_line1, address_line2, suburb, state, postcode, country,
  } = body;

  // If first/last name change but full_name wasn't sent, keep full_name in sync.
  let fullNamePatch = full_name;
  if (fullNamePatch === undefined && (first_name !== undefined || last_name !== undefined)) {
    const { data: cur } = await supabaseAdmin
      .from("staff").select("first_name, last_name").eq("id", id).single();
    const newFirst = first_name ?? cur?.first_name ?? "";
    const newLast = last_name ?? cur?.last_name ?? "";
    const combined = `${newFirst} ${newLast}`.trim();
    if (combined) fullNamePatch = combined;
  }

  const { data, error } = await supabaseAdmin
    .from("staff")
    .update({
      ...(fullNamePatch !== undefined && { full_name: fullNamePatch }),
      // Roles: when an array is sent, store it and keep `role` as the primary.
      ...(Array.isArray(roles)
        ? { roles, role: primaryRoleFor(roles) }
        : role !== undefined
          ? { role }
          : {}),
      ...(position !== undefined && { position }),
      ...(department !== undefined && { department }),
      ...(google_calendar_id !== undefined && { google_calendar_id }),
      ...(is_active !== undefined && { is_active }),
      ...(contracted_hours !== undefined && { contracted_hours: Number(contracted_hours) }),
      ...(xero_employee_id !== undefined && { xero_employee_id: xero_employee_id || null }),
      ...(birthdate !== undefined && { birthdate: birthdate || null }),
      ...(first_name !== undefined && { first_name: first_name || null }),
      ...(last_name !== undefined && { last_name: last_name || null }),
      ...(recovery_email !== undefined && { recovery_email: recovery_email || null }),
      ...(mobile_phone !== undefined && { mobile_phone: mobile_phone || null }),
      ...(start_date !== undefined && { start_date: start_date || null }),
      ...(address_line1 !== undefined && { address_line1: address_line1 || null }),
      ...(address_line2 !== undefined && { address_line2: address_line2 || null }),
      ...(suburb !== undefined && { suburb: suburb || null }),
      ...(state !== undefined && { state: state || null }),
      ...(postcode !== undefined && { postcode: postcode || null }),
      ...(country !== undefined && { country: country || null }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
