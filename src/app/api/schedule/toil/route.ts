import { NextRequest, NextResponse } from "next/server";
import { getCaller } from "@/lib/caller";
import { supabaseAdmin } from "@/lib/supabase";
import { createNotification } from "@/lib/notifications";

async function callerCanDo(callerRole: string, feature: string): Promise<boolean> {
  if (callerRole === "admin") return true;
  if (callerRole !== "manager") return false;
  const { data } = await supabaseAdmin
    .from("role_permissions")
    .select("enabled")
    .eq("role", "manager")
    .eq("feature", feature)
    .single();
  return data?.enabled ?? false;
}

export async function GET(req: NextRequest) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const staffId = searchParams.get("staff_id");

  const canManageToil = await callerCanDo(caller.role, "manage_toil");

  // Staff can only view their own transactions; managers/admins with manage_toil can view any
  if (!canManageToil && staffId !== caller.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const queryId = canManageToil ? (staffId ?? caller.id) : caller.id;

  const { data: transactions, error } = await supabaseAdmin
    .from("toil_transactions")
    .select("id, staff_id, hours, reason, transaction_date, created_at, created_by")
    .eq("staff_id", queryId)
    .order("transaction_date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ transactions: transactions || [] });
}

export async function POST(req: NextRequest) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await callerCanDo(caller.role, "manage_toil"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  // Notify the staff member their TOIL balance changed (skip self-adjustments).
  if (staff_id !== caller.id) {
    const h = Number(hours);
    const verb = h >= 0 ? "added to" : "deducted from";
    await createNotification({
      staff_id,
      title: "TOIL balance updated",
      message: `${Math.abs(h)} hour${Math.abs(h) === 1 ? "" : "s"} of TOIL ${verb} your balance${reason ? `: "${String(reason).trim()}"` : "."}`,
      type: "schedule",
      link: "/dashboard/schedule",
      is_read: false,
    });
  }

  return NextResponse.json(newTx, { status: 201 });
}
