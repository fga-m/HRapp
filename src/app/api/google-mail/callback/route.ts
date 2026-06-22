import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { cookies } from "next/headers";
import { exchangeMailCode, getConnectedEmail } from "@/lib/google-mail";

export const dynamic = "force-dynamic";

const DEST = "/dashboard/settings";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.redirect(new URL("/", req.url));

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session.user?.email ?? "")
    .single();
  if (caller?.role !== "admin") return NextResponse.redirect(new URL("/dashboard", req.url));

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`${DEST}?gmail_error=${encodeURIComponent(reason)}`, req.url));

  if (error) return fail(error);
  if (!code || !state) return fail("missing_params");

  const cookieStore = await cookies();
  const storedState = cookieStore.get("mail_google_oauth_state")?.value;
  cookieStore.delete("mail_google_oauth_state");
  if (!storedState || storedState !== state) return fail("invalid_state");

  try {
    const tokens = await exchangeMailCode(code);
    if (!tokens.refresh_token) return fail("no_refresh_token");
    const email = await getConnectedEmail(tokens.access_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    await supabaseAdmin
      .from("google_mail_connection")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    const { error: dbError } = await supabaseAdmin.from("google_mail_connection").insert({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      connected_email: email,
      connected_by: caller.id,
    });
    if (dbError) throw new Error(dbError.message);

    return NextResponse.redirect(new URL(`${DEST}?gmail_connected=1`, req.url));
  } catch (err) {
    return fail(err instanceof Error ? err.message : "unknown");
  }
}
