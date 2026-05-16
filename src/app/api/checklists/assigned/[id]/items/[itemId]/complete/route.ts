import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

async function getCaller(email: string) {
  const { data } = await supabaseAdmin
    .from("staff")
    .select("id, role, full_name")
    .eq("email", email)
    .single();
  return data;
}

// POST (admin only): toggle completion of a staff_checklist_item
export async function POST(
  req: NextRequest,
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
    .select("id, is_required")
    .eq("id", itemId)
    .eq("staff_checklist_id", id)
    .single();

  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  // Check if already completed
  const { data: existingCompletion } = await supabaseAdmin
    .from("checklist_completions")
    .select("id")
    .eq("staff_checklist_id", id)
    .eq("staff_checklist_item_id", itemId)
    .single();

  if (existingCompletion) {
    // Already complete — uncomplete it
    const { error } = await supabaseAdmin
      .from("checklist_completions")
      .delete()
      .eq("id", existingCompletion.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ completed: false });
  }

  // Not yet complete — mark it done
  const body = await req.json().catch(() => ({}));
  const { notes } = body;

  const { error: completionError } = await supabaseAdmin
    .from("checklist_completions")
    .insert({
      staff_checklist_id: id,
      staff_checklist_item_id: itemId,
      completed_by: caller.id,
      notes: notes ?? null,
    });

  if (completionError) return NextResponse.json({ error: completionError.message }, { status: 500 });

  // Check if ALL required items are now completed
  const { data: requiredItems } = await supabaseAdmin
    .from("staff_checklist_items")
    .select("id")
    .eq("staff_checklist_id", id)
    .eq("is_required", true);

  const requiredItemIds = (requiredItems ?? []).map((i: any) => i.id);

  const { data: completedItems } = await supabaseAdmin
    .from("checklist_completions")
    .select("staff_checklist_item_id")
    .eq("staff_checklist_id", id)
    .in("staff_checklist_item_id", requiredItemIds);

  const completedIds = new Set((completedItems ?? []).map((c: any) => c.staff_checklist_item_id));
  const allRequiredDone = requiredItemIds.every((rid: string) => completedIds.has(rid));

  if (allRequiredDone && requiredItemIds.length > 0) {
    // Fetch checklist and staff info to build notification
    const { data: checklist } = await supabaseAdmin
      .from("staff_checklists")
      .select(`
        title,
        assigned_by,
        staff:staff_id(full_name)
      `)
      .eq("id", id)
      .single();

    if (checklist && checklist.assigned_by) {
      const staffName = (checklist.staff as any)?.full_name ?? "A staff member";
      await supabaseAdmin.from("notifications").insert({
        staff_id: checklist.assigned_by,
        title: `${staffName} has completed their checklist`,
        message: `All required items in '${checklist.title}' have been checked off.`,
        type: "checklist",
        reference_id: id,
      });
    }
  }

  return NextResponse.json({ completed: true, all_required_done: allRequiredDone });
}
