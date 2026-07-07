import { NextRequest, NextResponse } from "next/server";
import { getCaller } from "@/lib/caller";
import { supabaseAdmin } from "@/lib/supabase";

// GET: fetch single template with its items
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: template, error } = await supabaseAdmin
    .from("checklist_templates")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  const { data: items, error: itemsError } = await supabaseAdmin
    .from("checklist_items")
    .select("*")
    .eq("template_id", id)
    .order("order_index", { ascending: true });

  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 });

  return NextResponse.json({ ...template, items: items ?? [] });
}

// PATCH (admin only): update template fields
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!caller.isAdmin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { title, description, category, ministry, is_offboarding } = body;

  if (category && !["generic", "ministry"].includes(category)) {
    return NextResponse.json({ error: "Category must be 'generic' or 'ministry'" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (category !== undefined) updates.category = category;
  if (ministry !== undefined) updates.ministry = ministry;
  if (is_offboarding !== undefined) updates.is_offboarding = is_offboarding;

  const { data, error } = await supabaseAdmin
    .from("checklist_templates")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  return NextResponse.json(data);
}

// DELETE (admin only): delete template
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!caller.isAdmin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const { id } = await params;

  const { error } = await supabaseAdmin
    .from("checklist_templates")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
