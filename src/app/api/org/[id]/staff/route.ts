import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session.user?.email)
    .single();

  if (caller?.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const body = await req.json();
  const { staff_id } = body;

  if (!staff_id) return NextResponse.json({ error: "staff_id is required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("org_role_staff")
    .upsert({ role_id: id, staff_id }, { onConflict: "role_id,staff_id", ignoreDuplicates: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session.user?.email)
    .single();

  if (caller?.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  // Accept staff_id from query param or JSON body
  let staff_id = req.nextUrl.searchParams.get("staff_id");
  if (!staff_id) {
    try {
      const body = await req.json();
      staff_id = body.staff_id;
    } catch {
      // no body
    }
  }

  if (!staff_id) return NextResponse.json({ error: "staff_id is required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("org_role_staff")
    .delete()
    .eq("role_id", id)
    .eq("staff_id", staff_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
