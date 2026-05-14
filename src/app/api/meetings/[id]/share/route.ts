import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { shareFileWithUser } from "@/lib/google-drive";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role, full_name")
    .eq("email", session.user?.email)
    .single();

  if (caller?.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const { data: note } = await supabaseAdmin
    .from("meeting_notes")
    .select("*")
    .eq("id", id)
    .eq("created_by", caller.id)
    .single();

  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Share Drive file with each attendee
  if (note.drive_file_id && note.attendees?.length) {
    const { data: attendees } = await supabaseAdmin
      .from("staff")
      .select("email")
      .in("id", note.attendees);

    for (const attendee of attendees || []) {
      try {
        await shareFileWithUser(session.accessToken, note.drive_file_id, attendee.email);
      } catch (err) {
        console.error("Share error:", err);
      }
    }
  }

  // Mark as shared in DB
  await supabaseAdmin
    .from("meeting_notes")
    .update({ is_shared_with_staff: true })
    .eq("id", id);

  // Notify attendees
  if (note.attendees?.length) {
    await supabaseAdmin.from("notifications").insert(
      note.attendees.map((staffId: string) => ({
        staff_id: staffId,
        title: `${caller.full_name} shared a meeting summary with you`,
        message: `"${note.title}" — please read and acknowledge that you've received it.`,
        type: "meeting",
        reference_id: id,
      }))
    );
  }

  return NextResponse.json({ success: true });
}
