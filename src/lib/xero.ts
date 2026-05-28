import { supabaseAdmin } from "@/lib/supabase";

const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
const XERO_CONNECTIONS_URL = "https://api.xero.com/connections";

function basicAuth() {
  const credentials = `${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`;
  return Buffer.from(credentials).toString("base64");
}

export async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const res = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }
  return res.json() as Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
    scope: string;
  }>;
}

export async function refreshXeroToken(refreshToken: string) {
  const res = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed: ${err}`);
  }
  return res.json() as Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }>;
}

export async function getXeroTenants(accessToken: string) {
  const res = await fetch(XERO_CONNECTIONS_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error("Failed to fetch Xero tenants");
  return res.json() as Promise<
    Array<{ id: string; tenantId: string; tenantType: string; tenantName: string }>
  >;
}

/** Returns a valid access token, refreshing if needed. Throws if not connected. */
export async function getValidXeroToken(): Promise<{ accessToken: string; tenantId: string }> {
  const { data: conn, error } = await supabaseAdmin
    .from("xero_connection")
    .select("*")
    .order("connected_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !conn) throw new Error("Xero not connected");

  // If token expires in more than 5 minutes, use it as-is
  const expiresAt = new Date(conn.expires_at).getTime();
  if (Date.now() < expiresAt - 5 * 60 * 1000) {
    return { accessToken: conn.access_token, tenantId: conn.tenant_id };
  }

  // Refresh
  const tokens = await refreshXeroToken(conn.refresh_token);
  const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  await supabaseAdmin
    .from("xero_connection")
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conn.id);

  return { accessToken: tokens.access_token, tenantId: conn.tenant_id };
}

/** Make an authenticated request to the Xero API */
export async function xeroRequest(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const { accessToken, tenantId } = await getValidXeroToken();
  return fetch(`https://api.xero.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Xero-Tenant-Id": tenantId,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers ?? {}),
    },
  });
}
