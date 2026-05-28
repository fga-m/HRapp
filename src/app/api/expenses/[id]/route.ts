import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session.user?.email ?? "")
    .single();

  if (!caller) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: claim } = await supabaseAdmin
    .from("expense_claims")
    .select("staff_id, status")
    .eq("id", id)
    .single();

  if (!claim) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = caller.role === "admin" || caller.role === "manager" || caller.role === "finance";
  const isOwner = caller.id === claim.staff_id;

  const body = await req.json();

  // Admins can approve/reject; owners can edit pending claims
  if (body.status) {
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { data, error } = await supabaseAdmin
      .from("expense_claims")
      .update({
        status: body.status,
        reviewed_by: caller.id,
        reviewed_at: new Date().toISOString(),
        reviewer_notes: body.reviewer_notes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // Owner editing their own pending claim
  if (!isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (claim.status !== "pending") {
    return NextResponse.json({ error: "Only pending claims can be edited" }, { status: 400 });
  }

  const { date, amount, category, description, receipt_url } = body;
  const { data, error } = await supabaseAdmin
    .from("expense_claims")
    .update({
      ...(date !== undefined && { date }),
      ...(amount !== undefined && { amount: parseFloat(amount) }),
      ...(category !== undefined && { category }),
      ...(description !== undefined && { description }),
      ...(receipt_url !== undefined && { receipt_url }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session.user?.email ?? "")
    .single();

  if (!caller) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: claim } = await supabaseAdmin
    .from("expense_claims")
    .select("staff_id, status")
    .eq("id", id)
    .single();

  if (!claim) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = caller.role === "admin";
  const isOwner = caller.id === claim.staff_id;

  if (!isAdmin && !isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!isAdmin && claim.status !== "pending") {
    return NextResponse.json({ error: "Only pending claims can be deleted" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("expense_claims").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
