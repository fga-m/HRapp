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

// GET: admin sees all assigned checklists; staff sees only their own
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const caller = await getCaller(session.user?.email ?? "");
  if (!caller) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let query = supabaseAdmin
    .from("staff_checklists")
    .select(`
      *,
      staff:staff_id(id, full_name, email, position, department),
      assigned_by_staff:assigned_by(id, full_name, email),
      total_required:staff_checklist_items(count),
      completed_required:checklist_completions(count)
    `)
    .order("created_at", { ascending: false });

  if (caller.role !== "admin") {
    query = query.eq("staff_id", caller.id);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Compute completion progress per checklist
  const enriched = await Promise.all(
    (data ?? []).map(async (checklist: any) => {
      const { count: totalRequired } = await supabaseAdmin
        .from("staff_checklist_items")
        .select("*", { count: "exact", head: true })
        .eq("staff_checklist_id", checklist.id)
        .eq("is_required", true);

      const { count: completedRequired } = await supabaseAdmin
        .from("checklist_completions")
        .select("staff_checklist_items!inner(staff_checklist_id, is_required)", {
          count: "exact",
          head: true,
        })
        .eq("staff_checklist_id", checklist.id);

      // Count completions only for required items
      const { data: completedItems } = await supabaseAdmin
        .from("checklist_completions")
        .select(`
          staff_checklist_item_id,
          staff_checklist_items!inner(is_required)
        `)
        .eq("staff_checklist_id", checklist.id);

      const completedRequiredCount = (completedItems ?? []).filter(
        (c: any) => c.staff_checklist_items?.is_required
      ).length;

      return {
        ...checklist,
        total_required: totalRequired ?? 0,
        completed_required: completedRequiredCount,
      };
    })
  );

  return NextResponse.json({ checklists: enriched, role: caller.role });
}

// POST (admin only): create an assigned checklist
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const caller = await getCaller(session.user?.email ?? "");
  if (!caller) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (caller.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const body = await req.json();
  const { staff_id, template_id, title, is_offboarding, due_date } = body;

  if (!staff_id || !title) {
    return NextResponse.json(
      { error: "staff_id and title are required" },
      { status: 400 }
    );
  }

  // Create the staff checklist
  const { data: checklist, error: checklistError } = await supabaseAdmin
    .from("staff_checklists")
    .insert({
      staff_id,
      template_id: template_id ?? null,
      title,
      is_offboarding: is_offboarding ?? false,
      assigned_by: caller.id,
      due_date: due_date ?? null,
    })
    .select()
    .single();

  if (checklistError) return NextResponse.json({ error: checklistError.message }, { status: 500 });

  // Copy template items into staff_checklist_items
  const { data: templateItems, error: templateItemsError } = await supabaseAdmin
    .from("checklist_items")
    .select("*")
    .eq("template_id", template_id)
    .order("order_index", { ascending: true });

  if (templateItemsError) {
    return NextResponse.json({ error: templateItemsError.message }, { status: 500 });
  }

  if (templateItems && templateItems.length > 0) {
    const staffItems = templateItems.map((item: any) => ({
      staff_checklist_id: checklist.id,
      title: item.title,
      description: item.description,
      section: item.section ?? "General",
      link_url: item.link_url,
      is_required: item.is_required ?? true,
      order_index: item.order_index ?? 0,
      source_item_id: item.id,
    }));

    const { error: insertItemsError } = await supabaseAdmin
      .from("staff_checklist_items")
      .insert(staffItems);

    if (insertItemsError) {
      return NextResponse.json({ error: insertItemsError.message }, { status: 500 });
    }
  }

  // Notify the assigned staff member
  await supabaseAdmin.from("notifications").insert({
    staff_id,
    title: "You've been assigned an onboarding checklist",
    message: `${title} — your checklist is ready to view.`,
    type: "checklist",
    reference_id: checklist.id,
  });

  return NextResponse.json(checklist, { status: 201 });
}
