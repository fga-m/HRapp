import { supabaseAdmin } from "@/lib/supabase";
import crypto from "crypto";

// A single, app-owned Google Workspace connection used to CREATE staff
// accounts via the Admin SDK Directory API. This mirrors the contracts Google
// connection and the Xero connection: one dedicated account authorises once and
// every app-admin provisions through it.
//
// IMPORTANT prerequisites (one-time, in Google Cloud Console + Admin console):
//   1. Enable the "Admin SDK API" on the Google Cloud project behind
//      GOOGLE_CLIENT_ID.
//   2. Add the scope below to the OAuth consent screen.
//   3. Connect (authorise) using a Google account that is a Workspace
//      SUPER ADMIN (or has the "User Management" admin privilege). A normal
//      account cannot create users and the API will return 403.
//
// Reuses the existing Google OAuth client (GOOGLE_CLIENT_ID/SECRET) but is a
// separate, offline connection from both per-user login and the contracts
// connection, because account creation needs a different scope + an admin.

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const DIRECTORY_USERS_URL = "https://admin.googleapis.com/admin/directory/v1/users";

// admin.directory.user (read+write users) plus openid/email so we can show
// which admin account is connected.
export const WORKSPACE_GOOGLE_SCOPE =
  "openid email https://www.googleapis.com/auth/admin.directory.user";

export function workspaceRedirectUri(): string {
  return `${process.env.NEXTAUTH_URL}/api/google-workspace/callback`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  id_token?: string;
};

/** Exchange an authorization code for tokens (connect callback). */
export async function exchangeWorkspaceCode(code: string): Promise<TokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: workspaceRedirectUri(),
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);
  return res.json();
}

/** Look up the email of the account that just authorised. */
export async function getConnectedEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.email as string | undefined) ?? null;
  } catch {
    return null;
  }
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
export async function getWorkspaceConnection(): Promise<ConnectionRow | null> {
  const { data } = await supabaseAdmin
    .from("google_workspace_connection")
    .select("id, access_token, refresh_token, expires_at, connected_email, connected_at")
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as ConnectionRow | null) ?? null;
}

/**
 * Return a valid access token for the Workspace connection, refreshing it when
 * within 5 minutes of expiry (and persisting the refreshed token). Throws if no
 * account is connected.
 */
export async function getValidWorkspaceToken(): Promise<string> {
  const conn = await getWorkspaceConnection();
  if (!conn) throw new Error("Google Workspace isn't connected");

  if (Date.now() < new Date(conn.expires_at).getTime() - 5 * 60 * 1000) {
    return conn.access_token;
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
    .from("google_workspace_connection")
    .update({
      access_token: tokens.access_token,
      // Google usually omits a new refresh_token on refresh — keep the old one.
      refresh_token: tokens.refresh_token ?? conn.refresh_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conn.id);

  return tokens.access_token;
}

/** Generate a strong, human-typeable temporary password. */
export function generateTempPassword(): string {
  // 3 url-safe-ish groups + symbol + digits; always satisfies Workspace's
  // default complexity (>= 8 chars, mixed). Avoids ambiguous characters.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const pick = (n: number) =>
    Array.from({ length: n }, () => alphabet[crypto.randomInt(alphabet.length)]).join("");
  return `${pick(4)}-${pick(4)}-${pick(4)}`;
}

/**
 * Look up a Workspace user by their primary email. Returns the user resource or
 * null if not found (404). Used for idempotency so provisioning never creates a
 * second account.
 */
export async function getWorkspaceUser(
  accessToken: string,
  email: string
): Promise<{ id: string; primaryEmail: string } | null> {
  const res = await fetch(`${DIRECTORY_USERS_URL}/${encodeURIComponent(email)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await directoryError(res, "Failed to look up Google user"));
  const data = await res.json();
  return { id: String(data.id), primaryEmail: String(data.primaryEmail) };
}

export type CreateWorkspaceUserArgs = {
  accessToken: string;
  primaryEmail: string;
  givenName: string;
  familyName: string;
  password: string;
  recoveryEmail?: string | null;
  recoveryPhone?: string | null; // E.164, e.g. +61412345678
  orgUnitPath?: string; // e.g. "/Staff"; defaults to "/"
  title?: string | null;
  department?: string | null;
  changePasswordAtNextLogin?: boolean; // default true
};

/**
 * Create a Google Workspace user via the Admin SDK Directory API. The connected
 * account must be a super-admin (or have user-management privileges) for this to
 * succeed. Returns the created user's id + primaryEmail.
 */
export async function createWorkspaceUser(
  args: CreateWorkspaceUserArgs
): Promise<{ id: string; primaryEmail: string }> {
  const body: Record<string, unknown> = {
    primaryEmail: args.primaryEmail,
    name: { givenName: args.givenName, familyName: args.familyName },
    password: args.password,
    changePasswordAtNextLogin: args.changePasswordAtNextLogin ?? true,
    orgUnitPath: args.orgUnitPath ?? "/",
  };
  if (args.recoveryEmail) body.recoveryEmail = args.recoveryEmail;
  // Google requires recoveryPhone in E.164 (+<countrycode><number>). A
  // malformed value would reject the WHOLE create, so only send it when valid;
  // otherwise silently omit it (the account is still created without it).
  if (args.recoveryPhone) {
    const phone = args.recoveryPhone.replace(/[\s()-]/g, "");
    if (/^\+\d{6,15}$/.test(phone)) body.recoveryPhone = phone;
  }
  if (args.title || args.department) {
    body.organizations = [
      {
        primary: true,
        ...(args.title ? { title: args.title } : {}),
        ...(args.department ? { department: args.department } : {}),
      },
    ];
  }

  const res = await fetch(DIRECTORY_USERS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await directoryError(res, "Failed to create Google account"));
  const data = await res.json();
  return { id: String(data.id), primaryEmail: String(data.primaryEmail) };
}

/** Pull a useful message out of a failed Directory API response. */
async function directoryError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null as unknown as { error?: { message?: string; errors?: { message?: string }[] } });
  const msg =
    body?.error?.errors?.[0]?.message ||
    body?.error?.message ||
    "";
  if (res.status === 403) {
    return `${msg || "Permission denied"} — the connected Google account must be a Workspace super-admin with the Admin SDK enabled.`;
  }
  if (res.status === 409 || /entity already exists|duplicate/i.test(msg)) {
    return `${msg || "A user with this email already exists."}`;
  }
  return msg || `${fallback} (${res.status})`;
}
