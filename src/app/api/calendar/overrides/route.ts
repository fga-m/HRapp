import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET /api/calendar/overrides?staff_id=X
// Returns all work-hour overrides for a staff member (admin only)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabaseAdmin
    .from("staff").select("id, role").eq("email", session.user?.email ?? "").single();
  if (!caller) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (caller.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const staffId = new URL(req.url).searchParams.get("staff_id");
  if (!staffId) return NextResponse.json({ error: "staff_id required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("calendar_event_overrides")
    .select("event_id, work_hours, note")
    .eq("staff_id", staffId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ overrides: data ?? [] });
}

// POST /api/calendar/overrides
// Create or update a work-hour override for an event
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabaseAdmin
    .from("staff").select("id, role").eq("email", session.user?.email ?? "").single();
  if (!caller) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (caller.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const { staff_id, event_id, work_hours, note } = await req.json();
  if (!staff_id || !event_id || work_hours == null) {
    return NextResponse.json({ error: "staff_id, event_id and work_hours required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("calendar_event_overrides")
    .upsert(
      { staff_id, event_id, work_hours: Number(work_hours), note: note ?? null,
        created_by: caller.id, updated_at: new Date().toISOString() },
      { onConflict: "staff_id,event_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 200 });
}

// DELETE /api/calendar/overrides?staff_id=X&event_id=Y
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabaseAdmin
    .from("staff").select("id, role").eq("email", session.user?.email ?? "").single();
  if (!caller) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (caller.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const staffId  = searchParams.get("staff_id");
  const eventId  = searchParams.get("event_id");
  if (!staffId || !eventId) return NextResponse.json({ error: "staff_id and event_id required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("calendar_event_overrides")
    .delete()
    .eq("staff_id", staffId)
    .eq("event_id", eventId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
