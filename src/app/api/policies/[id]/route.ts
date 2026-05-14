import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session.user?.email)
    .single();

  if (!caller) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: policy, error } = await supabaseAdmin
    .from("policies")
    .select(`*, created_by_staff:staff!policies_created_by_fkey(full_name)`)
    .eq("id", id)
    .single();

  if (error || !policy) return NextResponse.json({ error: "Policy not found" }, { status: 404 });

  // Get all signoffs for this policy
  const { data: signoffs } = await supabaseAdmin
    .from("policy_signoffs")
    .select(`*, staff:staff(full_name, email, avatar_url)`)
    .eq("policy_id", id)
    .eq("policy_version", policy.version);

  // Get staff who need to sign (null = all active, array = specific people)
  const requiredIds: string[] | null = policy.required_signatories ?? null;
  let allStaffQuery = supabaseAdmin
    .from("staff")
    .select("id, full_name, email, avatar_url")
    .eq("is_active", true);

  if (Array.isArray(requiredIds) && requiredIds.length > 0) {
    allStaffQuery = allStaffQuery.in("id", requiredIds);
  }

  const { data: allStaff } = await allStaffQuery;

  const signedIds = new Set(signoffs?.map((s: any) => s.staff_id));
  const unsigned = allStaff?.filter((s: any) => !signedIds.has(s.id) && s.id !== caller.id) || [];

  // Check if current user has signed
  const mySignoff = signoffs?.find((s: any) => s.staff_id === caller.id);

  return NextResponse.json({
    policy,
    signoffs: signoffs || [],
    unsigned,
    mySignoff: mySignoff || null,
    role: caller.role,
    staffId: caller.id,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session.user?.email)
    .single();

  if (caller?.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const body = await req.json();
  const { title, description, content_drive_url, requires_signoff, is_active, bump_version, new_version, required_signatories } = body;

  const { data: current } = await supabaseAdmin
    .from("policies")
    .select("version, title")
    .eq("id", id)
    .single();

  const newVersion = bump_version
    ? (new_version && new_version > (current?.version || 1) ? new_version : (current?.version || 1) + 1)
    : (new_version || current?.version);

  const { data, error } = await supabaseAdmin
    .from("policies")
    .update({
      title: title ?? undefined,
      description: description ?? undefined,
      content_drive_url: content_drive_url ?? undefined,
      requires_signoff: requires_signoff ?? undefined,
      is_active: is_active ?? undefined,
      version: newVersion,
      updated_at: new Date().toISOString(),
      // required_signatories: undefined leaves it unchanged; null or array replaces it
      ...(required_signatories !== undefined ? { required_signatories } : {}),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If version bumped, notify required staff to re-sign
  if (bump_version && requires_signoff !== false) {
    // Use the updated required_signatories if provided, otherwise use what's stored on the policy
    const { data: updatedPolicy } = await supabaseAdmin
      .from("policies")
      .select("required_signatories")
      .eq("id", id)
      .single();

    const notifyIds: string[] | null = updatedPolicy?.required_signatories ?? null;

    let staffQuery = supabaseAdmin
      .from("staff")
      .select("id")
      .eq("is_active", true)
      .neq("id", caller.id);

    if (Array.isArray(notifyIds) && notifyIds.length > 0) {
      staffQuery = staffQuery.in("id", notifyIds);
    }

    const { data: staffToNotify } = await staffQuery;

    if (staffToNotify?.length) {
      await supabaseAdmin.from("notifications").insert(
        staffToNotify.map((s: any) => ({
          staff_id: s.id,
          title: "Policy Updated — Re-sign Required",
          message: `The policy "${data.title}" has been updated to v${newVersion}. Please review and sign off.`,
          type: "policy",
          reference_id: id,
        }))
      );
    }
  }

  return NextResponse.json(data);
}
