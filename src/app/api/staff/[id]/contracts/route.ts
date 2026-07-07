import { NextRequest, NextResponse } from "next/server";
import { getCaller } from "@/lib/caller";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: staffId } = await params;

  // Determine access: admin, own profile, or manager with manage_staff permission
  const isAdmin = caller.isAdmin;
  const isSelf = caller.id === staffId;

  let isManager = false;
  if (caller.role === "manager") {
    const { data: perm } = await supabaseAdmin
      .from("role_permissions")
      .select("enabled")
      .eq("role", "manager")
      .eq("feature", "manage_staff")
      .single();
    isManager = perm?.enabled ?? false;
  }

  if (!isAdmin && !isSelf && !isManager) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch all active contract assignments for this staff member
  const { data: assignments, error: assignmentsError } = await supabaseAdmin
    .from("contract_assignments")
    .select(`
      contract_id,
      contracts!inner(
        id, title, version, group_id, is_active,
        contract_groups(id, title)
      )
    `)
    .eq("staff_id", staffId)
    .eq("contracts.is_active", true);

  if (assignmentsError) return NextResponse.json({ error: assignmentsError.message }, { status: 500 });

  // Fetch signatures for this staff member
  const contractIds = (assignments ?? []).map((a: any) => a.contract_id);
  let signatures: any[] = [];
  if (contractIds.length > 0) {
    const { data: sigs } = await supabaseAdmin
      .from("contract_signatures")
      .select("contract_id, name_as_typed, signed_at")
      .eq("staff_id", staffId)
      .in("contract_id", contractIds);
    signatures = sigs ?? [];
  }

  const sigMap = new Map(signatures.map((s: any) => [s.contract_id, s]));

  // Group by group_id, showing highest version per group
  const groupMap = new Map<string, any>();
  const standaloneContracts: any[] = [];

  for (const a of assignments ?? []) {
    const contract = a.contracts as any;
    if (!contract) continue;

    const sig = sigMap.get(a.contract_id) ?? null;
    const contractEntry = {
      contract_id: contract.id,
      version: contract.version,
      file_name: contract.title,
      signed_at: sig?.signed_at ?? null,
    };

    if (contract.group_id) {
      const existing = groupMap.get(contract.group_id);
      if (!existing || contract.version > existing.current_version.version) {
        groupMap.set(contract.group_id, {
          group_id: contract.group_id,
          group_title: contract.contract_groups?.title ?? contract.title,
          current_version: contractEntry,
        });
      }
    } else {
      standaloneContracts.push({
        group_id: null,
        group_title: contract.title,
        current_version: contractEntry,
      });
    }
  }

  const contracts = [...groupMap.values(), ...standaloneContracts];

  return NextResponse.json({ contracts });
}
