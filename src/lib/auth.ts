import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { saveGoogleTokensByEmail, getGoogleTokensByEmail } from "./google-tokens";

/** Persist Google tokens for a staff member so they can be used server-side
 *  (e.g. creating calendar events on behalf of a staff member when offline).
 *  Tokens live in the dedicated staff_google_tokens table, never on staff. */
async function saveTokensToStaff(email: string, accessToken: string, refreshToken: string | undefined, expiresAt: number) {
  try {
    await saveGoogleTokensByEmail(email, accessToken, refreshToken, expiresAt);
  } catch {
    // Best-effort — never block auth if DB write fails
  }
}

async function refreshAccessToken(token: Record<string, unknown>) {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken as string,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw data;
    const expires = Date.now() + data.expires_in * 1000;
    const refreshed = {
      ...token,
      accessToken: data.access_token,
      accessTokenExpires: expires,
      refreshToken: data.refresh_token ?? token.refreshToken,
      error: undefined,
    };
    // Persist refreshed tokens so offline calendar creation stays current
    if (token.email) {
      await saveTokensToStaff(token.email as string, data.access_token, data.refresh_token ?? token.refreshToken as string, expires);
    }
    return refreshed;
  } catch {
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/admin.directory.user.readonly",
          access_type: "offline",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (profile?.email?.endsWith("@fgam.org.au")) {
        return true;
      }
      return "/unauthorized";
    },
    async jwt({ token, account }) {
      // First sign-in: store tokens in JWT and persist to DB
      if (account) {
        const expires = account.expires_at ? account.expires_at * 1000 : Date.now() + 3600 * 1000;
        // Google only returns a refresh token on the very first consent. On
        // later sign-ins it's absent, so fall back to the one we stored
        // previously — otherwise silent refresh would break after re-login.
        let refreshToken = account.refresh_token ?? undefined;
        if (!refreshToken && token.email) {
          const stored = await getGoogleTokensByEmail(token.email as string);
          refreshToken = stored?.refresh_token ?? undefined;
        }
        if (token.email && account.access_token) {
          await saveTokensToStaff(token.email as string, account.access_token, refreshToken, expires);
        }
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken,
          accessTokenExpires: expires,
        };
      }
      // Token still valid — return as-is
      if (Date.now() < (token.accessTokenExpires as number) - 60_000) {
        return token;
      }
      // Token expired — refresh silently (also persists to DB inside refreshAccessToken)
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      session.error = token.error as string | undefined;
      return session;
    },
  },
  pages: {
    signIn: "/",
    error: "/unauthorized",
  },
});
