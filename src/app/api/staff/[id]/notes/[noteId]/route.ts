import { NextRequest, NextResponse } from "next/server";
import { getCaller } from "@/lib/caller";
import { supabaseAdmin } from "@/lib/supabase";
import { createNotification } from "@/lib/notifications";

type Params = { params: Promise<{ id: string; noteId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, noteId } = await params;

  // Only admin or the note's author can edit
  const { data: note } = await supabaseAdmin
    .from("performance_notes")
    .select("author_id, staff_id, is_visible_to_staff")
    .eq("id", noteId)
    .eq("staff_id", id)
    .single();

  if (!note) return NextResponse.json({ error: "Note not found" }, { status: 404 });
  if (!caller.isAdmin && caller.id !== note.author_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const update: Record<string, any> = { updated_at: new Date().toISOString() };
  if (body.content !== undefined) update.content = body.content.trim();
  if (body.is_visible_to_staff !== undefined) {
    update.is_visible_to_staff = body.is_visible_to_staff;
    // Clear acknowledgement if toggling to hidden
    if (!body.is_visible_to_staff) update.acknowledged_at = null;
    // Notify staff when newly made visible
    if (body.is_visible_to_staff && !note.is_visible_to_staff) {
      await createNotification({
        staff_id: id,
        title: "New performance note",
        message: "A manager has shared a note on your profile.",
        category: "performance",
        link: `/dashboard/staff/${id}`,
        is_read: false,
      });
    }
  }

  const { data, error } = await supabaseAdmin
    .from("performance_notes")
    .update(update)
    .eq("id", noteId)
    .select(`*, author:staff!performance_notes_author_id_fkey(id, full_name, avatar_url)`)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, noteId } = await params;

  const { data: note } = await supabaseAdmin
    .from("performance_notes")
    .select("author_id")
    .eq("id", noteId)
    .eq("staff_id", id)
    .single();

  if (!note) return NextResponse.json({ error: "Note not found" }, { status: 404 });
  if (!caller.isAdmin && caller.id !== note.author_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabaseAdmin.from("performance_notes").delete().eq("id", noteId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
