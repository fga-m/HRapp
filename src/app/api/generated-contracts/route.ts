import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET — recent generated contracts (admin only), grouped into batches for the
// "revisit / edit / export later" UI.
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session.user?.email)
    .single();
  if (caller?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from("generated_contracts")
    .select("id, batch_id, batch_label, template_id, staff_id, recipient_name, google_doc_url, contract_id, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Group rows into batches (most recent first), preserving order.
  const batches: { batch_id: string; batch_label: string | null; created_at: string; items: unknown[] }[] = [];
  const index = new Map<string, number>();
  for (const row of data ?? []) {
    let i = index.get(row.batch_id);
    if (i === undefined) {
      i = batches.length;
      index.set(row.batch_id, i);
      batches.push({
        batch_id: row.batch_id,
        batch_label: row.batch_label,
        created_at: row.created_at,
        items: [],
      });
    }
    batches[i].items.push(row);
  }

  return NextResponse.json({ batches });
}
