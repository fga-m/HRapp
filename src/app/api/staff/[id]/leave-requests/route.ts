import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { xeroRequest } from "@/lib/xero";

export const dynamic = "force-dynamic";

/** Convert a JS date string (YYYY-MM-DD) to Xero's /Date(ms+0000)/ format */
function toXeroDate(dateStr: string): string {
  const ms = new Date(dateStr).getTime();
  return `/Date(${ms}+0000)/`;
}

/** Parse Xero /Date(ms+0000)/ → ISO date string */
function fromXeroDate(xeroDate: string): string {
  const match = xeroDate.match(/\/Date\((\d+)/);
  if (!match) return xeroDate;
  return new Date(parseInt(match[1])).toISOString().split("T")[0];
}

export async function GET(
  _req: NextRequest,
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

  const canView =
    caller.id === id || caller.role === "admin" || caller.role === "manager";
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: member } = await supabaseAdmin
    .from("staff")
    .select("xero_employee_id")
    .eq("id", id)
    .single();

  if (!member?.xero_employee_id) return NextResponse.json({ linked: false });

  try {
    const res = await xeroRequest(
      `/payroll.xro/1.0/LeaveApplications?EmployeeId=${member.xero_employee_id}`
    );
    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Xero error: ${err}` }, { status: res.status });
    }
    const data = await res.json();
    const applications = (data.LeaveApplications ?? [])
      // Always filter by employee ID — Xero may return all org applications
      .filter((a: any) => a.EmployeeID === member.xero_employee_id)
      .map((a: any) => ({
        id: a.LeaveApplicationID,
        leaveTypeId: a.LeaveTypeID,
        leaveName: a.Title ?? a.LeaveType ?? "",
        startDate: fromXeroDate(a.StartDate),
        endDate: fromXeroDate(a.EndDate),
        description: a.Description ?? "",
        status: a.LeaveApplicationStatus ?? "SCHEDULED",
        units: a.LeavePeriods?.reduce((sum: number, p: any) => sum + (p.NumberOfUnits ?? 0), 0) ?? 0,
      }));
    // Sort newest first
    applications.sort((a: any, b: any) => b.startDate.localeCompare(a.startDate));
    return NextResponse.json({ linked: true, applications });
  } catch (err: any) {
    if (err.message?.includes("not connected")) {
      return NextResponse.json({ linked: true, applications: [], xeroDown: true });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(
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

  // Only the staff member themselves or an admin can submit leave
  const canSubmit = caller.id === id || caller.role === "admin";
  if (!canSubmit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: member } = await supabaseAdmin
    .from("staff")
    .select("xero_employee_id, full_name")
    .eq("id", id)
    .single();

  if (!member?.xero_employee_id) {
    return NextResponse.json(
      { error: "This staff member is not linked to Xero Payroll. An admin needs to link them first." },
      { status: 400 }
    );
  }

  const { leaveTypeId, startDate, endDate, description } = await req.json();

  if (!leaveTypeId || !startDate || !endDate) {
    return NextResponse.json({ error: "Leave type, start date and end date are required" }, { status: 400 });
  }

  if (new Date(endDate) < new Date(startDate)) {
    return NextResponse.json({ error: "End date must be on or after start date" }, { status: 400 });
  }

  try {
    const body = {
      LeaveApplications: [
        {
          EmployeeID: member.xero_employee_id,
          LeaveTypeID: leaveTypeId,
          StartDate: toXeroDate(startDate),
          EndDate: toXeroDate(endDate),
          ...(description?.trim() && { Description: description.trim() }),
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
        { error: err.Message ?? err.Detail ?? "Failed to submit leave request" },
        { status: res.status }
      );
    }

    const data = await res.json();
    const created = data.LeaveApplications?.[0];
    return NextResponse.json({
      id: created?.LeaveApplicationID,
      startDate,
      endDate,
      status: "SCHEDULED",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
