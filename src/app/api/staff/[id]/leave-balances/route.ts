import { NextRequest, NextResponse } from "next/server";
import { getCaller } from "@/lib/caller";
import { supabaseAdmin } from "@/lib/supabase";
import { xeroRequest } from "@/lib/xero";
import { can } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // The staff member themselves, plus anyone who can approve leave (they need
  // balances to create/approve requests on a staff member's behalf).
  const canView = caller.id === id || can(caller, "approve_leave");
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Get the target staff member's Xero employee ID
  const { data: member } = await supabaseAdmin
    .from("staff")
    .select("xero_employee_id, full_name")
    .eq("id", id)
    .single();

  if (!member?.xero_employee_id) {
    return NextResponse.json({ linked: false });
  }

  try {
    const res = await xeroRequest(
      `/payroll.xro/1.0/Employees/${member.xero_employee_id}`
    );

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Xero error: ${err}` }, { status: res.status });
    }

    const data = await res.json();
    const employee = data.Employees?.[0];

    if (!employee) {
      return NextResponse.json({ error: "Employee not found in Xero" }, { status: 404 });
    }

    const balances = (employee.LeaveBalances ?? []).map((b: any) => ({
      name: b.LeaveName,
      leaveTypeId: b.LeaveTypeID,
      balance: b.NumberOfUnits,
      units: b.TypeOfUnits ?? "Hours",
    }));

    return NextResponse.json({ linked: true, balances });
  } catch (err: any) {
    // If Xero isn't connected, return gracefully
    if (err.message?.includes("not connected")) {
      return NextResponse.json({ linked: true, balances: [], xeroDown: true });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
