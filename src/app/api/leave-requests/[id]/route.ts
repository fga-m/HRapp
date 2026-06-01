import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { xeroRequest } from "@/lib/xero";

export const dynamic = "force-dynamic";

function toXeroDate(dateStr: string): string {
  const ms = new Date(dateStr).getTime();
  return `/Date(${ms}+0000)/`;
}

// PATCH /api/leave-requests/[id] — approve or reject a pending request
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session.user?.email ?? "")
    .single();

  if (!caller) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isReviewer = caller.role === "admin" || caller.role === "leave_approver";
  if (!isReviewer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { action, note } = await req.json() as {
    action: "APPROVE" | "REJECT";
    note?: string;
  };

  if (action !== "APPROVE" && action !== "REJECT") {
    return NextResponse.json({ error: "action must be APPROVE or REJECT" }, { status: 400 });
  }

  // Fetch the request
  const { data: leaveReq, error: fetchErr } = await supabaseAdmin
    .from("leave_requests")
    .select("*")
    .eq("id", id)
    .eq("status", "PENDING")
    .single();

  if (fetchErr || !leaveReq) {
    return NextResponse.json({ error: "Request not found or already reviewed" }, { status: 404 });
  }

  if (action === "REJECT") {
    const { error } = await supabaseAdmin
      .from("leave_requests")
      .update({
        status: "REJECTED",
        approver_id: caller.id,
        approver_note: note?.trim() || null,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabaseAdmin.from("notifications").insert({
      staff_id: leaveReq.staff_id,
      title: "Leave request declined",
      message: `Your ${leaveReq.leave_type_name} request from ${leaveReq.start_date} to ${leaveReq.end_date} was not approved${note?.trim() ? `: "${note.trim()}"` : "."}`,
      type: "leave",
      link: "/dashboard/leave",
      is_read: false,
    });

    return NextResponse.json({ status: "REJECTED" });
  }

  // APPROVE — look up staff member's Xero employee ID and submit to Xero
  const { data: member } = await supabaseAdmin
    .from("staff")
    .select("xero_employee_id")
    .eq("id", leaveReq.staff_id)
    .single();

  if (!member?.xero_employee_id) {
    return NextResponse.json(
      { error: "Staff member is not linked to Xero Payroll. Link them first in their staff profile." },
      { status: 400 }
    );
  }

  try {
    const body = {
      LeaveApplications: [
        {
          EmployeeID: member.xero_employee_id,
          LeaveTypeID: leaveReq.leave_type_id,
          StartDate: toXeroDate(leaveReq.start_date),
          EndDate: toXeroDate(leaveReq.end_date),
          ...(leaveReq.description ? { Description: leaveReq.description } : {}),
        },
      ],
    };

    const res = await xeroRequest("/payroll.xro/1.0/LeaveApplications", {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ Message: "Unknown error" }));
      return NextResponse.json(
        { error: err.Message ?? err.Detail ?? "Xero rejected the leave application" },
        { status: res.status }
      );
    }

    const data = await res.json();
    const xeroId = data.LeaveApplications?.[0]?.LeaveApplicationID ?? null;

    // Mark as approved in DB
    const { error: updateErr } = await supabaseAdmin
      .from("leave_requests")
      .update({
        status: "APPROVED",
        approver_id: caller.id,
        approver_note: note?.trim() || null,
        xero_leave_application_id: xeroId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    await supabaseAdmin.from("notifications").insert({
      staff_id: leaveReq.staff_id,
      title: "Leave request approved",
      message: `Your ${leaveReq.leave_type_name} request from ${leaveReq.start_date} to ${leaveReq.end_date} has been approved.`,
      type: "leave",
      link: "/dashboard/leave",
      is_read: false,
    });

    // Auto-create an all-day calendar event on the staff member's Google Calendar.
    // All-day events appear in the all-day row and are excluded from TOIL hour calculations
    // (TOIL only sums timed events with dateTime). The leave hours are separately injected
    // into TOIL via the approved-leave adjustment in the schedule route.
    try {
      const { data: staffRecord } = await supabaseAdmin
        .from("staff")
        .select("email, full_name")
        .eq("id", leaveReq.staff_id)
        .single();

      const calToken = (session as any).accessToken;

      if (calToken && staffRecord?.email) {
        // Google Calendar all-day events use exclusive end dates (end = day after last day)
        const endExclusive = new Date(leaveReq.end_date);
        endExclusive.setDate(endExclusive.getDate() + 1);
        const endDateStr = endExclusive.toISOString().split("T")[0];

        await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(staffRecord.email)}/events`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${calToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              summary: leaveReq.leave_type_name,
              description: `Approved leave`,
              start: { date: leaveReq.start_date },
              end: { date: endDateStr },
              transparency: "opaque",  // shows as busy
              status: "confirmed",
            }),
          }
        );
        // Failure is intentionally silent — the approval itself must not be blocked
      }
    } catch {
      // Calendar event creation is best-effort
    }

    return NextResponse.json({ status: "APPROVED", xeroId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
