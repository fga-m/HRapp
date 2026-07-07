import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCaller } from "@/lib/caller";
import { supabaseAdmin } from "@/lib/supabase";
import { createMeetingDoc } from "@/lib/google-drive";

async function callerCanDo(callerRole: string, feature: string): Promise<boolean> {
  if (callerRole === "admin") return true;
  if (callerRole !== "manager") return false;
  const { data } = await supabaseAdmin
    .from("role_permissions")
    .select("enabled")
    .eq("role", "manager")
    .eq("feature", feature)
    .single();
  return data?.enabled ?? false;
}

export async function GET() {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let data, error;

  const canManage = await callerCanDo(caller.role, "manage_meetings");

  if (canManage) {
    // Admins and managers with manage_meetings see their own created notes
    ({ data, error } = await supabaseAdmin
      .from("meeting_notes")
      .select("*, creator:staff!meeting_notes_created_by_fkey(full_name)")
      .eq("created_by", caller.id)
      .order("meeting_date", { ascending: false }));
  } else {
    // Staff see notes shared with them
    ({ data, error } = await supabaseAdmin
      .from("meeting_notes")
      .select("*, creator:staff!meeting_notes_created_by_fkey(full_name)")
      .eq("is_shared_with_staff", true)
      .contains("attendees", [caller.id])
      .order("meeting_date", { ascending: false }));
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notes: data, role: caller.role, staffId: caller.id, canManage });
}

export async function POST(req: NextRequest) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await callerCanDo(caller.role, "manage_meetings"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { title, meeting_type, meeting_date, attendees, content } = body;

  if (!title || !meeting_type || !meeting_date) {
    return NextResponse.json({ error: "Title, type and date are required" }, { status: 400 });
  }

  // Get primary attendee name for folder structure
  let primaryStaffName = "General";
  if (attendees?.length) {
    const { data: staffMember } = await supabaseAdmin
      .from("staff")
      .select("full_name")
      .eq("id", attendees[0])
      .single();
    if (staffMember) primaryStaffName = staffMember.full_name;
  }

  // Create Google Doc in admin's Drive
  let fileId = null;
  let fileUrl = null;
  try {
    const doc = await createMeetingDoc({
      accessToken: session.accessToken,
      meetingType: meeting_type,
      staffName: primaryStaffName,
      date: meeting_date,
      title,
      content: content || "",
    });
    fileId = doc.fileId;
    fileUrl = doc.fileUrl;
  } catch (err) {
    console.error("Drive error:", err);
    // Continue without Drive if it fails
  }

  const { data, error } = await supabaseAdmin
    .from("meeting_notes")
    .insert({
      title,
      meeting_type,
      meeting_date,
      attendees: attendees || [],
      content: content || null,
      drive_file_id: fileId,
      drive_file_url: fileUrl,
      created_by: caller.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
