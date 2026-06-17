import { supabaseAdmin } from "@/lib/supabase";

// A single, app-owned Google connection used for ALL contract-template work
// (read/copy/fill the template, export PDFs). Mirrors the Xero connection: one
// dedicated account authorises once, every admin generates through it. This
// reuses the existing Google OAuth client (GOOGLE_CLIENT_ID/SECRET) but is a
// separate, offline connection from per-user login.

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

// Drive + Docs (write) so the connection can copy/fill/export templates, plus
// openid/email so we can show which account is connected.
export const CONTRACTS_GOOGLE_SCOPE =
  "openid email https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/documents";

export function contractsRedirectUri(): string {
  return `${process.env.NEXTAUTH_URL}/api/contracts-google/callback`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  id_token?: string;
};

/** Exchange an authorization code for tokens (connect callback). */
export async function exchangeContractsCode(code: string): Promise<TokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: contractsRedirectUri(),
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
export async function getContractsConnection(): Promise<ConnectionRow | null> {
  const { data } = await supabaseAdmin
    .from("contracts_google_connection")
    .select("id, access_token, refresh_token, expires_at, connected_email, connected_at")
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as ConnectionRow | null) ?? null;
}

/**
 * Return a valid access token for the contracts connection, refreshing it when
 * it's within 5 minutes of expiry (and persisting the refreshed token). Throws
 * if no account is connected.
 */
export async function getValidContractsToken(): Promise<string> {
  const conn = await getContractsConnection();
  if (!conn) throw new Error("Google isn't connected for contracts");

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
    .from("contracts_google_connection")
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
