import { NextRequest, NextResponse } from "next/server";
import { getCaller } from "@/lib/caller";
import { supabaseAdmin } from "@/lib/supabase";

// GET: fetch assigned checklist with staff info, items grouped by section, and completions
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: checklist, error } = await supabaseAdmin
    .from("staff_checklists")
    .select(`
      *,
      staff:staff_id(id, full_name, email, position, department),
      assigned_by_staff:assigned_by(id, full_name, email)
    `)
    .eq("id", id)
    .single();

  if (error || !checklist) return NextResponse.json({ error: "Checklist not found" }, { status: 404 });

  // Non-admin staff can only view their own checklist
  if (!caller.isAdmin && checklist.staff_id !== caller.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch items ordered by section then order_index
  const { data: items, error: itemsError } = await supabaseAdmin
    .from("staff_checklist_items")
    .select("*")
    .eq("staff_checklist_id", id)
    .order("section", { ascending: true })
    .order("order_index", { ascending: true });

  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 });

  // Fetch completions
  const { data: completions, error: completionsError } = await supabaseAdmin
    .from("checklist_completions")
    .select(`
      *,
      completed_by_staff:completed_by(id, full_name, email)
    `)
    .eq("staff_checklist_id", id);

  if (completionsError) return NextResponse.json({ error: completionsError.message }, { status: 500 });

  // Group items by section
  const itemsBySection: Record<string, any[]> = {};
  for (const item of items ?? []) {
    const section = item.section ?? "General";
    if (!itemsBySection[section]) itemsBySection[section] = [];
    itemsBySection[section].push(item);
  }

  const isAssignedStaff = checklist.staff_id === caller.id;

  return NextResponse.json({
    ...checklist,
    items: items ?? [],
    items_by_section: itemsBySection,
    completions: completions ?? [],
    role: caller.role,
    is_assigned_staff: isAssignedStaff,
  });
}

// DELETE (admin only): delete an assigned checklist
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!caller.isAdmin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const { id } = await params;

  const { error } = await supabaseAdmin
    .from("staff_checklists")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
