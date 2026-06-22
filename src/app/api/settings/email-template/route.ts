import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import {
  getEmailTemplate,
  setEmailTemplate,
  defaultTemplate,
  isTemplateKind,
  type EmailTemplate,
  type TemplateKind,
} from "@/lib/email-templates";

export const dynamic = "force-dynamic";

// Who can edit each email template. Admins can edit everything; otherwise only
// the people "in charge" of that section. Extend this map as more template
// kinds (for other parts of the app) are added.
const KIND_ROLES: Record<TemplateKind, string[]> = {
  decline: ["admin", "leave_approver"],
  approve: ["admin", "leave_approver"],
};

async function callerRole(email: string): Promise<{ id: string; role: string } | null> {
  const { data } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", email)
    .single();
  return data ?? null;
}

function canEdit(role: string, kind: TemplateKind): boolean {
  return role === "admin" || (KIND_ROLES[kind] ?? []).includes(role);
}

// GET ?kind=decline|approve — the template (merged over the default draft).
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const kind = new URL(req.url).searchParams.get("kind") ?? "decline";
  if (!isTemplateKind(kind)) return NextResponse.json({ error: "Invalid kind" }, { status: 400 });

  const caller = await callerRole(session.user?.email ?? "");
  if (!caller || !canEdit(caller.role, kind)) {
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

  const caller = await callerRole(session.user?.email ?? "");
  if (!caller || !canEdit(caller.role, kind)) {
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
