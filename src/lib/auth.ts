import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/admin.directory.user.readonly",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      // Restrict to @fgam.org.au accounts only
      if (profile?.email?.endsWith("@fgam.org.au")) {
        return true;
      }
      return "/unauthorized";
    },
    async jwt({ token, account }) {
      // Persist the access token for Google API calls
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      return session;
    },
  },
  pages: {
    signIn: "/",
    error: "/unauthorized",
  },
});
