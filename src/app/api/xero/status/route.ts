import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("role")
    .eq("email", session.user?.email ?? "")
    .single();

  if (caller?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Try to read the granted scopes; fall back gracefully if the column is
  // absent (the xero_connection table may not have a `scopes` column).
  let conn: any = null;
  const withScopes = await supabaseAdmin
    .from("xero_connection")
    .select("tenant_id, tenant_name, connected_at, expires_at, scopes")
    .order("connected_at", { ascending: false })
    .limit(1)
    .single();

  if (withScopes.error) {
    const { data } = await supabaseAdmin
      .from("xero_connection")
      .select("tenant_id, tenant_name, connected_at, expires_at")
      .order("connected_at", { ascending: false })
      .limit(1)
      .single();
    conn = data;
  } else {
    conn = withScopes.data;
  }

  if (!conn) {
    return NextResponse.json({ connected: false });
  }

  const scopes: string = typeof conn.scopes === "string" ? conn.scopes : "";
  const scopeList = scopes.split(/\s+/).filter(Boolean);
  // If scopes were never stored we can't be certain — leave flags null so the
  // caller can distinguish "unknown" from "definitely missing".
  const hasScopeInfo = scopeList.length > 0;
  const hasAccountingAccess = hasScopeInfo
    ? scopeList.some((s) => s.startsWith("accounting."))
    : null;
  const hasPayrollAccess = hasScopeInfo
    ? scopeList.some((s) => s.startsWith("payroll."))
    : null;

  return NextResponse.json({
    connected: true,
    tenantName: conn.tenant_name,
    tenantId: conn.tenant_id,
    connectedAt: conn.connected_at,
    expiresAt: conn.expires_at,
    hasAccountingAccess,
    hasPayrollAccess,
  });
}
