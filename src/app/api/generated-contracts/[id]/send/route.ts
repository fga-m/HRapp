import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { createNotification } from "@/lib/notifications";
import { exportDocAsPdf } from "@/lib/google-drive";
import { getValidContractsToken } from "@/lib/contracts-google";

export const dynamic = "force-dynamic";

// POST — push a generated contract into the e-sign flow: export the filled Doc
// to PDF, store it as a contract, assign it to the employee, and notify them.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    .select("id, google_doc_id, recipient_name, staff_id, contract_id, contract_templates(title)")
    .eq("id", id)
    .single();
  if (!gen) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Already sent — return the existing contract rather than duplicating.
  if (gen.contract_id) {
    return NextResponse.json({ contract_id: gen.contract_id, already_sent: true });
  }
  if (!gen.staff_id) {
    return NextResponse.json(
      { error: "Link this row to a staff member before sending it for signing." },
      { status: 400 }
    );
  }

  // Export the live Doc so any edits are captured in the signed PDF.
  let pdf: Buffer;
  try {
    const token = await getValidContractsToken();
    pdf = await exportDocAsPdf(token, gen.google_doc_id);
  } catch {
    return NextResponse.json({ error: "Couldn't export the contract as a PDF." }, { status: 502 });
  }

  const templateTitle = (gen.contract_templates as { title?: string } | null)?.title ?? "Contract";
  const title = `${gen.recipient_name} — ${templateTitle}`;
  const safeName = title.replace(/[^a-zA-Z0-9.-]/g, "_");
  const storageName = `${Date.now()}-${safeName}.pdf`;

  const { data: upload, error: uploadError } = await supabaseAdmin.storage
    .from("contracts")
    .upload(storageName, pdf, { contentType: "application/pdf", upsert: false });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  // Standalone contract (its own group), mirroring the upload flow.
  const { data: group, error: groupError } = await supabaseAdmin
    .from("contract_groups")
    .insert({ title, created_by: caller.id })
    .select()
    .single();
  if (groupError) return NextResponse.json({ error: groupError.message }, { status: 500 });

  const { data: contract, error: contractError } = await supabaseAdmin
    .from("contracts")
    .insert({
      title,
      file_path: upload.path,
      file_name: `${safeName}.pdf`,
      created_by: caller.id,
      group_id: group.id,
      version: 1,
    })
    .select()
    .single();
  if (contractError) return NextResponse.json({ error: contractError.message }, { status: 500 });

  const { error: assignError } = await supabaseAdmin
    .from("contract_assignments")
    .upsert(
      { contract_id: contract.id, staff_id: gen.staff_id, assigned_by: caller.id },
      { onConflict: "contract_id,staff_id" }
    );
  if (assignError) return NextResponse.json({ error: assignError.message }, { status: 500 });

  await createNotification({
    staff_id: gen.staff_id,
    title: `Contract to sign: "${title}"`,
    message: "You have been assigned a contract that requires your e-signature. Please review and sign it.",
    type: "contract",
    link: `/dashboard/contracts/${contract.id}`,
    is_read: false,
  });

  await supabaseAdmin
    .from("generated_contracts")
    .update({ contract_id: contract.id })
    .eq("id", id);

  return NextResponse.json({ contract_id: contract.id }, { status: 201 });
}
