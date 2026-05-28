import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { xeroRequest } from "@/lib/xero";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const res = await xeroRequest("/api.xro/2.0/Accounts?Type=EXPENSE");
    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Xero error: ${err}` }, { status: res.status });
    }

    const data = await res.json();
    const accounts = (data.Accounts ?? [])
      .filter((a: any) => a.Status === "ACTIVE")
      .map((a: any) => ({
        code: a.Code ?? "",
        name: a.Name ?? "",
        taxType: a.TaxType ?? "",
      }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));

    return NextResponse.json({ accounts });
  } catch (err: any) {
    if (err.message?.includes("not connected")) {
      return NextResponse.json({ xeroDown: true, accounts: [] });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
