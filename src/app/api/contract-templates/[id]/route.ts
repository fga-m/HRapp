import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { extractTemplateFields } from "@/lib/google-drive";
import { getValidContractsToken } from "@/lib/contracts-google";
import { normaliseFieldConfig, reconcileFieldConfig } from "@/lib/contract-fields";

export const dynamic = "force-dynamic";

async function requireAdmin(email: string | null | undefined) {
  if (!email) return null;
  const { data } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", email)
    .single();
  return data?.role === "admin" ? data : null;
}

// GET — a single template.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireAdmin(session.user?.email)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { data, error } = await supabaseAdmin
    .from("contract_templates")
    .select("id, title, google_doc_id, google_doc_url, fields, field_config, created_at, updated_at")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

// PATCH — two modes:
//   body `{ field_config }`  → save the per-field UI config
//   no body / empty          → re-scan the Doc for {{merge fields}}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireAdmin(session.user?.email)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  // Tolerate an empty/absent body (rescan) or a JSON body (save config).
  let body: { field_config?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    /* no body → rescan */
  }

  // --- Save field config ---
  if (body && body.field_config !== undefined) {
    const { data: template } = await supabaseAdmin
      .from("contract_templates")
      .select("fields")
      .eq("id", id)
      .single();
    if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Keep config only for fields that actually exist in the template.
    const config = reconcileFieldConfig(
      normaliseFieldConfig(body.field_config),
      (template.fields as string[]) ?? []
    );

    const { data, error } = await supabaseAdmin
      .from("contract_templates")
      .update({ field_config: config, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // --- Rescan ---
  const { data: template } = await supabaseAdmin
    .from("contract_templates")
    .select("google_doc_id, field_config")
    .eq("id", id)
    .single();
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let token: string;
  try {
    token = await getValidContractsToken();
  } catch {
    return NextResponse.json(
      { error: "Connect a Google account for contracts first." },
      { status: 400 }
    );
  }

  let fields: string[];
  try {
    fields = await extractTemplateFields(token, template.google_doc_id);
  } catch {
    return NextResponse.json({ error: "Couldn't read that Google Doc." }, { status: 502 });
  }

  const { data, error } = await supabaseAdmin
    .from("contract_templates")
    .update({
      fields,
      // Drop config for fields that disappeared; keep the rest.
      field_config: reconcileFieldConfig(template.field_config, fields),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE — unregister a template (does not touch already-generated contracts).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireAdmin(session.user?.email)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { error } = await supabaseAdmin.from("contract_templates").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
