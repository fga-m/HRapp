import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session.user?.email)
    .single();

  if (!caller) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: note, error } = await supabaseAdmin
    .from("meeting_notes")
    .select("*, creator:staff!meeting_notes_created_by_fkey(full_name, email)")
    .eq("id", id)
    .single();

  if (error || !note) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Access control (deny-by-default): only the note's creator, or a shared
  // attendee, may read it. Previously roles other than admin/staff (e.g.
  // manager, leave_approver) fell through both checks and saw every note.
  const isCreator = note.created_by === caller.id;
  const isSharedAttendee = !!note.is_shared_with_staff && !!note.attendees?.includes(caller.id);
  if (!isCreator && !isSharedAttendee) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get attendee details
  const { data: attendeeDetails } = await supabaseAdmin
    .from("staff")
    .select("id, full_name, email, avatar_url")
    .in("id", note.attendees?.length ? note.attendees : ["00000000-0000-0000-0000-000000000000"]);

  // Get acknowledgement
  const { data: ack } = await supabaseAdmin
    .from("meeting_note_acknowledgements")
    .select("*")
    .eq("meeting_note_id", id)
    .eq("staff_id", caller.id)
    .maybeSingle();

  // Get suggestions
  const { data: suggestions } = await supabaseAdmin
    .from("meeting_note_suggestions")
    .select("*, staff:staff(full_name)")
    .eq("meeting_note_id", id)
    .order("created_at");

  return NextResponse.json({
    note,
    attendees: attendeeDetails || [],
    myAck: ack || null,
    suggestions: suggestions || [],
    role: caller.role,
    staffId: caller.id,
    // The note's creator manages it (share, view suggestions); everyone else is
    // a shared attendee who can acknowledge/respond.
    canManage: note.created_by === caller.id,
  });
}
