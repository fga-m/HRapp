import { NextRequest, NextResponse } from "next/server";
import { getCaller } from "@/lib/caller";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("hub_links")
    .select("*")
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ links: data ?? [], role: caller.role });
}

export async function POST(req: NextRequest) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!caller.isAdmin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const body = await req.json();
  const { label, url, description, group_id, icon } = body;

  if (!label?.trim()) return NextResponse.json({ error: "Label is required" }, { status: 400 });
  if (!url?.trim()) return NextResponse.json({ error: "URL is required" }, { status: 400 });

  // Get max order_index
  const { data: existing } = await supabaseAdmin
    .from("hub_links")
    .select("order_index")
    .order("order_index", { ascending: false })
    .limit(1);

  const nextOrder = (existing?.[0]?.order_index ?? -1) + 1;

  const { data, error } = await supabaseAdmin
    .from("hub_links")
    .insert({
      label: label.trim(),
      url: url.trim(),
      description: description?.trim() || null,
      group_id: group_id ?? null,
      icon: icon ?? null,
      order_index: nextOrder,
      created_by: caller.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
