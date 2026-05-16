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

// GET: fetch all templates with item counts
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const caller = await getCaller(session.user?.email ?? "");
  if (!caller) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from("checklist_templates")
    .select(`
      *,
      item_count:checklist_items(count)
    `)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const templates = (data ?? []).map((t: any) => ({
    ...t,
    item_count: t.item_count?.[0]?.count ?? 0,
  }));

  return NextResponse.json({ templates, role: caller.role });
}

// POST (admin only): create a template
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const caller = await getCaller(session.user?.email ?? "");
  if (!caller) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (caller.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const body = await req.json();
  const { title, description, category, ministry, is_offboarding } = body;

  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  if (category && !["generic", "ministry"].includes(category)) {
    return NextResponse.json({ error: "Category must be 'generic' or 'ministry'" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("checklist_templates")
    .insert({
      title,
      description: description ?? null,
      category: category ?? "generic",
      ministry: ministry ?? null,
      is_offboarding: is_offboarding ?? false,
      created_by: caller.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
