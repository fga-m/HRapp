import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { createNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

// Don't let the same request be nudged more than once every 12 hours.
const REMIND_COOLDOWN_MS = 12 * 60 * 60 * 1000;

// POST /api/leave-requests/[id]/remind
// Re-notifies the leave approvers that a PENDING request is still waiting.
// Allowed for the requester themselves or any reviewer (admin / leave_approver).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session.user?.email ?? "")
    .single();
  if (!caller) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { id } = await params;

  const { data: lr } = await supabaseAdmin
    .from("leave_requests")
    .select("id, staff_id, status, leave_type_name, start_date, end_date, last_reminded_at")
    .eq("id", id)
    .single();
  if (!lr) return NextResponse.json({ error: "Leave request not found" }, { status: 404 });

  const isReviewer = caller.role === "admin" || caller.role === "leave_approver";
  if (caller.id !== lr.staff_id && !isReviewer) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (lr.status !== "PENDING") {
    return NextResponse.json({ error: "Only pending requests can be reminded." }, { status: 400 });
  }

  if (
    lr.last_reminded_at &&
    Date.now() - new Date(lr.last_reminded_at).getTime() < REMIND_COOLDOWN_MS
  ) {
    return NextResponse.json(
      { error: "A reminder was already sent recently — please try again later." },
      { status: 429 }
    );
  }

  const { data: requester } = await supabaseAdmin
    .from("staff")
    .select("full_name")
    .eq("id", lr.staff_id)
    .single();

  // Notify the approvers (admins + leave approvers), excluding the requester.
  const { data: approvers } = await supabaseAdmin
    .from("staff")
    .select("id")
    .in("role", ["admin", "leave_approver"])
    .neq("id", lr.staff_id)
    .eq("is_active", true);

  if (approvers && approvers.length > 0) {
    await createNotification(
      approvers.map((a: { id: string }) => ({
        staff_id: a.id,
        title: "Leave request reminder",
        message: `Reminder: ${requester?.full_name ?? "a staff member"}'s ${lr.leave_type_name} request (${lr.start_date} to ${lr.end_date}) is still awaiting your approval.`,
        type: "leave",
        link: "/dashboard/leave",
        is_read: false,
      }))
    );
  }

  await supabaseAdmin
    .from("leave_requests")
    .update({ last_reminded_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({ ok: true, reminded: approvers?.length ?? 0 });
}
