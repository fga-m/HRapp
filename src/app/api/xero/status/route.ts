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

  const { data: conn } = await supabaseAdmin
    .from("xero_connection")
    .select("tenant_id, tenant_name, connected_at, expires_at")
    .order("connected_at", { ascending: false })
    .limit(1)
    .single();

  if (!conn) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    tenantName: conn.tenant_name,
    tenantId: conn.tenant_id,
    connectedAt: conn.connected_at,
    expiresAt: conn.expires_at,
  });
}
