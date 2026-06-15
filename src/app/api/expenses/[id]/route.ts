import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { createNotification } from "@/lib/notifications";
import {
  findBillByReference,
  findOrCreateContact,
  createAccpayBill,
  attachReceipt,
} from "@/lib/xero";
import { isExpenseApprover } from "@/lib/expenses";

export const dynamic = "force-dynamic";

function notifyOwner(staffId: string, title: string, message: string) {
  return createNotification({
    staff_id: staffId,
    title,
    message,
    type: "general",
    link: "/dashboard/expenses",
    is_read: false,
  });
}

// PATCH /api/expenses/[id] — approver-gated APPROVE / REJECT.
export async function PATCH(
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

  const { action, note, fields } = (await req.json()) as {
    action: "APPROVE" | "REJECT" | "UPDATE";
    note?: string;
    fields?: Record<string, unknown>;
  };

  if (action !== "APPROVE" && action !== "REJECT" && action !== "UPDATE") {
    return NextResponse.json({ error: "action must be APPROVE, REJECT or UPDATE" }, { status: 400 });
  }

  const { data: claim } = await supabaseAdmin
    .from("expense_claims")
    .select("*")
    .eq("id", id)
    .single();

  if (!claim) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const approver = await isExpenseApprover(caller.role);
  const isOwner = claim.staff_id === caller.id;

  // ---- UPDATE (approver edits any submission; owner edits their own while submitted) ----
  if (action === "UPDATE") {
    const canEdit = approver || (isOwner && claim.status === "submitted");
    if (!canEdit) {
      return NextResponse.json({ error: "You can't edit this claim" }, { status: 403 });
    }
    if (claim.status !== "submitted" && claim.status !== "push_failed") {
      return NextResponse.json({ error: "Only submitted or failed claims can be edited" }, { status: 400 });
    }
    const f = fields ?? {};
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (f.amount !== undefined) {
      const n = Number(f.amount);
      if (isNaN(n) || n <= 0) {
        return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
      }
      update.amount = n;
    }
    if (f.description !== undefined) update.description = String(f.description);
    if (f.spent_on !== undefined) update.date = String(f.spent_on);
    if (f.spent_at !== undefined) update.spent_at = f.spent_at ? String(f.spent_at) : null;
    if (f.account_code !== undefined) update.account_code = f.account_code ? String(f.account_code) : null;
    if (f.account_name !== undefined) update.account_name = f.account_name ? String(f.account_name) : null;
    if (f.tax_type !== undefined) update.tax_type = f.tax_type ? String(f.tax_type) : null;
    if (f.tax_rate_name !== undefined) update.tax_rate_name = f.tax_rate_name ? String(f.tax_rate_name) : null;

    const { data, error } = await supabaseAdmin
      .from("expense_claims")
      .update(update)
      .eq("id", id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // APPROVE and REJECT are approver-only.
  if (!approver) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ---- REJECT ----
  if (action === "REJECT") {
    if (claim.status !== "submitted") {
      return NextResponse.json(
        { error: "Only submitted claims can be rejected" },
        { status: 400 }
      );
    }
    const { data, error } = await supabaseAdmin
      .from("expense_claims")
      .update({
        status: "rejected",
        reviewed_by: caller.id,
        reviewed_at: new Date().toISOString(),
        reviewer_notes: note?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await notifyOwner(
      claim.staff_id,
      "Expense claim declined",
      `Your expense claim of $${Number(claim.amount).toFixed(2)} was not approved${note?.trim() ? `: "${note.trim()}"` : "."}`
    );

    return NextResponse.json(data);
  }

  // ---- APPROVE ----

  // Self-approval block.
  if (claim.staff_id === caller.id) {
    return NextResponse.json(
      { error: "You cannot approve your own expense claim" },
      { status: 403 }
    );
  }

  // Only submitted or previously-failed pushes may be (re)approved.
  if (claim.status !== "submitted" && claim.status !== "push_failed") {
    return NextResponse.json(
      { error: "Only submitted claims can be approved" },
      { status: 400 }
    );
  }

  // Validate the financial fields required for the Xero bill.
  const amount = Number(claim.amount);
  if (!claim.account_code || !claim.tax_type || isNaN(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "Claim is missing a valid amount, account code or tax type" },
      { status: 400 }
    );
  }

  // (1) Record the approval first. reviewed_by is only stamped once (keep the
  //     original reviewer on a push retry).
  await supabaseAdmin
    .from("expense_claims")
    .update({
      status: "approved",
      ...(claim.reviewed_by ? {} : { reviewed_by: caller.id }),
      reviewed_at: new Date().toISOString(),
      reviewer_notes: note?.trim() || claim.reviewer_notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  // (2) Idempotency: if a Xero invoice is already linked, we're done.
  if (claim.xero_invoice_id) {
    return NextResponse.json({
      status: "pushed",
      xero_invoice_id: claim.xero_invoice_id,
      xero_total: claim.xero_total,
    });
  }

  // Owner details for the Xero contact.
  const { data: owner } = await supabaseAdmin
    .from("staff")
    .select("id, full_name, email, xero_contact_id")
    .eq("id", claim.staff_id)
    .single();

  if (!owner) return NextResponse.json({ error: "Claim owner not found" }, { status: 404 });

  try {
    // (2b) Idempotency: adopt an existing bill matched by reference (claim id).
    const existing = await findBillByReference(claim.id);
    if (existing) {
      const { data: adopted } = await supabaseAdmin
        .from("expense_claims")
        .update({
          status: "pushed",
          xero_invoice_id: existing,
          xero_pushed_at: new Date().toISOString(),
          xero_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      await notifyOwner(
        claim.staff_id,
        "Expense claim approved",
        `Your expense claim of $${amount.toFixed(2)} has been approved and sent to Xero.`
      );
      return NextResponse.json(adopted);
    }

    // (3) Resolve / persist the Xero contact for the owner.
    let contactId = owner.xero_contact_id as string | null;
    if (!contactId) {
      contactId = await findOrCreateContact({
        id: owner.id,
        full_name: owner.full_name,
        email: owner.email,
      });
      await supabaseAdmin
        .from("staff")
        .update({ xero_contact_id: contactId })
        .eq("id", owner.id);
    }
    await supabaseAdmin
      .from("expense_claims")
      .update({ xero_contact_id: contactId })
      .eq("id", id);

    // Guarded update to claim the push slot, preventing a concurrent double-push.
    const { data: guarded, error: guardErr } = await supabaseAdmin
      .from("expense_claims")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", id)
      .in("status", ["submitted", "push_failed", "approved"])
      .is("xero_invoice_id", null)
      .select("id")
      .single();

    if (guardErr || !guarded) {
      // Another request already pushed (or is pushing) this claim.
      const { data: latest } = await supabaseAdmin
        .from("expense_claims")
        .select("status, xero_invoice_id, xero_total")
        .eq("id", id)
        .single();
      return NextResponse.json({
        status: latest?.status ?? "pushed",
        xero_invoice_id: latest?.xero_invoice_id ?? null,
        xero_total: latest?.xero_total ?? null,
      });
    }

    // (4) Create the ACCPAY bill.
    const bill = await createAccpayBill({
      contactId,
      date: claim.date, // spent_on, yyyy-mm-dd
      reference: claim.id,
      lineItems: [
        {
          Description: claim.description,
          UnitAmount: amount,
          AccountCode: claim.account_code,
          TaxType: claim.tax_type,
          Quantity: 1,
        },
      ],
      lineAmountTypes: (claim.line_amount_type as "Inclusive" | "Exclusive" | "NoTax") || "Inclusive",
    });

    // (5) Assert the Xero total matches the claimed amount to the cent.
    if (Math.round(bill.total * 100) !== Math.round(amount * 100)) {
      const message = `Xero total ($${bill.total.toFixed(2)}) does not match the claim amount ($${amount.toFixed(2)}).`;
      await supabaseAdmin
        .from("expense_claims")
        .update({
          status: "push_failed",
          xero_error: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      return NextResponse.json({ error: message }, { status: 502 });
    }

    // (6) Best-effort: attach the receipt. Failure keeps status 'pushed' but records a note.
    let attachError: string | null = null;
    try {
      if (claim.receipt_path) {
        const { data: fileBlob, error: dlErr } = await supabaseAdmin.storage
          .from("receipts")
          .download(claim.receipt_path);
        if (dlErr || !fileBlob) {
          attachError = `Receipt could not be downloaded for Xero attachment: ${dlErr?.message ?? "missing file"}`;
        } else {
          const bytes = Buffer.from(await fileBlob.arrayBuffer());
          const fileName = claim.receipt_path.split("/").pop() || `receipt-${claim.id}`;
          await attachReceipt(
            bill.invoiceId,
            fileName,
            bytes,
            claim.receipt_mime || "application/octet-stream"
          );
        }
      }
    } catch (attErr: any) {
      attachError = `Bill created but receipt attachment failed: ${attErr?.message ?? "unknown error"}`;
    }

    // (7) Mark as pushed.
    const { data: pushed, error: pushErr } = await supabaseAdmin
      .from("expense_claims")
      .update({
        status: "pushed",
        xero_invoice_id: bill.invoiceId,
        xero_total: bill.total,
        xero_pushed_at: new Date().toISOString(),
        xero_error: attachError,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (pushErr) return NextResponse.json({ error: pushErr.message }, { status: 500 });

    await notifyOwner(
      claim.staff_id,
      "Expense claim approved",
      `Your expense claim of $${amount.toFixed(2)} has been approved and sent to Xero.`
    );

    return NextResponse.json(pushed);
  } catch (err: any) {
    const message = err?.message ?? "Failed to push the bill to Xero";
    await supabaseAdmin
      .from("expense_claims")
      .update({
        status: "push_failed",
        xero_error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function DELETE(
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

  const { data: claim } = await supabaseAdmin
    .from("expense_claims")
    .select("staff_id, status")
    .eq("id", id)
    .single();

  if (!claim) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = caller.role === "admin";
  const isOwner = caller.id === claim.staff_id;

  if (!isAdmin && !isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!isAdmin && claim.status !== "submitted") {
    return NextResponse.json({ error: "Only submitted claims can be deleted" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("expense_claims").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
