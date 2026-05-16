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

// GET: list items for a template
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const caller = await getCaller(session.user?.email ?? "");
  if (!caller) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from("checklist_items")
    .select("*")
    .eq("template_id", id)
    .order("order_index", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST (admin only): add an item to a template
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

  // Ensure template exists
  const { data: template } = await supabaseAdmin
    .from("checklist_templates")
    .select("id")
    .eq("id", id)
    .single();

  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  const body = await req.json();
  const { title, description, section, link_url, is_required, order_index } = body;

  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("checklist_items")
    .insert({
      template_id: id,
      title,
      description: description ?? null,
      section: section ?? "General",
      link_url: link_url ?? null,
      is_required: is_required ?? true,
      order_index: order_index ?? 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
