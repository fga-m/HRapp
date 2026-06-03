import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, docId } = await params;

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session.user?.email ?? "")
    .single();

  if (!caller) return NextResponse.json({ error: "Staff not found" }, { status: 404 });

  // Permission check: admin or manager with manage_staff
  let canDelete = caller.role === "admin";
  if (caller.role === "manager") {
    const { data: perm } = await supabaseAdmin
      .from("role_permissions")
      .select("enabled")
      .eq("role", "manager")
      .eq("feature", "manage_staff")
      .single();
    canDelete = perm?.enabled ?? false;
  }

  if (!canDelete) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Fetch the document to get the file_path
  const { data: doc, error: fetchError } = await supabaseAdmin
    .from("staff_documents")
    .select("*")
    .eq("id", docId)
    .eq("staff_id", id)
    .single();

  if (fetchError || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Delete from storage
  const { error: storageError } = await supabaseAdmin.storage
    .from("staff-documents")
    .remove([doc.file_path]);

  if (storageError) {
    return NextResponse.json({ error: storageError.message }, { status: 500 });
  }

  // Delete from DB
  const { error: dbError } = await supabaseAdmin
    .from("staff_documents")
    .delete()
    .eq("id", docId);

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

// PATCH — update visibility (uploader or admin only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, docId } = await params;

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session.user?.email ?? "")
    .single();

  if (!caller) return NextResponse.json({ error: "Staff not found" }, { status: 404 });

  // Fetch the document
  const { data: doc } = await supabaseAdmin
    .from("staff_documents")
    .select("uploaded_by")
    .eq("id", docId)
    .eq("staff_id", id)
    .single();

  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  // Only the uploader or an admin can change visibility
  const canEdit = caller.role === "admin" || caller.id === doc.uploaded_by;
  if (!canEdit) return NextResponse.json({ error: "Only the uploader or an admin can change visibility" }, { status: 403 });

  const { visibility } = await req.json();
  if (!Array.isArray(visibility)) return NextResponse.json({ error: "visibility must be an array" }, { status: 400 });

  // Ensure 'admin' is always present
  const safe = visibility.includes("admin") ? visibility : ["admin", ...visibility];

  const { data, error } = await supabaseAdmin
    .from("staff_documents")
    .update({ visibility: safe })
    .eq("id", docId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
