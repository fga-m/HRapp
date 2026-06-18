import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { deriveStatus } from "@/lib/contract-draft-status";

export const dynamic = "force-dynamic";

// Confirm the caller is an admin; returns their staff id or null.
async function adminId(email: string | null | undefined): Promise<string | null> {
  if (!email) return null;
  const { data } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", email)
    .single();
  return data?.role === "admin" ? data.id : null;
}

type DraftRowRecord = {
  id: string;
  staff_id: string | null;
  recipient_name: string;
  values: Record<string, string> | null;
  generated_contract_id: string | null;
  generated_at: string | null;
  updated_at: string;
  generated: { google_doc_url: string | null; contract_id: string | null } | null;
};

// Shape a DB record into the row the grid consumes, with a derived status.
function toRow(r: DraftRowRecord) {
  return {
    id: r.id,
    staff_id: r.staff_id,
    recipient_name: r.recipient_name,
    values: r.values ?? {},
    generated_contract_id: r.generated_contract_id,
    google_doc_url: r.generated?.google_doc_url ?? null,
    contract_id: r.generated?.contract_id ?? null,
    status: deriveStatus({
      generatedContractId: r.generated_contract_id,
      generatedAt: r.generated_at,
      updatedAt: r.updated_at,
      contractId: r.generated?.contract_id ?? null,
    }),
  };
}

const SELECT =
  "id, staff_id, recipient_name, values, generated_contract_id, generated_at, updated_at, generated:generated_contracts(google_doc_url, contract_id)";

// GET — the persistent roster of rows for a template (admin only).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await adminId(session.user?.email))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: templateId } = await params;
  const { data, error } = await supabaseAdmin
    .from("contract_draft_rows")
    .select(SELECT)
    .eq("template_id", templateId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: (data ?? []).map((r) => toRow(r as unknown as DraftRowRecord)) });
}

// POST — add a row to the roster (from a staff member or blank). Returns it.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const callerId = await adminId(session.user?.email);
  if (!callerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: templateId } = await params;
  let body: { staff_id?: string | null; recipient_name?: string; values?: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("contract_draft_rows")
    .insert({
      template_id: templateId,
      staff_id: body.staff_id || null,
      recipient_name: (body.recipient_name ?? "").trim(),
      values: body.values ?? {},
      created_by: callerId,
    })
    .select(SELECT)
    .single();

  if (error) {
    // Unique violation on (template_id, staff_id) — this person is already on
    // the list. Surfaced as a friendly 409 rather than a 500.
    if (error.code === "23505") {
      return NextResponse.json({ error: "That staff member is already on this template's list." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ row: toRow(data as unknown as DraftRowRecord) }, { status: 201 });
}
