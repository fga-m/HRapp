import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { suggestion } = await req.json();

  if (!suggestion?.trim()) return NextResponse.json({ error: "Suggestion is required" }, { status: 400 });

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, full_name")
    .eq("email", session.user?.email)
    .single();

  if (!caller) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: note } = await supabaseAdmin
    .from("meeting_notes")
    .select("title, created_by")
    .eq("id", id)
    .single();

  const { data, error } = await supabaseAdmin
    .from("meeting_note_suggestions")
    .insert({ meeting_note_id: id, staff_id: caller.id, suggestion: suggestion.trim() })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify the note creator
  if (note?.created_by) {
    await supabaseAdmin.from("notifications").insert({
      staff_id: note.created_by,
      title: "Change Suggested on Meeting Notes",
      message: `${caller.full_name} has suggested a change to "${note?.title}": "${suggestion.trim().slice(0, 80)}${suggestion.length > 80 ? "..." : ""}"`,
      type: "meeting",
      reference_id: id,
    });
  }

  return NextResponse.json(data, { status: 201 });
}
