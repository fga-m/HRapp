import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function isAdmin(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const { data } = await supabaseAdmin.from("staff").select("role").eq("email", email).single();
  return data?.role === "admin";
}

// PATCH — autosave an edit to a roster row (name / staff link / field values).
// Bumping updated_at is what flips a previously-generated row to "...changed".
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(session.user?.email))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  let body: { recipient_name?: string; staff_id?: string | null; values?: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.recipient_name === "string") patch.recipient_name = body.recipient_name.trim();
  if ("staff_id" in body) patch.staff_id = body.staff_id || null;
  if (body.values && typeof body.values === "object") patch.values = body.values;

  const { error } = await supabaseAdmin.from("contract_draft_rows").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE — remove a row from the roster. The generated_contracts row (if any)
// is left intact; it stays available under "Recent batches".
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(session.user?.email))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { error } = await supabaseAdmin.from("contract_draft_rows").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
