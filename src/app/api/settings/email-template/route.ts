import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import {
  getEmailTemplate,
  setEmailTemplate,
  defaultTemplate,
  isTemplateKind,
  type EmailTemplate,
} from "@/lib/email-templates";

export const dynamic = "force-dynamic";

async function requireAdmin(email: string) {
  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", email)
    .single();
  return caller?.role === "admin" ? caller : null;
}

// GET ?kind=decline|approve — the template (merged over the default draft).
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const caller = await requireAdmin(session.user?.email ?? "");
  if (!caller) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const kind = new URL(req.url).searchParams.get("kind") ?? "decline";
  if (!isTemplateKind(kind)) return NextResponse.json({ error: "Invalid kind" }, { status: 400 });

  return NextResponse.json({
    template: await getEmailTemplate(kind),
    default: defaultTemplate(kind),
  });
}

// PUT { kind, subject, html, fromName, replyTo } — save the template.
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const caller = await requireAdmin(session.user?.email ?? "");
  if (!caller) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const kind = body.kind;
  if (!isTemplateKind(kind)) return NextResponse.json({ error: "Invalid kind" }, { status: 400 });

  const def = defaultTemplate(kind);
  const tpl: EmailTemplate = {
    subject: String(body.subject ?? "").trim() || def.subject,
    html: String(body.html ?? "").trim() || def.html,
    fromName: String(body.fromName ?? "").trim() || def.fromName,
    replyTo: String(body.replyTo ?? "").trim(),
  };
  await setEmailTemplate(kind, tpl, caller.id);
  return NextResponse.json({ ok: true, template: tpl });
}
