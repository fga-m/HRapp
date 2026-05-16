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

// POST (admin only): add a custom item to a staff checklist
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const caller = await getCaller(session.user?.email ?? "");
  if (!caller) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (caller.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const { id } = await params;

  // Ensure checklist exists
  const { data: checklist } = await supabaseAdmin
    .from("staff_checklists")
    .select("id")
    .eq("id", id)
    .single();

  if (!checklist) return NextResponse.json({ error: "Checklist not found" }, { status: 404 });

  const body = await req.json();
  const { title, description, section, link_url, is_required, order_index } = body;

  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("staff_checklist_items")
    .insert({
      staff_checklist_id: id,
      title,
      description: description ?? null,
      section: section ?? "General",
      link_url: link_url ?? null,
      is_required: is_required ?? true,
      order_index: order_index ?? 0,
      source_item_id: null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
