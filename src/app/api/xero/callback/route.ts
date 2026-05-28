import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { cookies } from "next/headers";
import { exchangeCodeForTokens, getXeroTenants } from "@/lib/xero";

export const dynamic = "force-dynamic";

const REDIRECT_URI = `${process.env.NEXTAUTH_URL}/api/xero/callback`;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.redirect(new URL("/", req.url));

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session.user?.email ?? "")
    .single();

  if (caller?.role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/dashboard/settings?xero_error=${encodeURIComponent(error)}`, req.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?xero_error=missing_params", req.url)
    );
  }

  // Validate CSRF state
  const cookieStore = await cookies();
  const storedState = cookieStore.get("xero_oauth_state")?.value;
  cookieStore.delete("xero_oauth_state");

  if (!storedState || storedState !== state) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?xero_error=invalid_state", req.url)
    );
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code, REDIRECT_URI);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Get connected tenants (organisations)
    const tenants = await getXeroTenants(tokens.access_token);
    if (!tenants.length) {
      return NextResponse.redirect(
        new URL("/dashboard/settings?xero_error=no_tenants", req.url)
      );
    }

    // Use first tenant (most orgs only have one)
    const tenant = tenants[0];

    // Upsert connection — only one connection record
    const { error: dbError } = await supabaseAdmin
      .from("xero_connection")
      .upsert(
        {
          tenant_id: tenant.tenantId,
          tenant_name: tenant.tenantName,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: expiresAt,
          connected_by: caller.id,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id" }
      );

    if (dbError) throw new Error(dbError.message);

    return NextResponse.redirect(
      new URL("/dashboard/settings?xero_connected=1", req.url)
    );
  } catch (err: any) {
    console.error("Xero callback error:", err);
    return NextResponse.redirect(
      new URL(`/dashboard/settings?xero_error=${encodeURIComponent(err.message ?? "unknown")}`, req.url)
    );
  }
}
