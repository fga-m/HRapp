import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCaller } from "@/lib/caller";
import { supabaseAdmin } from "@/lib/supabase";
import { createNotification } from "@/lib/notifications";
import { shareFileWithUser } from "@/lib/google-drive";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  if (!caller.isAdmin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

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
    await createNotification(
      note.attendees.map((staffId: string) => ({
        staff_id: staffId,
        title: `${caller.fullName} shared a meeting summary with you`,
        message: `"${note.title}" — please read and acknowledge that you've received it.`,
        type: "meeting",
        reference_id: id,
      }))
    );
  }

  return NextResponse.json({ success: true });
}
