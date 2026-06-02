import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// PATCH /api/staff/[id]/leave-requests/[reqId]
// Staff can edit their own PENDING request (type, dates, hours, description)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; reqId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, reqId } = await params;

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session.user?.email ?? "")
    .single();

  if (!caller) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only the staff member themselves (or an admin) can edit their own request
  const canEdit = caller.id === id || caller.role === "admin";
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

  const { data: approvers } = await supabaseAdmin
    .from("staff")
    .select("id")
    .in("role", ["admin", "leave_approver"])
    .eq("is_active", true)
    .neq("id", caller.id); // don't notify the editor if they're also an approver

  if (approvers && approvers.length > 0) {
    await supabaseAdmin.from("notifications").insert(
      approvers.map((a: any) => ({
        staff_id: a.id,
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
