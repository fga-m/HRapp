import { supabaseAdmin } from "./supabase";

/** Stored Google OAuth tokens for a staff member. Lives in its own table
 *  (staff_google_tokens) so no staff/directory query can ever expose it. */
export type GoogleTokens = {
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
};

/** Upsert tokens for a staff member identified by their primary key. When
 *  refreshToken is undefined the existing stored refresh token is preserved
 *  (Google only returns it on the first consent). */
export async function saveGoogleTokensByStaffId(
  staffId: string,
  accessToken: string,
  refreshToken: string | undefined,
  expiresAt: number
) {
  await supabaseAdmin.from("staff_google_tokens").upsert(
    {
      staff_id: staffId,
      access_token: accessToken,
      ...(refreshToken ? { refresh_token: refreshToken } : {}),
      token_expires_at: new Date(expiresAt).toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "staff_id" }
  );
}

/** Upsert tokens for a staff member identified by email (resolves the id
 *  first). No-op if no staff row matches — mirrors the previous best-effort
 *  behaviour of the auth flow. */
export async function saveGoogleTokensByEmail(
  email: string,
  accessToken: string,
  refreshToken: string | undefined,
  expiresAt: number
) {
  const { data: staff } = await supabaseAdmin
    .from("staff")
    .select("id")
    .eq("email", email)
    .single();
  if (!staff?.id) return;
  await saveGoogleTokensByStaffId(staff.id, accessToken, refreshToken, expiresAt);
}

/** Read stored tokens for a staff member, or null if none are stored. */
export async function getGoogleTokensByStaffId(
  staffId: string
): Promise<GoogleTokens | null> {
  const { data } = await supabaseAdmin
    .from("staff_google_tokens")
    .select("access_token, refresh_token, token_expires_at")
    .eq("staff_id", staffId)
    .maybeSingle();
  return data ?? null;
}

/** Read stored tokens for a staff member by email, or null if none are
 *  stored (or no staff row matches). Mirrors saveGoogleTokensByEmail. */
export async function getGoogleTokensByEmail(
  email: string
): Promise<GoogleTokens | null> {
  const { data: staff } = await supabaseAdmin
    .from("staff")
    .select("id")
    .eq("email", email)
    .single();
  if (!staff?.id) return null;
  return getGoogleTokensByStaffId(staff.id);
}
