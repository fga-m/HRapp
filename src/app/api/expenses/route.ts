import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { createNotification } from "@/lib/notifications";
import { isExpenseApprover } from "@/lib/expenses";
import { validateExpenseLines, normaliseLine, round2, type ExpenseLine } from "@/lib/expense-lines";

export const dynamic = "force-dynamic";

/** Sign the receipt for a single claim row (best-effort; null on failure). */
async function signReceipt<T extends { receipt_path?: string | null }>(
  row: T
): Promise<T & { receipt_signed_url: string | null }> {
  if (!row.receipt_path) return { ...row, receipt_signed_url: null };
  const { data: signed } = await supabaseAdmin.storage
    .from("receipts")
    .createSignedUrl(row.receipt_path, 3600);
  return { ...row, receipt_signed_url: signed?.signedUrl ?? null };
}

// GET /api/expenses
//  - default: caller's own claims
//  - approver + ?queue=1: all status='submitted' with staff join
//  - approver + ?staffId=<id>: that staff member's claims (server-side filter)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role, roles")
    .eq("email", session.user?.email ?? "")
    .single();

  if (!caller) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const queue = searchParams.get("queue") === "1";
  const all = searchParams.get("all") === "1";
  const staffId = searchParams.get("staffId");
  const from = searchParams.get("from"); // YYYY-MM-DD (inclusive), filters created_at
  const to = searchParams.get("to");     // YYYY-MM-DD (inclusive)

  const approver = (queue || all || staffId) ? await isExpenseApprover(caller.roles ?? caller.role) : false;

  let query = supabaseAdmin
    .from("expense_claims")
    .select(`
      *,
      staff:staff_id ( id, full_name, avatar_url, position ),
      reviewer:reviewed_by ( id, full_name )
    `)
    .order("created_at", { ascending: false });

  if (queue) {
    if (!approver) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    // The review queue surfaces claims needing attention: awaiting review, and
    // any whose Xero push failed (so an approver can retry).
    query = query.in("status", ["submitted", "push_failed"]);
  } else if (all) {
    // Full history of every claim (approver only), optionally date-ranged on submission date.
    if (!approver) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (from) query = query.gte("created_at", `${from}T00:00:00`);
    if (to) query = query.lte("created_at", `${to}T23:59:59.999`);
  } else if (staffId) {
    // Approvers may view another staff member's claims; everyone else only their own.
    if (!approver && staffId !== caller.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    query = query.eq("staff_id", staffId);
  } else {
    // Default: self only.
    query = query.eq("staff_id", caller.id);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Sign receipt URLs only for the rows the caller is permitted to see (all returned rows are permitted).
  const signed = await Promise.all((data ?? []).map((row: any) => signReceipt(row)));
  return NextResponse.json(signed);
}

// POST /api/expenses — multipart form submit. Receipt REQUIRED.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role, full_name")
    .eq("email", session.user?.email ?? "")
    .single();

  if (!caller) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const formData = await req.formData();
  const amountRaw = (formData.get("amount") as string) ?? "";
  const spentOn = (formData.get("spent_on") as string) ?? "";
  const description = (formData.get("description") as string) ?? "";
  const spentAt = (formData.get("spent_at") as string) ?? "";
  const accountCode = (formData.get("account_code") as string) ?? "";
  const accountName = (formData.get("account_name") as string) ?? "";
  const taxType = (formData.get("tax_type") as string) ?? "";
  const taxRateName = (formData.get("tax_rate_name") as string) ?? "";
  const taxAmountRaw = (formData.get("tax_amount") as string) ?? "";
  const lineAmountType = ((formData.get("line_amount_type") as string) || "Inclusive").trim();
  const lineItemsRaw = (formData.get("line_items") as string) ?? "";
  const file = formData.get("file") as File | null;

  // A receipt is always required (web and mobile).
  if (!file) {
    return NextResponse.json({ error: "A receipt is required" }, { status: 400 });
  }
  if (!spentOn) {
    return NextResponse.json({ error: "The date is required" }, { status: 400 });
  }

  // Itemised claims send a `line_items` JSON array; normal claims send the
  // single amount/account/tax fields (with an optional GST override).
  let lineItems: ExpenseLine[] | null = null;
  if (lineItemsRaw.trim()) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(lineItemsRaw);
    } catch {
      return NextResponse.json({ error: "Line items were malformed" }, { status: 400 });
    }
    const err = validateExpenseLines(parsed);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
    lineItems = (parsed as ExpenseLine[]).map(normaliseLine);
  }

  // The stored amount is the claim total: the sum of line amounts (itemised)
  // or the single entered amount (normal).
  let amount: number;
  if (lineItems) {
    amount = round2(lineItems.reduce((s, l) => s + l.amount, 0));
  } else {
    amount = parseFloat(amountRaw);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
    }
    if (!description || !accountCode || !taxType) {
      return NextResponse.json(
        { error: "Description, account and tax type are required" },
        { status: 400 }
      );
    }
  }

  // Optional normal-mode GST override.
  let taxAmount: number | null = null;
  if (!lineItems && taxAmountRaw.trim()) {
    const t = Number(taxAmountRaw);
    if (isNaN(t) || t < 0 || t > amount) {
      return NextResponse.json({ error: "GST override must be between 0 and the amount" }, { status: 400 });
    }
    taxAmount = round2(t);
  }

  // Upload the receipt to the private 'receipts' bucket.
  const sanitisedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const receiptPath = `${caller.id}/${Date.now()}-${sanitisedName}`;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
    .from("receipts")
    .upload(receiptPath, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    const msg = /bucket not found/i.test(uploadError.message)
      ? "Receipt storage is not configured (missing 'receipts' bucket). Please contact an administrator."
      : uploadError.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // For itemised claims the per-line detail lives in `line_items`; the
  // claim-level account/tax columns are left null and the description is
  // derived from the lines for list/notification display.
  const derivedDescription = lineItems
    ? lineItems.map((l) => l.description).filter(Boolean).join("; ")
    : description;

  const { data: claim, error } = await supabaseAdmin
    .from("expense_claims")
    .insert({
      staff_id: caller.id,
      date: spentOn,
      amount,
      description: derivedDescription,
      currency: "AUD",
      spent_at: spentAt || null,
      account_code: lineItems ? null : accountCode,
      account_name: lineItems ? `Itemised (${lineItems.length} items)` : accountName || null,
      tax_type: lineItems ? null : taxType,
      tax_rate_name: lineItems ? null : taxRateName || null,
      tax_amount: taxAmount,
      line_items: lineItems,
      line_amount_type: lineAmountType,
      receipt_path: uploadData.path,
      receipt_mime: file.type || null,
      status: "submitted",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify approvers: admins + any role with approve_expenses enabled.
  const { data: enabledRoles } = await supabaseAdmin
    .from("role_permissions")
    .select("role")
    .eq("feature", "approve_expenses")
    .eq("enabled", true);

  const roles = ["admin", ...((enabledRoles ?? []).map((r: any) => r.role))];
  const { data: approvers } = await supabaseAdmin
    .from("staff")
    .select("id")
    .in("role", roles)
    .eq("is_active", true)
    .neq("id", caller.id);

  if (approvers && approvers.length > 0) {
    await createNotification(
      approvers.map((a: any) => ({
        staff_id: a.id,
        title: "New expense claim to review",
        message: `${caller.full_name ?? "A staff member"} submitted an expense claim of $${amount.toFixed(2)} for review.`,
        type: "general",
        category: "expense",
        link: "/dashboard/expenses",
        is_read: false,
      }))
    );
  }

  const signed = await signReceipt(claim as any);
  return NextResponse.json(signed, { status: 201 });
}
