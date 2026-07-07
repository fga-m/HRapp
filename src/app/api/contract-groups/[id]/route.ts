import { NextRequest, NextResponse } from "next/server";
import { getCaller } from "@/lib/caller";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  if (!caller.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Fetch the group
  const { data: group, error: groupError } = await supabaseAdmin
    .from("contract_groups")
    .select("id, title, description, created_at, updated_at")
    .eq("id", id)
    .single();

  if (groupError || !group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  // Fetch all versions with counts
  const { data: contracts, error: contractsError } = await supabaseAdmin
    .from("contracts")
    .select(`
      id, title, description, version, file_path, file_name, created_at, is_active,
      created_by_staff:staff!contracts_created_by_fkey(full_name),
      contract_assignments(count),
      contract_signatures(count)
    `)
    .eq("group_id", id)
    .order("version", { ascending: false });

  if (contractsError) return NextResponse.json({ error: contractsError.message }, { status: 500 });

  const versions = (contracts ?? []).map((c: any) => ({
    ...c,
    assigned_count: c.contract_assignments?.[0]?.count ?? 0,
    signed_count: c.contract_signatures?.[0]?.count ?? 0,
    contract_assignments: undefined,
    contract_signatures: undefined,
  }));

  return NextResponse.json({ ...group, versions });
}
