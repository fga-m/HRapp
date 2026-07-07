import { NextRequest, NextResponse } from "next/server";
import { getCaller } from "@/lib/caller";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (caller.isAdmin) {
    // Fetch all contract groups with all their versions and counts
    const { data: groups, error: groupsError } = await supabaseAdmin
      .from("contract_groups")
      .select(`
        id, title, description, created_at, updated_at,
        contracts(
          id, title, description, version, file_path, file_name, created_at, is_active, group_id,
          created_by_staff:staff!contracts_created_by_fkey(full_name),
          contract_assignments(count),
          contract_signatures(count)
        )
      `)
      .order("created_at", { ascending: false });

    if (groupsError) return NextResponse.json({ error: groupsError.message }, { status: 500 });

    // Fetch standalone contracts (group_id IS NULL)
    const { data: standaloneRaw, error: standaloneError } = await supabaseAdmin
      .from("contracts")
      .select(`
        *,
        created_by_staff:staff!contracts_created_by_fkey(full_name),
        contract_assignments(count),
        contract_signatures(count)
      `)
      .is("group_id", null)
      .order("created_at", { ascending: false });

    if (standaloneError) return NextResponse.json({ error: standaloneError.message }, { status: 500 });

    // Shape groups: find latest version, attach all versions
    const formattedGroups = (groups ?? []).map((g: any) => {
      const versions: any[] = (g.contracts ?? [])
        .sort((a: any, b: any) => b.version - a.version)
        .map((c: any) => ({
          ...c,
          assigned_count: c.contract_assignments?.[0]?.count ?? 0,
          signed_count: c.contract_signatures?.[0]?.count ?? 0,
          contract_assignments: undefined,
          contract_signatures: undefined,
        }));

      const currentVersion = versions[0] ?? null;

      return {
        id: g.id,
        title: g.title,
        description: g.description,
        created_at: g.created_at,
        updated_at: g.updated_at,
        current_version: currentVersion,
        versions,
      };
    });

    const standalone = (standaloneRaw ?? []).map((c: any) => ({
      ...c,
      assigned_count: c.contract_assignments?.[0]?.count ?? 0,
      signed_count: c.contract_signatures?.[0]?.count ?? 0,
      contract_assignments: undefined,
      contract_signatures: undefined,
    }));

    return NextResponse.json({ groups: formattedGroups, standalone, role: caller.role, staffId: caller.id });
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
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!caller.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const formData = await req.formData();
  const title = formData.get("title") as string;
  const description = formData.get("description") as string | null;
  const file = formData.get("file") as File;
  const incomingGroupId = formData.get("group_id") as string | null;

  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  if (!file) return NextResponse.json({ error: "File is required" }, { status: 400 });

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

  const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
    .from("contracts")
    .upload(fileName, buffer, { contentType: "application/pdf", upsert: false });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  let groupId: string;
  let version = 1;

  if (incomingGroupId) {
    // Use existing group — find max version
    groupId = incomingGroupId;
    const { data: maxVersionRow } = await supabaseAdmin
      .from("contracts")
      .select("version")
      .eq("group_id", groupId)
      .order("version", { ascending: false })
      .limit(1)
      .single();
    version = (maxVersionRow?.version ?? 0) + 1;
  } else {
    // Auto-create a new contract_groups row
    const { data: newGroup, error: groupError } = await supabaseAdmin
      .from("contract_groups")
      .insert({
        title,
        description: description || null,
        created_by: caller.id,
      })
      .select()
      .single();

    if (groupError) return NextResponse.json({ error: groupError.message }, { status: 500 });
    groupId = newGroup.id;
  }

  const { data, error } = await supabaseAdmin
    .from("contracts")
    .insert({
      title,
      description: description || null,
      file_path: uploadData.path,
      file_name: file.name,
      created_by: caller.id,
      group_id: groupId,
      version,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ...data, group_id: groupId }, { status: 201 });
}
