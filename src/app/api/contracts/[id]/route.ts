import { NextRequest, NextResponse } from "next/server";
import { getCaller } from "@/lib/caller";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: contract, error } = await supabaseAdmin
    .from("contracts")
    .select(`*, created_by_staff:staff!contracts_created_by_fkey(full_name)`)
    .eq("id", id)
    .single();

  if (error || !contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

  // Staff: only proceed if they are assigned
  if (!caller.isAdmin) {
    const { data: assignment } = await supabaseAdmin
      .from("contract_assignments")
      .select("id")
      .eq("contract_id", id)
      .eq("staff_id", caller.id)
      .single();

    if (!assignment) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Generate signed URL (1 hour)
  const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
    .from("contracts")
    .createSignedUrl(contract.file_path, 3600);

  if (signedUrlError) {
    return NextResponse.json({ error: signedUrlError.message }, { status: 500 });
  }

  // Assignments with staff info and signature status
  const { data: assignments } = await supabaseAdmin
    .from("contract_assignments")
    .select(`
      id,
      staff_id,
      assigned_at,
      staff:staff!contract_assignments_staff_id_fkey(id, full_name, email, avatar_url)
    `)
    .eq("contract_id", id);

  const { data: signatures } = await supabaseAdmin
    .from("contract_signatures")
    .select("staff_id, name_as_typed, signed_at")
    .eq("contract_id", id);

  const sigMap = new Map((signatures ?? []).map((s: any) => [s.staff_id, s]));

  const assignmentsWithStatus = (assignments ?? []).map((a: any) => ({
    ...a,
    signature: sigMap.get(a.staff_id) ?? null,
  }));

  const mySignature = sigMap.get(caller.id) ?? null;

  return NextResponse.json({
    contract,
    signedUrl: signedUrlData.signedUrl,
    assignments: assignmentsWithStatus,
    mySignature,
    role: caller.role,
    staffId: caller.id,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  if (!caller.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { title, description, is_active } = body;

  const { data, error } = await supabaseAdmin
    .from("contracts")
    .update({
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(is_active !== undefined ? { is_active } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  if (!caller.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: contract } = await supabaseAdmin
    .from("contracts")
    .select("file_path")
    .eq("id", id)
    .single();

  if (contract?.file_path) {
    await supabaseAdmin.storage.from("contracts").remove([contract.file_path]);
  }

  const { error } = await supabaseAdmin.from("contracts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
