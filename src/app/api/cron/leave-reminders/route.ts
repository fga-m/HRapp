import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { createNotification } from "@/lib/notifications";
import { getApproverStaffIds } from "@/lib/access";

export const dynamic = "force-dynamic";

// How long a request can sit before it's "stale", and how often we re-nudge.
const STALE_DAYS = 3;

// GET /api/cron/leave-reminders
// Daily job (see vercel.json) that nudges approvers about leave requests that
// have been PENDING for more than STALE_DAYS and haven't been reminded in the
// last STALE_DAYS. One aggregated notification per approver to avoid spam.
//
// Secured with CRON_SECRET: Vercel automatically sends it as a Bearer token on
// scheduled invocations. If CRON_SECRET isn't set, the endpoint still runs (so
// it works out of the box) but logs a warning — set CRON_SECRET to lock it down.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    console.warn("[cron/leave-reminders] CRON_SECRET not set — endpoint is unauthenticated.");
  }

  const now = Date.now();
  const staleBefore = new Date(now - STALE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // PENDING requests older than STALE_DAYS that we haven't reminded recently.
  const { data: stale, error } = await supabaseAdmin
    .from("leave_requests")
    .select("id, last_reminded_at, submitted_at")
    .eq("status", "PENDING")
    .lt("submitted_at", staleBefore);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const due = (stale ?? []).filter(
    (r: { last_reminded_at: string | null }) =>
      !r.last_reminded_at || new Date(r.last_reminded_at).getTime() < now - STALE_DAYS * 24 * 60 * 60 * 1000
  );

  if (due.length === 0) {
    return NextResponse.json({ ok: true, reminded: 0, approvers: 0 });
  }

  // One aggregated notification per person who can approve leave.
  const approverIds = await getApproverStaffIds("approve_leave");

  const count = due.length;
  if (approverIds.length > 0) {
    await createNotification(
      approverIds.map((aid) => ({
        staff_id: aid,
        title: "Leave requests awaiting approval",
        message: `${count} leave request${count === 1 ? "" : "s"} ${count === 1 ? "has" : "have"} been waiting more than ${STALE_DAYS} days for approval.`,
        type: "leave",
        link: "/dashboard/leave",
        is_read: false,
      }))
    );
  }

  // Mark these as reminded so they don't re-fire for another STALE_DAYS.
  const ids = due.map((r: { id: string }) => r.id);
  await supabaseAdmin
    .from("leave_requests")
    .update({ last_reminded_at: new Date().toISOString() })
    .in("id", ids);

  return NextResponse.json({ ok: true, reminded: count, approvers: approverIds.length });
}
