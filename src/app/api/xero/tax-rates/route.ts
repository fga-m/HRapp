import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { listTaxRates } from "@/lib/xero";

export const dynamic = "force-dynamic";

// GET /api/xero/tax-rates — list active tax rates that can apply to expenses.
// Any authenticated staff member.
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session.user?.email ?? "")
    .single();

  if (!caller) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const taxRates = await listTaxRates();
    return NextResponse.json({ taxRates });
  } catch (err: any) {
    const message = err?.message ?? "Failed to load Xero tax rates";
    if (/not connected/i.test(message)) {
      return NextResponse.json({ error: "Xero not connected" }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
