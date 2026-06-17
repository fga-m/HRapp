import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { extractTemplateFields, parseGoogleDocId } from "@/lib/google-drive";
import { getValidContractsToken } from "@/lib/contracts-google";

export const dynamic = "force-dynamic";

// GET — list registered templates (admin only).
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session.user?.email)
    .single();
  if (caller?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from("contract_templates")
    .select("id, title, google_doc_id, google_doc_url, fields, field_config, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data ?? [] });
}

// POST — register a Google Doc as a template; detects its {{merge fields}}.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session.user?.email)
    .single();
  if (caller?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { title?: string; docUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const title = body.title?.trim();
  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });

  const docId = parseGoogleDocId(body.docUrl ?? "");
  if (!docId) {
    return NextResponse.json(
      { error: "That doesn't look like a Google Doc link. Paste the document's share URL." },
      { status: 400 }
    );
  }

  let token: string;
  try {
    token = await getValidContractsToken();
  } catch {
    return NextResponse.json(
      { error: "Connect a Google account for contracts first (button at the top of this page)." },
      { status: 400 }
    );
  }

  let fields: string[];
  try {
    fields = await extractTemplateFields(token, docId);
  } catch {
    return NextResponse.json(
      {
        error:
          "Couldn't read that Google Doc. Make sure it's a Google Doc in (or shared with) the connected contracts account.",
      },
      { status: 502 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("contract_templates")
    .insert({
      title,
      google_doc_id: docId,
      google_doc_url: `https://docs.google.com/document/d/${docId}/edit`,
      fields,
      field_config: {}, // every field defaults to a text box until configured
      created_by: caller.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
