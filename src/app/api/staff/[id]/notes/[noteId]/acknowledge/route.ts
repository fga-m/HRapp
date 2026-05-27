import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string; noteId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, noteId } = await params;

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session.user?.email)
    .single();

  if (!caller) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only the staff member themselves can acknowledge their own note
  if (caller.id !== id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: note } = await supabaseAdmin
    .from("performance_notes")
    .select("is_visible_to_staff, acknowledged_at")
    .eq("id", noteId)
    .eq("staff_id", id)
    .single();

  if (!note) return NextResponse.json({ error: "Note not found" }, { status: 404 });
  if (!note.is_visible_to_staff) return NextResponse.json({ error: "Note is not visible" }, { status: 403 });
  if (note.acknowledged_at) return NextResponse.json({ error: "Already acknowledged" }, { status: 409 });

  const { data, error } = await supabaseAdmin
    .from("performance_notes")
    .update({ acknowledged_at: new Date().toISOString() })
    .eq("id", noteId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
