import { NextRequest, NextResponse } from "next/server";
import { getCaller } from "@/lib/caller";
import { supabaseAdmin } from "@/lib/supabase";
import { createNotification } from "@/lib/notifications";
import { can, getApproverStaffIds } from "@/lib/access";

export const dynamic = "force-dynamic";

// PATCH /api/staff/[id]/leave-requests/[reqId]
// Staff can edit their own PENDING request (type, dates, hours, description)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; reqId: string }> }
) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, reqId } = await params;

  // The staff member themselves, plus anyone who can approve leave, can edit a
  // pending request (reviewers can fix up a team member's request first).
  const canEdit = caller.id === id || can(caller, "approve_leave");
  if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Only PENDING requests can be edited
  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from("leave_requests")
    .select("*")
    .eq("id", reqId)
    .eq("staff_id", id)
    .eq("status", "PENDING")
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json(
      { error: "Request not found or cannot be edited (only pending requests can be changed)" },
      { status: 404 }
    );
  }

  const { leaveTypeId, leaveTypeName, startDate, endDate, hours, description, approverId } =
    await req.json();

  if (!leaveTypeId || !leaveTypeName || !startDate || !endDate) {
    return NextResponse.json(
      { error: "Leave type, start date and end date are required" },
      { status: 400 }
    );
  }

  if (new Date(endDate) < new Date(startDate)) {
    return NextResponse.json(
      { error: "End date must be on or after start date" },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("leave_requests")
    .update({
      leave_type_id: leaveTypeId,
      leave_type_name: leaveTypeName,
      start_date: startDate,
      end_date: endDate,
      hours: hours != null ? Number(hours) : null,
      description: description?.trim() || null,
      approver_id: approverId || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reqId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify approvers that the request was updated so they see the latest details
  const { data: requester } = await supabaseAdmin
    .from("staff")
    .select("full_name")
    .eq("id", id)
    .single();

  const approverIds = (await getApproverStaffIds("approve_leave")).filter(
    (aid) => aid !== caller.id // don't notify the editor if they're also an approver
  );

  if (approverIds.length > 0) {
    await createNotification(
      approverIds.map((aid) => ({
        staff_id: aid,
        title: `Leave request updated by ${requester?.full_name ?? "a staff member"}`,
        message: `${requester?.full_name ?? "A staff member"} has updated their ${leaveTypeName} request (${startDate} to ${endDate}).`,
        type: "leave",
        link: "/dashboard/leave",
        is_read: false,
      }))
    );
  }

  return NextResponse.json(data);
}
