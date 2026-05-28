import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { xeroRequest } from "@/lib/xero";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("role")
    .eq("email", session.user?.email ?? "")
    .single();

  if (caller?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const res = await xeroRequest("/payroll.xro/1.0/Employees");
    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Xero error: ${err}` }, { status: res.status });
    }
    const data = await res.json();
    // Return simplified list
    const employees = (data.Employees ?? []).map((e: any) => ({
      id: e.EmployeeID,
      firstName: e.FirstName,
      lastName: e.LastName,
      email: e.Email ?? "",
      status: e.Status,
    }));
    return NextResponse.json({ employees });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
