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

  const currentYear = new Date().getFullYear();

  // Get sign-offs for current version AND current year (yearly renewal)
  const { data: signoffs } = await supabaseAdmin
    .from("policy_signoffs")
    .select(`*, staff:staff(full_name, email, avatar_url)`)
    .eq("policy_id", id)
    .eq("policy_version", policy.version)
    .eq("signoff_year", currentYear);

  // Also fetch all-time sign-off history for admin view (all years)
  const { data: signoffHistory } = await supabaseAdmin
    .from("policy_signoffs")
    .select(`*, staff:staff(full_name, email)`)
    .eq("policy_id", id)
    .order("signed_at", { ascending: false });

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
    signoffHistory: signoffHistory || [],
    unsigned,
    mySignoff: mySignoff || null,
    role: caller.role,
    staffId: caller.id,
    currentYear,
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

  const currentVersion = Number(current?.version || 1);
  // When bumping without an explicit new_version, go to the next whole number (e.g. 3.1 → 4)
  const bumpedVersion = new_version && Number(new_version) > currentVersion
    ? Number(new_version)
    : Math.floor(currentVersion) + 1;
  const newVersion = bump_version ? bumpedVersion : (new_version !== undefined ? Number(new_version) : currentVersion);

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
          title: `Re-sign needed: "${data.title}" updated to v${newVersion}`,
          message: `This policy has been updated. Please review the changes and sign off again.`,
          type: "policy",
          reference_id: id,
        }))
      );
    }
  }

  return NextResponse.json(data);
}
