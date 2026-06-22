import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { cookies } from "next/headers";
import crypto from "crypto";
import { GOOGLE_AUTH_URL, GOOGLE_MAIL_SCOPE, mailRedirectUri } from "@/lib/google-mail";

export const dynamic = "force-dynamic";

// GET — start OAuth to connect the account the app sends email FROM (e.g.
// hrapp@fgam.org.au). Admin only.
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("role")
    .eq("email", session.user?.email ?? "")
    .single();
  if (caller?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const state = crypto.randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set("mail_google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: mailRedirectUri(),
    scope: GOOGLE_MAIL_SCOPE,
    access_type: "offline",
    prompt: "select_account consent",
    state,
  });

  return NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
}
