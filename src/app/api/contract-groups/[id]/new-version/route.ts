import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: groupId } = await params;

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session.user?.email)
    .single();

  if (caller?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Verify group exists
  const { data: group, error: groupError } = await supabaseAdmin
    .from("contract_groups")
    .select("id, title")
    .eq("id", groupId)
    .single();

  if (groupError || !group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const description = formData.get("description") as string | null;
  const carryAssignments = formData.get("carry_assignments") === "true";

  if (!file) return NextResponse.json({ error: "File is required" }, { status: 400 });

  // Get current max version and the previous contract's id
  const { data: prevContract, error: prevError } = await supabaseAdmin
    .from("contracts")
    .select("id, version, title")
    .eq("group_id", groupId)
    .order("version", { ascending: false })
    .limit(1)
    .single();

  if (prevError || !prevContract) {
    return NextResponse.json({ error: "No existing versions found for this group" }, { status: 400 });
  }

  const newVersion = prevContract.version + 1;

  // Upload file
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

  const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
    .from("contracts")
    .upload(fileName, buffer, { contentType: "application/pdf", upsert: false });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  // Insert new contract version
  const { data: newContract, error: insertError } = await supabaseAdmin
    .from("contracts")
    .insert({
      title: prevContract.title,
      description: description || null,
      file_path: uploadData.path,
      file_name: file.name,
      created_by: caller.id,
      group_id: groupId,
      version: newVersion,
    })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // If carry_assignments: copy assignments from previous version and notify
  if (carryAssignments) {
    const { data: prevAssignments } = await supabaseAdmin
      .from("contract_assignments")
      .select("staff_id, assigned_by")
      .eq("contract_id", prevContract.id);

    if (prevAssignments && prevAssignments.length > 0) {
      const newRows = prevAssignments.map((a: any) => ({
        contract_id: newContract.id,
        staff_id: a.staff_id,
        assigned_by: caller.id,
      }));

      await supabaseAdmin
        .from("contract_assignments")
        .upsert(newRows, { onConflict: "contract_id,staff_id" });

      // Send notifications
      await supabaseAdmin.from("notifications").insert(
        prevAssignments.map((a: any) => ({
          staff_id: a.staff_id,
          title: `Updated contract to sign: "${newContract.title}"`,
          message: `A new version (v${newVersion}) of a contract you were previously assigned has been published. Please review and sign the updated version.`,
          type: "contract",
          link: `/dashboard/contracts/${newContract.id}`,
          is_read: false,
        }))
      );
    }
  }

  return NextResponse.json({ ...newContract, group_id: groupId }, { status: 201 });
}
