import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getContractsConnection } from "@/lib/contracts-google";

export const dynamic = "force-dynamic";

// GET — is a Google account connected for contracts, and which one. Admin only.
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("role")
    .eq("email", session.user?.email ?? "")
    .single();
  if (caller?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const conn = await getContractsConnection();
  return NextResponse.json({
    connected: !!conn,
    email: conn?.connected_email ?? null,
    connectedAt: conn?.connected_at ?? null,
  });
}
