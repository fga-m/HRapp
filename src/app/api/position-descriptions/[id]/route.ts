import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { createNotification } from "@/lib/notifications";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session.user?.email)
    .single();

  if (!caller) return NextResponse.json({ error: "Staff not found" }, { status: 404 });

  const { data: pd, error } = await supabaseAdmin
    .from("position_descriptions")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !pd) return NextResponse.json({ error: "Position description not found" }, { status: 404 });

  // Access control: staff can only view their own PD
  if (caller.role !== "admin" && pd.staff_id !== caller.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const currentYear = new Date().getFullYear();

  // Current year's acknowledgements for the current version
  const { data: currentAcks } = await supabaseAdmin
    .from("pd_acknowledgements")
    .select("*")
    .eq("pd_id", id)
    .eq("pd_version", pd.version)
    .eq("ack_year", currentYear);

  // All-time acknowledgement history
  const { data: ackHistory } = await supabaseAdmin
    .from("pd_acknowledgements")
    .select(`*, staff:staff(full_name, email)`)
    .eq("pd_id", id)
    .order("acknowledged_at", { ascending: false });

  // The assigned staff member's info
  const { data: assignedStaff } = await supabaseAdmin
    .from("staff")
    .select("id, full_name, email, avatar_url, position")
    .eq("id", pd.staff_id)
    .single();

  const myAck = currentAcks?.find((a: any) => a.staff_id === caller.id) || null;

  return NextResponse.json({
    pd,
    ackHistory: ackHistory || [],
    myAck,
    role: caller.role,
    staffId: caller.id,
    currentYear,
    assignedStaff: assignedStaff || null,
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
  const { title, content, bump_version, new_version, is_active } = body;

  const { data: current } = await supabaseAdmin
    .from("position_descriptions")
    .select("version, title, staff_id")
    .eq("id", id)
    .single();

  if (!current) return NextResponse.json({ error: "Position description not found" }, { status: 404 });

  const currentVersion = Number(current.version || 1);
  const bumpedVersion =
    new_version && Number(new_version) > currentVersion
      ? Number(new_version)
      : Math.floor(currentVersion) + 1;
  const newVersion = bump_version
    ? bumpedVersion
    : new_version !== undefined
    ? Number(new_version)
    : currentVersion;

  const { data, error } = await supabaseAdmin
    .from("position_descriptions")
    .update({
      ...(title !== undefined ? { title } : {}),
      ...(content !== undefined ? { content } : {}),
      ...(is_active !== undefined ? { is_active } : {}),
      version: newVersion,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If version bumped, notify the assigned staff to re-acknowledge
  if (bump_version && current.staff_id) {
    await createNotification({
      staff_id: current.staff_id,
      title: `Position Description Updated to v${newVersion}`,
      message: `Your position description has been updated. Please review the changes and acknowledge the new version.`,
      type: "general",
      category: "position_description",
      reference_id: id,
    });
  }

  return NextResponse.json(data);
}
