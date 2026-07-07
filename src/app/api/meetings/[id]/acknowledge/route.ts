import { NextRequest, NextResponse } from "next/server";
import { getCaller } from "@/lib/caller";
import { supabaseAdmin } from "@/lib/supabase";
import { createNotification } from "@/lib/notifications";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: note } = await supabaseAdmin
    .from("meeting_notes")
    .select("title, created_by")
    .eq("id", id)
    .single();

  const { data, error } = await supabaseAdmin
    .from("meeting_note_acknowledgements")
    .insert({ meeting_note_id: id, staff_id: caller.id })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "Already acknowledged" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Notify the note creator
  if (note?.created_by) {
    await createNotification({
      staff_id: note.created_by,
      title: `${caller.fullName} acknowledged your meeting summary`,
      message: `"${note?.title}" has been read and acknowledged.`,
      type: "meeting",
      reference_id: id,
    });
  }

  return NextResponse.json(data, { status: 201 });
}
