import { supabaseAdmin } from "@/lib/supabase";
import { getConnectedEmail } from "@/lib/contracts-google";

// A single, app-owned Google connection used to SEND transactional email via
// the Gmail API (e.g. leave-decline notifications), from a dedicated
// @fgam.org.au account (e.g. hrapp@fgam.org.au). Mirrors the contracts /
// workspace connections: one account authorises once, the app sends through it.
//
// Prerequisite (one-time, Google Cloud Console): add the scope below to the
// OAuth consent screen. For an internal (org-only) app this needs no Google
// verification. Then connect in Settings, signing in as the sending account.

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

export const GOOGLE_MAIL_SCOPE =
  "openid email https://www.googleapis.com/auth/gmail.send";

export function mailRedirectUri(): string {
  return `${process.env.NEXTAUTH_URL}/api/google-mail/callback`;
}

export { getConnectedEmail };

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  id_token?: string;
};

/** Exchange an authorization code for tokens (connect callback). */
export async function exchangeMailCode(code: string): Promise<TokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: mailRedirectUri(),
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);
  return res.json();
}

type ConnectionRow = {
  id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  connected_email: string | null;
  connected_at: string;
};

/** The current connection row (for status), or null if not connected. */
export async function getMailConnection(): Promise<ConnectionRow | null> {
  const { data } = await supabaseAdmin
    .from("google_mail_connection")
    .select("id, access_token, refresh_token, expires_at, connected_email, connected_at")
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as ConnectionRow | null) ?? null;
}

/** Return a valid access token, refreshing within 5 min of expiry. Throws if
 *  no account is connected. */
export async function getValidMailToken(): Promise<{ accessToken: string; email: string | null }> {
  const conn = await getMailConnection();
  if (!conn) throw new Error("Email (Gmail) isn't connected");

  if (Date.now() < new Date(conn.expires_at).getTime() - 5 * 60 * 1000) {
    return { accessToken: conn.access_token, email: conn.connected_email };
  }

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: conn.refresh_token,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${await res.text()}`);
  const tokens: TokenResponse = await res.json();

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  await supabaseAdmin
    .from("google_mail_connection")
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? conn.refresh_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conn.id);

  return { accessToken: tokens.access_token, email: conn.connected_email };
}

/** Encode a UTF-8 subject as an RFC 2047 word so non-ASCII renders correctly. */
function encodeHeader(value: string): string {
  // ASCII-only? send as-is. Otherwise base64 the whole word.
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf-8").toString("base64")}?=`;
}

/**
 * Send an HTML email via the connected Gmail account. Best-effort callers
 * should wrap this in try/catch — it throws if no account is connected or the
 * Gmail API rejects the message.
 */
export async function sendEmail(args: {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
  replyTo?: string; // stray replies route here (e.g. an HR inbox)
}): Promise<void> {
  const { accessToken, email } = await getValidMailToken();

  const fromHeader = args.fromName
    ? `${encodeHeader(args.fromName)} <${email ?? ""}>`
    : `<${email ?? ""}>`;

  // Base64-encode the HTML body (wrapped at 76 chars) so any UTF-8 content in
  // the body — e.g. the free-text decline reason — is transmitted correctly.
  const bodyB64 = (Buffer.from(args.html, "utf-8").toString("base64").match(/.{1,76}/g) ?? []).join("\r\n");

  const message = [
    `From: ${fromHeader}`,
    `To: ${args.to}`,
    ...(args.replyTo ? [`Reply-To: ${args.replyTo}`] : []),
    `Subject: ${encodeHeader(args.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    bodyB64,
  ].join("\r\n");

  const raw = Buffer.from(message, "utf-8").toString("base64url");

  const res = await fetch(GMAIL_SEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) {
    throw new Error(`Gmail send failed (${res.status}): ${await res.text()}`);
  }
}
