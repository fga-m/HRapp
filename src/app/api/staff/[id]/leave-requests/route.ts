import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { createNotification } from "@/lib/notifications";
import { xeroRequest } from "@/lib/xero";
import { getAccessByEmail, can, getApproverStaffIds } from "@/lib/access";

export const dynamic = "force-dynamic";

function fromXeroDate(xeroDate: string): string {
  const match = xeroDate.match(/\/Date\((\d+)/);
  if (!match) return xeroDate;
  return new Date(parseInt(match[1])).toISOString().split("T")[0];
}

// ─── GET ────────────────────────────────────────────────────────────────────
// Returns merged list: local PENDING/REJECTED/CANCELLED + Xero SCHEDULED/COMPLETED

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const caller = await getAccessByEmail(session.user?.email ?? "");
  if (!caller) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const canView = caller.id === id || can(caller, "approve_leave");
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: member } = await supabaseAdmin
    .from("staff")
    .select("xero_employee_id")
    .eq("id", id)
    .single();

  // 1. Fetch local pending/rejected/cancelled from DB
  const { data: localRequests } = await supabaseAdmin
    .from("leave_requests")
    .select("*")
    .eq("staff_id", id)
    .in("status", ["PENDING", "REJECTED", "CANCELLED"])
    .order("start_date", { ascending: false });

  const localApps = (localRequests ?? []).map((r) => ({
    id: r.id,
    leaveTypeId: r.leave_type_id,
    leaveName: r.leave_type_name,
    title: r.description ?? "",
    startDate: r.start_date,
    endDate: r.end_date,
    status: r.status as string,
    units: 0,
    hours: r.hours ?? null,
    source: "local" as const,
  }));

  // 2. Fetch approved/completed from Xero (only if linked)
  let xeroApps: typeof localApps = [];

  if (member?.xero_employee_id) {
    try {
      const res = await xeroRequest(
        `/payroll.xro/1.0/LeaveApplications?EmployeeId=${member.xero_employee_id}`
      );
      if (res.ok) {
        const data = await res.json();
        xeroApps = (data.LeaveApplications ?? [])
          .filter((a: any) => a.EmployeeID === member.xero_employee_id)
          .map((a: any) => {
            const leavePeriods: any[] = a.LeavePeriods ?? [];
            const appStatus: string = a.LeaveApplicationStatus ?? "SCHEDULED";
            const allProcessed =
              leavePeriods.length > 0 &&
              leavePeriods.every((p: any) => p.LeavePeriodStatus === "PROCESSED");
            const effectiveStatus =
              appStatus === "SCHEDULED" && allProcessed ? "COMPLETED" : appStatus;
            const units = leavePeriods.reduce(
              (sum: number, p: any) => sum + (p.NumberOfUnits ?? 0),
              0
            );
            return {
              id: a.LeaveApplicationID,
              leaveTypeId: a.LeaveTypeID,
              leaveName: "",
              title: a.Title ?? "",
              startDate: fromXeroDate(a.StartDate),
              endDate: fromXeroDate(a.EndDate),
              status: effectiveStatus,
              units,
              hours: units,
              source: "xero" as const,
            };
          });
      }
    } catch {
      // Xero not connected — just return local records
    }
  }

  // 3. Merge and sort newest first
  const all = [...localApps, ...xeroApps];
  all.sort((a, b) => b.startDate.localeCompare(a.startDate));

  return NextResponse.json({ linked: !!member?.xero_employee_id, applications: all });
}

// ─── POST ───────────────────────────────────────────────────────────────────
// Saves leave request locally as PENDING — not yet sent to Xero

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const caller = await getAccessByEmail(session.user?.email ?? "");
  if (!caller) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // The staff member themselves, plus anyone who can approve leave, can submit a
  // request (approvers can create on behalf of any staff member).
  const canSubmit = caller.id === id || can(caller, "approve_leave");
  if (!canSubmit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: member } = await supabaseAdmin
    .from("staff")
    .select("xero_employee_id")
    .eq("id", id)
    .single();

  if (!member?.xero_employee_id) {
    return NextResponse.json(
      { error: "This staff member is not linked to Xero Payroll. An admin needs to link them first." },
      { status: 400 }
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
    .insert({
      staff_id: id,
      leave_type_id: leaveTypeId,
      leave_type_name: leaveTypeName,
      start_date: startDate,
      end_date: endDate,
      hours: hours != null ? Number(hours) : null,
      description: description?.trim() || null,
      approver_id: approverId || null,
      status: "PENDING",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify everyone who can approve leave (admins + roles with approve_leave),
  // excluding the requester themselves.
  const approverIds = (await getApproverStaffIds("approve_leave")).filter((aid) => aid !== id);

  if (approverIds.length > 0) {
    const { data: requester } = await supabaseAdmin
      .from("staff")
      .select("full_name")
      .eq("id", id)
      .single();

    await createNotification(
      approverIds.map((aid) => ({
        staff_id: aid,
        title: `Leave request from ${requester?.full_name ?? "a staff member"}`,
        message: `${requester?.full_name ?? "A staff member"} has submitted a ${leaveTypeName} request from ${startDate} to ${endDate} — awaiting your approval.`,
        type: "leave",
        link: "/dashboard/leave",
        is_read: false,
      }))
    );
  }

  return NextResponse.json({ id: data.id, status: "PENDING" }, { status: 201 });
}
