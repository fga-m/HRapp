import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { exportDocAsPdf } from "@/lib/google-drive";
import { getValidContractsToken } from "@/lib/contracts-google";

export const dynamic = "force-dynamic";

// GET — export the (possibly edited) filled Doc as a PDF and stream it back as
// a download. Exporting live means any edits the admin made in Google are
// captured.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session.user?.email)
    .single();
  if (caller?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { data: gen } = await supabaseAdmin
    .from("generated_contracts")
    .select("google_doc_id, recipient_name")
    .eq("id", id)
    .single();
  if (!gen) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let pdf: Buffer;
  try {
    const token = await getValidContractsToken();
    pdf = await exportDocAsPdf(token, gen.google_doc_id);
  } catch {
    return NextResponse.json({ error: "Couldn't export the contract as a PDF." }, { status: 502 });
  }

  const safeName = (gen.recipient_name || "contract").replace(/[^a-zA-Z0-9.-]/g, "_");
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
    },
  });
}
