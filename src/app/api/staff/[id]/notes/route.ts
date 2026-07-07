import { NextRequest, NextResponse } from "next/server";
import { getCaller } from "@/lib/caller";
import { supabaseAdmin } from "@/lib/supabase";
import { createNotification } from "@/lib/notifications";

async function canManageNotes(role: string): Promise<boolean> {
  if (role === "admin") return true;
  if (role !== "manager") return false;
  const { data } = await supabaseAdmin
    .from("role_permissions")
    .select("enabled")
    .eq("role", "manager")
    .eq("feature", "manage_staff")
    .single();
  return data?.enabled ?? false;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const isManager = await canManageNotes(caller.role);

  if (isManager) {
    // Managers/admins see all notes for this staff member
    const { data: notes, error } = await supabaseAdmin
      .from("performance_notes")
      .select(`*, author:staff!performance_notes_author_id_fkey(id, full_name, avatar_url)`)
      .eq("staff_id", id)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ notes: notes ?? [], role: caller.role, callerId: caller.id });
  } else {
    // Staff can only see their own visible notes
    if (caller.id !== id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { data: notes, error } = await supabaseAdmin
      .from("performance_notes")
      .select(`*, author:staff!performance_notes_author_id_fkey(id, full_name, avatar_url)`)
      .eq("staff_id", id)
      .eq("is_visible_to_staff", true)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ notes: notes ?? [], role: caller.role, callerId: caller.id });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  if (!(await canManageNotes(caller.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { content, is_visible_to_staff } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: "Content is required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("performance_notes")
    .insert({
      staff_id: id,
      author_id: caller.id,
      content: content.trim(),
      is_visible_to_staff: is_visible_to_staff ?? false,
    })
    .select(`*, author:staff!performance_notes_author_id_fkey(id, full_name, avatar_url)`)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify staff if visible
  if (is_visible_to_staff) {
    await createNotification({
      staff_id: id,
      title: "New performance note",
      message: "A manager has left a note on your profile.",
      category: "performance",
      link: `/dashboard/staff/${id}`,
      is_read: false,
    });
  }

  return NextResponse.json(data, { status: 201 });
}
