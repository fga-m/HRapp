import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { data, error } = await supabaseAdmin.from("staff").select("*").eq("id", id).single();
  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabaseAdmin
    .from("staff").select("role").eq("email", session.user?.email).single();

  if (caller?.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { full_name, role, position, department, google_calendar_id, is_active } = body;

  const { data, error } = await supabaseAdmin
    .from("staff")
    .update({
      ...(full_name !== undefined && { full_name }),
      ...(role !== undefined && { role }),
      ...(position !== undefined && { position }),
      ...(department !== undefined && { department }),
      ...(google_calendar_id !== undefined && { google_calendar_id }),
      ...(is_active !== undefined && { is_active }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
