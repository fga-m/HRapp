import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { primaryRoleFor } from "@/lib/access";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Directory listing: return only non-sensitive columns. Never expose
  // google_access_token / google_refresh_token / birthdate / xero_employee_id.
  const { data, error } = await supabaseAdmin
    .from("staff")
    .select("id, full_name, email, role, position, department, avatar_url, is_active, google_calendar_id")
    .order("full_name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check caller is admin
  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("role")
    .eq("email", session.user?.email)
    .single();

  if (caller?.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const body = await req.json();
  const {
    full_name, email, role, roles, position, department, google_calendar_id, contracted_hours, birthdate,
    // Canonical provisioning fields (source of truth for Google / Xero / contracts)
    first_name, last_name, recovery_email, mobile_phone, start_date,
    address_line1, address_line2, suburb, state, postcode, country,
  } = body;

  // A staff member can hold several roles. Keep `role` as the primary (= admin
  // if they're an admin, else the first) for backward compatibility.
  const roleList: string[] =
    Array.isArray(roles) && roles.length > 0 ? roles : role ? [role] : ["staff"];

  // Derive a full_name from first/last if not supplied directly.
  const derivedFullName =
    full_name || [first_name, last_name].filter(Boolean).join(" ").trim() || "";

  if (!derivedFullName || !email) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }

  if (!email.endsWith("@fgam.org.au")) {
    return NextResponse.json({ error: "Email must be an @fgam.org.au address" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.from("staff").insert({
    full_name: derivedFullName,
    email,
    role: primaryRoleFor(roleList),
    roles: roleList,
    position: position || null,
    department: department || null,
    google_calendar_id: google_calendar_id || email,
    ...(contracted_hours !== undefined && contracted_hours !== "" && { contracted_hours: Number(contracted_hours) }),
    ...(birthdate ? { birthdate } : {}),
    ...(first_name ? { first_name } : {}),
    ...(last_name ? { last_name } : {}),
    ...(recovery_email ? { recovery_email } : {}),
    ...(mobile_phone ? { mobile_phone } : {}),
    ...(start_date ? { start_date } : {}),
    ...(address_line1 ? { address_line1 } : {}),
    ...(address_line2 ? { address_line2 } : {}),
    ...(suburb ? { suburb } : {}),
    ...(state ? { state } : {}),
    ...(postcode ? { postcode } : {}),
    ...(country ? { country } : {}),
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
