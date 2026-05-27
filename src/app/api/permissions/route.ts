import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session.user?.email ?? "")
    .single();

  if (!caller) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: permissions, error } = await supabaseAdmin
    .from("role_permissions")
    .select("id, role, feature, enabled, updated_at")
    .order("role")
    .order("feature");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ permissions: permissions ?? [], role: caller.role });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session.user?.email ?? "")
    .single();

  if (caller?.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const body = await req.json();
  const { role, feature, enabled } = body;

  if (!role || !feature || enabled === undefined) {
    return NextResponse.json({ error: "role, feature and enabled are required" }, { status: 400 });
  }

  if (!["manager", "staff"].includes(role)) {
    return NextResponse.json({ error: "role must be manager or staff" }, { status: 400 });
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
