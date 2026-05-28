import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session.user?.email ?? "")
    .single();

  if (!caller) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = caller.role === "admin" || caller.role === "manager" || caller.role === "finance";

  const query = supabaseAdmin
    .from("expense_claims")
    .select(`
      *,
      staff:staff_id ( id, full_name, avatar_url, position )
    `)
    .order("created_at", { ascending: false });

  // Non-admins only see their own
  if (!isAdmin) {
    query.eq("staff_id", caller.id);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session.user?.email ?? "")
    .single();

  if (!caller) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { date, amount, category, description, receipt_url } = await req.json();

  if (!date || !amount || !category || !description) {
    return NextResponse.json({ error: "Date, amount, category and description are required" }, { status: 400 });
  }

  if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
    return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("expense_claims")
    .insert({
      staff_id: caller.id,
      date,
      amount: parseFloat(amount),
      category,
      description,
      receipt_url: receipt_url || null,
      status: "pending",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
