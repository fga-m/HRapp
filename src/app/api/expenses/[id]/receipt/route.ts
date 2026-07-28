import { NextRequest, NextResponse } from "next/server";
import { getCaller } from "@/lib/caller";
import { supabaseAdmin } from "@/lib/supabase";
import { isExpenseApprover } from "@/lib/expenses";

export const dynamic = "force-dynamic";

const ALLOWED_MIME = ["image/png", "image/jpeg", "application/pdf"];

// PUT /api/expenses/[id]/receipt — replace the attached receipt file.
// Multipart form with a single `file`. Same edit gate as the UPDATE action:
// an approver may replace on any editable claim; an owner only while their
// claim is still 'submitted'. The old file is removed best-effort.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: claim } = await supabaseAdmin
    .from("expense_claims")
    .select("staff_id, status, receipt_path")
    .eq("id", id)
    .single();

  if (!claim) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const approver = await isExpenseApprover(caller.roles);
  const isOwner = claim.staff_id === caller.id;

  const canEdit = approver || (isOwner && claim.status === "submitted");
  if (!canEdit) {
    return NextResponse.json({ error: "You can't edit this claim" }, { status: 403 });
  }
  if (claim.status !== "submitted" && claim.status !== "push_failed") {
    return NextResponse.json(
      { error: "Only submitted or failed claims can be edited" },
      { status: 400 }
    );
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "A receipt file is required" }, { status: 400 });
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json(
      { error: "Receipt must be a PNG, JPG or PDF" },
      { status: 400 }
    );
  }

  // Upload the new file. Keep it under the owner's folder for parity with
  // the original submission path.
  const sanitisedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const newPath = `${claim.staff_id}/${Date.now()}-${sanitisedName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
    .from("receipts")
    .upload(newPath, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    const msg = /bucket not found/i.test(uploadError.message)
      ? "Receipt storage is not configured (missing 'receipts' bucket). Please contact an administrator."
      : uploadError.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin
    .from("expense_claims")
    .update({
      receipt_path: uploadData.path,
      receipt_mime: file.type || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    // Roll back the just-uploaded file so we don't leak an orphan.
    await supabaseAdmin.storage.from("receipts").remove([uploadData.path]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Best-effort: remove the previous file now that the row points at the new one.
  if (claim.receipt_path && claim.receipt_path !== uploadData.path) {
    await supabaseAdmin.storage.from("receipts").remove([claim.receipt_path]);
  }

  // Return a fresh signed URL so the client can update its preview.
  const { data: signed } = await supabaseAdmin.storage
    .from("receipts")
    .createSignedUrl(uploadData.path, 3600);

  return NextResponse.json({ ...data, receipt_signed_url: signed?.signedUrl ?? null });
}
