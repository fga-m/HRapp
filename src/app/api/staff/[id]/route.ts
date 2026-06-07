import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

async function getCallerAndPermission(email: string) {
  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", email)
    .single();

  if (!caller) return { caller: null, hasManageStaff: false };

  let hasManageStaff = caller.role === "admin";
  if (caller.role === "manager") {
    const { data: perm } = await supabaseAdmin
      .from("role_permissions")
      .select("enabled")
      .eq("role", "manager")
      .eq("feature", "manage_staff")
      .single();
    hasManageStaff = perm?.enabled ?? false;
  }

  return { caller, hasManageStaff };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { caller, hasManageStaff } = await getCallerAndPermission(session.user?.email ?? "");
  if (!caller) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Access check: admin, manager with manage_staff, or own profile.
  if (caller.role !== "admin" && !hasManageStaff && caller.id !== id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Explicit column whitelist — never return the stored Google OAuth secrets
  // (google_access_token / google_refresh_token / google_token_expires_at).
  const { data, error } = await supabaseAdmin
    .from("staff")
    .select(
      "id, full_name, email, role, position, department, avatar_url, is_active, google_calendar_id, contracted_hours, xero_employee_id, birthdate, created_at, updated_at"
    )
    .eq("id", id)
    .single();
  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabaseAdmin
    .from("staff").select("role").eq("email", session.user?.email).single();

  if (caller?.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { full_name, role, position, department, google_calendar_id, is_active, contracted_hours, xero_employee_id, birthdate } = body;

  const { data, error } = await supabaseAdmin
    .from("staff")
    .update({
      ...(full_name !== undefined && { full_name }),
      ...(role !== undefined && { role }),
      ...(position !== undefined && { position }),
      ...(department !== undefined && { department }),
      ...(google_calendar_id !== undefined && { google_calendar_id }),
      ...(is_active !== undefined && { is_active }),
      ...(contracted_hours !== undefined && { contracted_hours: Number(contracted_hours) }),
      ...(xero_employee_id !== undefined && { xero_employee_id: xero_employee_id || null }),
      ...(birthdate !== undefined && { birthdate: birthdate || null }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
