import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { xeroRequest } from "@/lib/xero";

export const dynamic = "force-dynamic";

// GET /api/xero/leave-types — the full list of leave types configured in the
// Xero org (from Payroll Pay Items). Used to populate the leave request form so
// staff can request circumstantial types (compassionate, unpaid, parental, …)
// that don't carry a tracked balance. Any signed-in staff member can read this.
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const res = await xeroRequest("/payroll.xro/1.0/PayItems");
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return NextResponse.json(
        { error: t.slice(0, 300) || "Couldn't load leave types from Xero" },
        { status: res.status }
      );
    }
    const data = await res.json();
    const leaveTypes = (data.PayItems?.LeaveTypes ?? [])
      .map((lt: { LeaveTypeID: string; Name: string; TypeOfUnits?: string }) => ({
        leaveTypeId: lt.LeaveTypeID,
        name: lt.Name,
        units: lt.TypeOfUnits ?? "Hours",
      }))
      .filter((t: { leaveTypeId?: string; name?: string }) => t.leaveTypeId && t.name)
      .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));

    return NextResponse.json({ leaveTypes });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't load leave types" },
      { status: 500 }
    );
  }
}
