import { supabaseAdmin } from "@/lib/supabase";

// Editable transactional-email templates, stored as JSON in app_settings.
// Each template is rendered by replacing {{placeholders}} with values at send
// time. A code-level default ("draft") is used until an admin customises it.

export type EmailTemplate = {
  subject: string;
  /** HTML body. Supports {{placeholder}} tokens. */
  html: string;
  /** Display name shown in the From line (the address is always the connected
   *  Gmail account, e.g. hrapp@fgam.org.au). */
  fromName: string;
  /** Where stray replies are routed (Reply-To). Blank = no Reply-To header. */
  replyTo: string;
};

export type TemplateKind = "decline" | "approve";

// Placeholders available to both leave templates:
//   {{name}}        - recipient's full name (or first name)
//   {{leave_type}}  - e.g. "Annual Leave"
//   {{period}}      - e.g. "1 Jun 2026 to 5 Jun 2026"
//   {{reason}}      - decline reason / approver note (or a fallback line)
//   {{app_url}}     - base URL of the HR app

const SHELL = (heading: string, intro: string, showReason: boolean) => `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#223149;">
  <div style="background:#223149;color:#ffffff;padding:20px 24px;border-radius:12px 12px 0 0;">
    <h1 style="margin:0;font-size:18px;font-weight:700;">FGA Melbourne — HR Portal</h1>
  </div>
  <div style="border:1px solid #ECE3DF;border-top:none;border-radius:0 0 12px 12px;padding:24px;">
    <p style="margin:0 0 14px;">Hi {{name}},</p>
    <p style="margin:0 0 14px;">${intro}</p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 16px;">
      <tr><td style="padding:6px 0;color:#50676E;width:120px;">Leave type</td><td style="padding:6px 0;font-weight:600;">{{leave_type}}</td></tr>
      <tr><td style="padding:6px 0;color:#50676E;">Dates</td><td style="padding:6px 0;font-weight:600;">{{period}}</td></tr>${
        showReason
          ? `\n      <tr><td style="padding:6px 0;color:#50676E;vertical-align:top;">Reason</td><td style="padding:6px 0;">{{reason}}</td></tr>`
          : ""
      }
    </table>
    <a href="{{app_url}}/dashboard/leave" style="display:inline-block;background:#223149;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:600;font-size:14px;">View in the HR Portal</a>
    <p style="margin:20px 0 0;font-size:12px;color:#50676E;border-top:1px solid #ECE3DF;padding-top:14px;">
      This is an automated message — <strong>please do not reply</strong> to this email. If you have questions, please speak with your manager.
    </p>
  </div>
</div>`;

const DEFAULTS: Record<TemplateKind, EmailTemplate> = {
  decline: {
    fromName: "FGA Melbourne HR (no-reply)",
    replyTo: "",
    subject: "Your leave request has been declined",
    html: SHELL("declined", "Your leave request has unfortunately been <strong>declined</strong>.", true),
  },
  approve: {
    fromName: "FGA Melbourne HR (no-reply)",
    replyTo: "",
    subject: "Your leave request has been approved",
    html: SHELL("approved", "Good news — your leave request has been <strong>approved</strong>.", false),
  },
};

const KEYS: Record<TemplateKind, string> = {
  decline: "leave_decline_email_template",
  approve: "leave_approve_email_template",
};

export function isTemplateKind(v: unknown): v is TemplateKind {
  return v === "decline" || v === "approve";
}

export function defaultTemplate(kind: TemplateKind): EmailTemplate {
  return { ...DEFAULTS[kind] };
}

/** Read a template, merging any saved overrides over the default draft. */
export async function getEmailTemplate(kind: TemplateKind): Promise<EmailTemplate> {
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", KEYS[kind])
    .maybeSingle();
  if (!data?.value) return defaultTemplate(kind);
  try {
    const saved = JSON.parse(data.value) as Partial<EmailTemplate>;
    return { ...DEFAULTS[kind], ...saved };
  } catch {
    return defaultTemplate(kind);
  }
}

/** Persist a template. */
export async function setEmailTemplate(
  kind: TemplateKind,
  tpl: EmailTemplate,
  updatedBy: string | null
): Promise<void> {
  await supabaseAdmin.from("app_settings").upsert(
    {
      key: KEYS[kind],
      value: JSON.stringify({
        subject: tpl.subject,
        html: tpl.html,
        fromName: tpl.fromName,
        replyTo: tpl.replyTo,
      }),
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    },
    { onConflict: "key" }
  );
}

/** Replace every {{token}} in a string with the matching value (blank if
 *  missing). Case-sensitive, whitespace-tolerant inside the braces. */
export function renderTemplate(
  text: string,
  vars: Record<string, string>
): string {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) => vars[key] ?? "");
}
