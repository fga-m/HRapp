import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAccessByEmail, can } from "@/lib/access";
import {
  getEmailTemplate,
  setEmailTemplate,
  defaultTemplate,
  isTemplateKind,
  type EmailTemplate,
} from "@/lib/email-templates";

export const dynamic = "force-dynamic";

// The leave templates are editable by admins and anyone who can approve leave.
async function canEditTemplates(email: string): Promise<{ id: string } | null> {
  const access = await getAccessByEmail(email);
  if (!access) return null;
  return can(access, "approve_leave") ? { id: access.id } : null;
}

// GET ?kind=decline|approve — the template (merged over the default draft).
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const kind = new URL(req.url).searchParams.get("kind") ?? "decline";
  if (!isTemplateKind(kind)) return NextResponse.json({ error: "Invalid kind" }, { status: 400 });

  const caller = await canEditTemplates(session.user?.email ?? "");
  if (!caller) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    template: await getEmailTemplate(kind),
    default: defaultTemplate(kind),
  });
}

// PUT { kind, subject, html, fromName, replyTo } — save the template.
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const kind = body.kind;
  if (!isTemplateKind(kind)) return NextResponse.json({ error: "Invalid kind" }, { status: 400 });

  const caller = await canEditTemplates(session.user?.email ?? "");
  if (!caller) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
