import { NextRequest, NextResponse } from "next/server";
import { getCaller, callerCan } from "@/lib/caller";
import { supabaseAdmin } from "@/lib/supabase";
import { createNotification } from "@/lib/notifications";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const hasManageStaff = callerCan(caller, "manage_staff");

  // Access check: admin, manager with manage_staff, or own profile
  const canView =
    caller.isAdmin || hasManageStaff || caller.id === id;

  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: docs, error } = await supabaseAdmin
    .from("staff_documents")
    .select("*, uploader:uploaded_by(full_name)")
    .eq("staff_id", id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Filter by visibility:
  // - admin: sees everything
  // - manager with manage_staff: sees docs where visibility includes 'manager'
  // - self: sees docs where visibility includes 'self'
  const filtered = (docs ?? []).filter((doc: any) => {
    const vis: string[] = doc.visibility ?? ["admin", "self"];
    if (caller.isAdmin) return true;
    if (hasManageStaff && vis.includes("manager")) return true;
    if (caller.id === id && vis.includes("self")) return true;
    return false;
  });

  // Generate signed URLs for visible documents
  const documents = await Promise.all(
    filtered.map(async (doc: any) => {
      const { data: signed } = await supabaseAdmin.storage
        .from("staff-documents")
        .createSignedUrl(doc.file_path, 3600);
      return { ...doc, signedUrl: signed?.signedUrl ?? null };
    })
  );

  return NextResponse.json({ documents });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const hasManageStaff = callerCan(caller, "manage_staff");

  // Only admin or manager with manage_staff
  if (!caller.isAdmin && !hasManageStaff) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const title = formData.get("title") as string;
  const category = (formData.get("category") as string) || "other";
  const file = formData.get("file") as File | null;
  const expiryDateRaw = formData.get("expiry_date") as string | null;
  const notes = formData.get("notes") as string | null;
  // Visibility: comma-separated list e.g. "admin,self,manager"
  const visibilityRaw = formData.get("visibility") as string | null;
  const visibility = visibilityRaw
    ? visibilityRaw.split(",").map(v => v.trim()).filter(Boolean)
    : ["admin", "self"]; // default: HR Admin + Employee
  // Ensure 'admin' is always included
  if (!visibility.includes("admin")) visibility.unshift("admin");

  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  if (!file) return NextResponse.json({ error: "File is required" }, { status: 400 });

  // Sanitise filename and build storage path
  const sanitisedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${id}/${Date.now()}-${sanitisedName}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
    .from("staff-documents")
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const expiryDate = expiryDateRaw && expiryDateRaw.trim() ? expiryDateRaw.trim() : null;

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("staff_documents")
    .insert({
      staff_id: id,
      title,
      category,
      file_path: uploadData.path,
      file_name: file.name,
      expiry_date: expiryDate,
      notes: notes || null,
      uploaded_by: caller.id,
      visibility,
    })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // Fetch the staff member's name for notifications
  const { data: staffMember } = await supabaseAdmin
    .from("staff")
    .select("full_name")
    .eq("id", id)
    .single();

  const staffName = staffMember?.full_name ?? "Staff member";

  // Always notify the staff member that a document was added
  await createNotification({
    staff_id: id,
    title: "New document added to your profile",
    message: `A new document was added to your profile: ${title}`,
    type: "general",
    category: "document",
    link: `/dashboard/staff/${id}`,
    is_read: false,
  });

  // Check if expiry date is within 30 days from today
  if (expiryDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / msPerDay);

    if (daysUntilExpiry <= 30) {
      const formattedDate = expiry.toLocaleDateString("en-AU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      // Notify the staff member about expiry
      await createNotification({
        staff_id: id,
        title: `${title} expiring soon`,
        message: `Your ${title} expires on ${formattedDate} — please renew it soon.`,
        type: "general",
        category: "document",
        link: `/dashboard/staff/${id}`,
        is_read: false,
      });

      // Notify all admins (excluding the uploader)
      const { data: admins } = await supabaseAdmin
        .from("staff")
        .select("id")
        .eq("role", "admin")
        .eq("is_active", true)
        .neq("id", caller.id);

      if (admins && admins.length > 0) {
        await createNotification(
          admins.map((a: any) => ({
            staff_id: a.id,
            title: `${staffName}'s ${title} expiring soon`,
            message: `${staffName}'s ${title} expires on ${formattedDate}.`,
            type: "general",
            category: "document",
            link: `/dashboard/staff/${id}`,
            is_read: false,
          }))
        );
      }
    }
  }

  return NextResponse.json(inserted, { status: 201 });
}
