import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { createNotification } from "@/lib/notifications";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, full_name")
    .eq("email", session.user?.email)
    .single();

  if (!caller) return NextResponse.json({ error: "Staff not found" }, { status: 404 });

  const { data: pd } = await supabaseAdmin
    .from("position_descriptions")
    .select("version, title, created_by, staff_id")
    .eq("id", id)
    .single();

  if (!pd) return NextResponse.json({ error: "Position description not found" }, { status: 404 });

  // Access control: staff can only acknowledge their own PD
  if (pd.staff_id !== caller.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const currentYear = new Date().getFullYear();

  const { data, error } = await supabaseAdmin
    .from("pd_acknowledgements")
    .insert({
      pd_id: id,
      staff_id: caller.id,
      pd_version: pd.version,
      ack_year: currentYear,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Already acknowledged" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Notify the admin who created the PD
  if (pd.created_by) {
    await createNotification({
      staff_id: pd.created_by,
      title: "Position Description Acknowledged",
      message: `${caller.full_name} has acknowledged their position description (v${pd.version})`,
      type: "general",
      category: "position_description",
      reference_id: id,
    });
  }

  return NextResponse.json(data, { status: 201 });
}
