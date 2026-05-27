import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session.user?.email ?? "")
    .single();

  if (!caller) return NextResponse.json({ error: "Staff record not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const staffId = searchParams.get("staff_id");

  // Staff can only view their own transactions
  if (caller.role !== "admin" && staffId !== caller.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const queryId = caller.role === "admin" ? (staffId ?? caller.id) : caller.id;

  const { data: transactions, error } = await supabaseAdmin
    .from("toil_transactions")
    .select("id, staff_id, hours, reason, transaction_date, created_at, created_by")
    .eq("staff_id", queryId)
    .order("transaction_date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ transactions: transactions || [] });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session.user?.email ?? "")
    .single();

  if (!caller) return NextResponse.json({ error: "Staff record not found" }, { status: 404 });
  if (caller.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const body = await req.json();
  const { staff_id, hours, reason, transaction_date } = body;

  if (!staff_id || hours === undefined || hours === null) {
    return NextResponse.json({ error: "staff_id and hours are required" }, { status: 400 });
  }

  const { data: newTx, error } = await supabaseAdmin
    .from("toil_transactions")
    .insert({
      staff_id,
      hours: Number(hours),
      reason: reason ?? null,
      transaction_date: transaction_date ?? new Date().toISOString().split("T")[0],
      created_by: caller.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(newTx, { status: 201 });
}
