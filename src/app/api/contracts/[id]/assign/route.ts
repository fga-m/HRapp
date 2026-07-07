import { NextRequest, NextResponse } from "next/server";
import { getCaller } from "@/lib/caller";
import { supabaseAdmin } from "@/lib/supabase";
import { createNotification } from "@/lib/notifications";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  if (!caller.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { staff_ids } = body as { staff_ids: string[] };

  if (!Array.isArray(staff_ids) || staff_ids.length === 0) {
    return NextResponse.json({ error: "staff_ids must be a non-empty array" }, { status: 400 });
  }

  // Find which are newly assigned (to avoid duplicate notifications)
  const { data: existing } = await supabaseAdmin
    .from("contract_assignments")
    .select("staff_id")
    .eq("contract_id", id)
    .in("staff_id", staff_ids);

  const existingIds = new Set((existing ?? []).map((a: any) => a.staff_id));
  const newlyAssigned = staff_ids.filter((sid) => !existingIds.has(sid));

  // Upsert assignments
  const rows = staff_ids.map((staff_id) => ({
    contract_id: id,
    staff_id,
    assigned_by: caller.id,
  }));

  const { error } = await supabaseAdmin
    .from("contract_assignments")
    .upsert(rows, { onConflict: "contract_id,staff_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify newly assigned staff
  if (newlyAssigned.length > 0) {
    const { data: contract } = await supabaseAdmin
      .from("contracts")
      .select("title")
      .eq("id", id)
      .single();

    if (contract) {
      await createNotification(
        newlyAssigned.map((staff_id) => ({
          staff_id,
          title: `Contract to sign: "${contract.title}"`,
          message: `You have been assigned a contract that requires your e-signature. Please review and sign it.`,
          type: "contract",
          link: `/dashboard/contracts/${id}`,
          is_read: false,
        }))
      );
    }
  }

  return NextResponse.json({ success: true, newly_assigned: newlyAssigned.length });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  if (!caller.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const staff_id = searchParams.get("staff_id");

  if (!staff_id) return NextResponse.json({ error: "staff_id query param required" }, { status: 400 });

  // Only allow removal if not yet signed
  const { data: signature } = await supabaseAdmin
    .from("contract_signatures")
    .select("id")
    .eq("contract_id", id)
    .eq("staff_id", staff_id)
    .single();

  if (signature) {
    return NextResponse.json({ error: "Cannot remove assignment — staff has already signed" }, { status: 409 });
  }

  const { error } = await supabaseAdmin
    .from("contract_assignments")
    .delete()
    .eq("contract_id", id)
    .eq("staff_id", staff_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
