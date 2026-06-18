import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { findOrCreateFolder, copyDoc, fillDocPlaceholders, shareFileWithUser } from "@/lib/google-drive";
import { getValidContractsToken } from "@/lib/contracts-google";

export const dynamic = "force-dynamic";

type Row = {
  staff_id?: string | null;
  recipient_name?: string;
  values?: Record<string, string>;
  draft_row_id?: string | null; // roster row this came from, if any
};

// POST — generate a batch: one filled Google Doc per employee, kept in Drive.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session.user?.email)
    .single();
  if (caller?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: templateId } = await params;
  const { data: template } = await supabaseAdmin
    .from("contract_templates")
    .select("id, title, google_doc_id")
    .eq("id", templateId)
    .single();
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  let body: { batchLabel?: string; rows?: Row[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const rows = (body.rows ?? []).filter((r) => (r.recipient_name ?? "").trim());
  if (rows.length === 0) {
    return NextResponse.json({ error: "Add at least one employee with a name." }, { status: 400 });
  }

  let accessToken: string;
  try {
    accessToken = await getValidContractsToken();
  } catch {
    return NextResponse.json(
      { error: "Connect a Google account for contracts on the Templates page first." },
      { status: 400 }
    );
  }
  const callerEmail = session.user?.email ?? null;
  const batchId = crypto.randomUUID();
  const batchLabel =
    body.batchLabel?.trim() || `${template.title} — ${new Date().toISOString().slice(0, 10)}`;

  // One Drive folder per batch under "Generated Contracts".
  let folderId: string | undefined;
  try {
    const root = await findOrCreateFolder(accessToken, "Generated Contracts");
    folderId = await findOrCreateFolder(accessToken, batchLabel, root);
  } catch {
    return NextResponse.json(
      { error: "Couldn't reach Google Drive for the contracts account. Please try again." },
      { status: 502 }
    );
  }

  // Copy + fill one Doc per employee. Capture per-row outcome so one failure
  // doesn't sink the whole batch.
  const outcomes = await Promise.all(
    rows.map(async (row) => {
      const recipientName = (row.recipient_name ?? "").trim();
      const values = row.values ?? {};
      try {
        const copy = await copyDoc(
          accessToken,
          template.google_doc_id,
          `${recipientName} — ${template.title}`,
          folderId
        );
        await fillDocPlaceholders(accessToken, copy.id, values);
        // Grant the admin who generated it edit access (app-driven sharing).
        if (callerEmail) {
          try {
            await shareFileWithUser(accessToken, copy.id, callerEmail, "writer");
          } catch {
            /* non-fatal — the doc still exists on the connection account */
          }
        }
        return {
          ok: true as const,
          draftRowId: row.draft_row_id || null,
          insert: {
            template_id: template.id,
            batch_id: batchId,
            batch_label: batchLabel,
            staff_id: row.staff_id || null,
            recipient_name: recipientName,
            google_doc_id: copy.id,
            google_doc_url: copy.url,
            values,
            created_by: caller.id,
          },
        };
      } catch (err) {
        return {
          ok: false as const,
          recipient_name: recipientName,
          error: err instanceof Error ? err.message : "Generation failed",
        };
      }
    })
  );

  const okOutcomes = outcomes.filter((o) => o.ok);
  const toInsert = okOutcomes.map((o) => o.insert);
  const failed = outcomes
    .filter((o) => !o.ok)
    .map((o) => ({ recipient_name: o.recipient_name, error: o.error }));

  type GenRow = {
    id: string;
    recipient_name: string;
    staff_id: string | null;
    google_doc_url: string | null;
    contract_id: string | null;
  };
  let generated: (GenRow & { draft_row_id: string | null })[] = [];
  if (toInsert.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("generated_contracts")
      .insert(toInsert)
      .select("id, recipient_name, staff_id, google_doc_url, contract_id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const inserted = (data ?? []) as GenRow[];

    // The insert returns rows in request order, so we zip by index (guarded on
    // length) to recover which roster row each copy belongs to.
    const aligned = inserted.length === okOutcomes.length;
    generated = inserted.map((g, i) => ({ ...g, draft_row_id: aligned ? okOutcomes[i].draftRowId : null }));

    // Link each roster row to its fresh copy and stamp generated_at, so the
    // grid can show "Generated"/"Sent" and detect later edits.
    if (aligned) {
      const stamp = new Date().toISOString();
      await Promise.all(
        generated.map((g) => {
          if (!g.draft_row_id) return null;
          return supabaseAdmin
            .from("contract_draft_rows")
            .update({ generated_contract_id: g.id, generated_at: stamp })
            .eq("id", g.draft_row_id);
        })
      );
    }
  }

  return NextResponse.json(
    { batch_id: batchId, batch_label: batchLabel, generated, failed },
    { status: 201 }
  );
}
