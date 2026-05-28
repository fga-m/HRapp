import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { xeroRequest } from "@/lib/xero";

export const dynamic = "force-dynamic";

function toXeroDate(dateStr: string): string {
  const ms = new Date(dateStr).getTime();
  return `/Date(${ms}+0000)/`;
}

function parseXeroDate(raw: string | null): string | null {
  if (!raw) return null;
  const match = raw.match(/\/Date\((\d+)[\+\-].*?\)\//);
  if (match) return new Date(parseInt(match[1])).toISOString().split("T")[0];
  return raw;
}

// ─── GET ────────────────────────────────────────────────────────────────────

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
        status: c.Status,
        total: c.Total ?? 0,
        amountDue: c.AmountDue ?? 0,
        amountPaid: c.AmountPaid ?? 0,
        reportingDate: parseXeroDate(c.ReportingDate),
        user: {
          userId: c.User?.UserID ?? "",
          email: c.User?.EmailAddress ?? "",
          firstName: c.User?.FirstName ?? "",
          lastName: c.User?.LastName ?? "",
        },
        receipts: (c.Receipts ?? []).map((r: any) => ({
          id: r.ReceiptID,
          date: parseXeroDate(r.Date),
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

    const claims = isReviewer
      ? all
      : all.filter((c: any) =>
          c.user.email.toLowerCase() === caller.email.toLowerCase()
        );

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

// ─── POST ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role, email")
    .eq("email", session.user?.email ?? "")
    .single();

  if (!caller) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: {
    date: string;
    merchant: string;
    reference?: string;
    lineItems: Array<{
      description: string;
      accountCode: string;
      amount: number;
      taxType: string;
    }>;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { date, merchant, reference, lineItems } = body;

  if (!date || !merchant || !lineItems?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  for (const item of lineItems) {
    if (!item.description || !item.accountCode || item.amount <= 0) {
      return NextResponse.json({ error: "Each line item needs a description, account, and amount" }, { status: 400 });
    }
  }

  try {
    // 1. Look up the user's Xero UserID by email
    const usersRes = await xeroRequest("/api.xro/2.0/Users");
    if (!usersRes.ok) {
      const err = await usersRes.text();
      return NextResponse.json({ error: `Could not fetch Xero users: ${err}` }, { status: 500 });
    }
    const usersData = await usersRes.json();
    const xeroUser = (usersData.Users ?? []).find(
      (u: any) => u.EmailAddress?.toLowerCase() === caller.email.toLowerCase()
    );

    if (!xeroUser) {
      return NextResponse.json({
        error: "Your account was not found in Xero. Ask an admin to invite you to the Xero organisation.",
      }, { status: 422 });
    }

    // 2. Create a Receipt in Xero
    const receiptPayload = {
      Receipts: [
        {
          Type: "RECEIPT",
          User: { UserID: xeroUser.UserID },
          Contact: { Name: merchant },
          Date: toXeroDate(date),
          LineAmountTypes: "Inclusive",
          ...(reference ? { Reference: reference } : {}),
          LineItems: lineItems.map((item) => ({
            Description: item.description,
            Quantity: 1.0,
            UnitAmount: item.amount,
            AccountCode: item.accountCode,
            TaxType: item.taxType,
          })),
        },
      ],
    };

    const receiptRes = await xeroRequest("/api.xro/2.0/Receipts", {
      method: "POST",
      body: JSON.stringify(receiptPayload),
    });

    if (!receiptRes.ok) {
      const err = await receiptRes.text();
      return NextResponse.json({ error: `Failed to create receipt in Xero: ${err}` }, { status: 500 });
    }

    const receiptData = await receiptRes.json();
    const receiptId = receiptData.Receipts?.[0]?.ReceiptID;

    if (!receiptId) {
      return NextResponse.json({ error: "Xero did not return a receipt ID" }, { status: 500 });
    }

    // 3. Create an ExpenseClaim referencing the receipt
    const claimPayload = {
      ExpenseClaims: [
        {
          Status: "SUBMITTED",
          User: { UserID: xeroUser.UserID },
          Receipts: [{ ReceiptID: receiptId }],
        },
      ],
    };

    const claimRes = await xeroRequest("/api.xro/2.0/ExpenseClaims", {
      method: "POST",
      body: JSON.stringify(claimPayload),
    });

    if (!claimRes.ok) {
      const err = await claimRes.text();
      return NextResponse.json({ error: `Failed to create expense claim in Xero: ${err}` }, { status: 500 });
    }

    const claimData = await claimRes.json();
    return NextResponse.json({ success: true, claimId: claimData.ExpenseClaims?.[0]?.ExpenseClaimID });
  } catch (err: any) {
    if (err.message?.includes("not connected")) {
      return NextResponse.json({ xeroDown: true }, { status: 503 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
