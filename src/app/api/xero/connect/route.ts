import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { cookies } from "next/headers";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const XERO_AUTH_URL = "https://login.xero.com/identity/connect/authorize";
const SCOPES = "openid profile email offline_access payroll.employees payroll.settings.read";
const REDIRECT_URI = `${process.env.NEXTAUTH_URL}/api/xero/callback`;

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only admins can connect Xero
  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("role")
    .eq("email", session.user?.email ?? "")
    .single();

  if (caller?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Generate CSRF state token
  const state = crypto.randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set("xero_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.XERO_CLIENT_ID!,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    state,
  });

  return NextResponse.redirect(`${XERO_AUTH_URL}?${params.toString()}`);
}
