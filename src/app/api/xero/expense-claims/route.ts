import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { xeroRequest } from "@/lib/xero";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role, email")
    .eq("email", session.user?.email ?? "")
    .single();

  if (!caller) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isReviewer =
    caller.role === "admin" ||
    caller.role === "manager" ||
    caller.role === "finance";

  try {
    const res = await xeroRequest("/api.xro/2.0/ExpenseClaims");
    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Xero error: ${err}` }, { status: res.status });
    }

    const data = await res.json();
    const all = (data.ExpenseClaims ?? [])
      .filter((c: any) => c.Status !== "DELETED" && c.Status !== "VOIDED")
      .map((c: any) => ({
        id: c.ExpenseClaimID,
        status: c.Status,           // SUBMITTED | AUTHORISED | PAID
        total: c.Total ?? 0,
        amountDue: c.AmountDue ?? 0,
        amountPaid: c.AmountPaid ?? 0,
        reportingDate: c.ReportingDate
          ? c.ReportingDate.replace(/\/Date\((\d+)[\+\-].*?\)\//, (_: string, ms: string) =>
              new Date(parseInt(ms)).toISOString().split("T")[0]
            )
          : null,
        user: {
          userId: c.User?.UserID ?? "",
          email: c.User?.EmailAddress ?? "",
          firstName: c.User?.FirstName ?? "",
          lastName: c.User?.LastName ?? "",
        },
        receipts: (c.Receipts ?? []).map((r: any) => ({
          id: r.ReceiptID,
          date: r.Date
            ? r.Date.replace(/\/Date\((\d+)[\+\-].*?\)\//, (_: string, ms: string) =>
                new Date(parseInt(ms)).toISOString().split("T")[0]
              )
            : null,
          reference: r.Reference ?? "",
          total: r.Total ?? 0,
          lineItems: (r.LineItems ?? []).map((l: any) => ({
            description: l.Description ?? "",
            quantity: l.Quantity ?? 1,
            unitAmount: l.UnitAmount ?? 0,
            accountCode: l.AccountCode ?? "",
          })),
        })),
      }));

    // Non-reviewers only see their own claims (match by email)
    const claims = isReviewer
      ? all
      : all.filter((c: any) =>
          c.user.email.toLowerCase() === caller.email.toLowerCase()
        );

    // Sort newest first
    claims.sort((a: any, b: any) => {
      const da = a.reportingDate ?? a.receipts[0]?.date ?? "";
      const db = b.reportingDate ?? b.receipts[0]?.date ?? "";
      return db.localeCompare(da);
    });

    return NextResponse.json({ claims });
  } catch (err: any) {
    if (err.message?.includes("not connected")) {
      return NextResponse.json({ xeroDown: true, claims: [] });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
