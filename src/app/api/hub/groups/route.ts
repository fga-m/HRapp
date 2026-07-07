import { NextRequest, NextResponse } from "next/server";
import { getCaller } from "@/lib/caller";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("hub_groups")
    .select("*")
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ groups: data ?? [], role: caller.role });
}

export async function POST(req: NextRequest) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!caller.isAdmin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const { label } = await req.json();
  if (!label?.trim()) return NextResponse.json({ error: "Label is required" }, { status: 400 });

  const { data: existing } = await supabaseAdmin
    .from("hub_groups")
    .select("order_index")
    .order("order_index", { ascending: false })
    .limit(1);

  const { data, error } = await supabaseAdmin
    .from("hub_groups")
    .insert({
      label: label.trim(),
      order_index: (existing?.[0]?.order_index ?? -1) + 1,
      created_by: caller.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
