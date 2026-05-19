import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session.user?.email)
    .single();

  if (!caller) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const meetingType = searchParams.get("meeting_type");

  let query = supabaseAdmin
    .from("meeting_templates")
    .select("*, created_by_staff:staff!meeting_templates_created_by_fkey(full_name)")
    .order("created_at", { ascending: true });

  if (meetingType) {
    query = query.eq("meeting_type", meetingType);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ templates: data, role: caller.role });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session.user?.email)
    .single();

  if (caller?.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const { title, meeting_type, content } = await req.json();

  if (!title || !meeting_type) {
    return NextResponse.json({ error: "Title and meeting type are required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("meeting_templates")
    .insert({
      title,
      meeting_type,
      content: content ?? "",
      created_by: caller.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
