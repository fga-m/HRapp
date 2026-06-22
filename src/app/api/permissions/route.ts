import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getAccessByEmail } from "@/lib/access";

export const dynamic = "force-dynamic";

type RoleRow = {
  key: string;
  label: string;
  sort_order: number;
  is_system: boolean;
  is_admin: boolean;
};

// GET — the list of roles + every role/feature permission flag.
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await getAccessByEmail(session.user?.email ?? "");
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: roles } = await supabaseAdmin
    .from("roles")
    .select("key, label, sort_order, is_system, is_admin")
    .order("sort_order")
    .order("label");

  const { data: permissions, error } = await supabaseAdmin
    .from("role_permissions")
    .select("id, role, feature, enabled, updated_at")
    .order("role")
    .order("feature");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    roles: (roles ?? []) as RoleRow[],
    permissions: permissions ?? [],
    role: access.primaryRole,
  });
}

// PATCH — toggle a single feature for a role. Admins only. The admin role
// always has every feature and can't be toggled.
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await getAccessByEmail(session.user?.email ?? "");
  if (!access?.isAdmin) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const { role, feature, enabled } = await req.json();

  if (!role || !feature || enabled === undefined) {
    return NextResponse.json({ error: "role, feature and enabled are required" }, { status: 400 });
  }

  // Verify the role exists and isn't the admin (always-on) role.
  const { data: roleRow } = await supabaseAdmin
    .from("roles")
    .select("key, is_admin")
    .eq("key", role)
    .single();

  if (!roleRow) {
    return NextResponse.json({ error: "Unknown role" }, { status: 400 });
  }
  if (roleRow.is_admin) {
    return NextResponse.json({ error: "The Admin role always has full access." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("role_permissions")
    .upsert(
      { role, feature, enabled, updated_at: new Date().toISOString() },
      { onConflict: "role,feature" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
