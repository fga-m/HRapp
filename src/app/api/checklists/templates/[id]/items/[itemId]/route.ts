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

// PATCH (admin only): update a template item
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const caller = await getCaller(session.user?.email ?? "");
  if (!caller) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (caller.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const { id, itemId } = await params;
  const body = await req.json();
  const { title, description, section, link_url, is_required, order_index } = body;

  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (section !== undefined) updates.section = section;
  if (link_url !== undefined) updates.link_url = link_url;
  if (is_required !== undefined) updates.is_required = is_required;
  if (order_index !== undefined) updates.order_index = order_index;

  const { data, error } = await supabaseAdmin
    .from("checklist_items")
    .update(updates)
    .eq("id", itemId)
    .eq("template_id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  return NextResponse.json(data);
}

// DELETE (admin only): delete a template item
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

  const { error } = await supabaseAdmin
    .from("checklist_items")
    .delete()
    .eq("id", itemId)
    .eq("template_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
