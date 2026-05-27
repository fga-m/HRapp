import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session.user?.email)
    .single();

  if (!caller) return NextResponse.json({ error: "Staff not found" }, { status: 404 });

  if (caller.role === "admin") {
    // Admin: all contracts with signature counts
    const { data: contracts, error } = await supabaseAdmin
      .from("contracts")
      .select(`
        *,
        created_by_staff:staff!contracts_created_by_fkey(full_name),
        contract_assignments(count),
        contract_signatures(count)
      `)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Flatten counts
    const formatted = (contracts ?? []).map((c: any) => ({
      ...c,
      assigned_count: c.contract_assignments?.[0]?.count ?? 0,
      signed_count: c.contract_signatures?.[0]?.count ?? 0,
      contract_assignments: undefined,
      contract_signatures: undefined,
    }));

    return NextResponse.json({ contracts: formatted, role: caller.role, staffId: caller.id });
  } else {
    // Staff: only assigned contracts with their own signature status
    const { data: assignments, error } = await supabaseAdmin
      .from("contract_assignments")
      .select(`
        contract_id,
        contracts(
          id, title, description, file_path, file_name, created_at, is_active
        )
      `)
      .eq("staff_id", caller.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const contractIds = (assignments ?? []).map((a: any) => a.contract_id);

    let signatures: any[] = [];
    if (contractIds.length > 0) {
      const { data: sigs } = await supabaseAdmin
        .from("contract_signatures")
        .select("contract_id, signed_at, name_as_typed")
        .eq("staff_id", caller.id)
        .in("contract_id", contractIds);
      signatures = sigs ?? [];
    }

    const sigMap = new Map(signatures.map((s: any) => [s.contract_id, s]));

    const contracts = (assignments ?? [])
      .map((a: any) => ({
        ...(a.contracts as any),
        my_signature: sigMap.get(a.contract_id) ?? null,
      }))
      .filter((c: any) => c.id && c.is_active);

    return NextResponse.json({ contracts, role: caller.role, staffId: caller.id });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session.user?.email)
    .single();

  if (caller?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const formData = await req.formData();
  const title = formData.get("title") as string;
  const description = formData.get("description") as string | null;
  const file = formData.get("file") as File;

  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  if (!file) return NextResponse.json({ error: "File is required" }, { status: 400 });

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

  const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
    .from("contracts")
    .upload(fileName, buffer, { contentType: "application/pdf", upsert: false });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data, error } = await supabaseAdmin
    .from("contracts")
    .insert({
      title,
      description: description || null,
      file_path: uploadData.path,
      file_name: file.name,
      created_by: caller.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
