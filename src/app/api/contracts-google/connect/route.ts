import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { cookies } from "next/headers";
import crypto from "crypto";
import { GOOGLE_AUTH_URL, CONTRACTS_GOOGLE_SCOPE, contractsRedirectUri } from "@/lib/contracts-google";

export const dynamic = "force-dynamic";

// GET — start the OAuth flow to connect the org's contract-generation Google
// account. Admin only. Sign in on Google's screen as the dedicated account
// (e.g. hrapp@fgam.org.au) that holds the templates.
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
  cookieStore.set("contracts_google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: contractsRedirectUri(),
    scope: CONTRACTS_GOOGLE_SCOPE,
    access_type: "offline",
    prompt: "select_account consent", // let them pick the dedicated account + grant offline access
    state,
  });

  return NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
}
