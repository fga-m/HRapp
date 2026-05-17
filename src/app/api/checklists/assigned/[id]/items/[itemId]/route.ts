import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

async function getCaller(email: string) {
  const { data } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", email)
    .single();
  return data;
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const caller = await getCaller(session.user?.email ?? "");
  if (!caller) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (caller.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const { id, itemId } = await params;

  // Verify item belongs to this checklist
  const { data: item } = await supabaseAdmin
    .from("staff_checklist_items")
    .select("id")
    .eq("id", itemId)
    .eq("staff_checklist_id", id)
    .single();

  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  const { error } = await supabaseAdmin
    .from("staff_checklist_items")
    .delete()
    .eq("id", itemId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
