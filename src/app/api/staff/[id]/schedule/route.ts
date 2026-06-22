import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { createNotification } from "@/lib/notifications";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

// Default: Mon–Fri, 9:00–12:30 and 13:00–17:00 = 7.5h/day excl. 30 min lunch (37.5h/week FTE)
export const DEFAULT_SCHEDULE = Object.fromEntries(
  DAYS.map((day) => [
    day,
    {
      enabled: ["monday", "tuesday", "wednesday", "thursday", "friday"].includes(day),
      slots: [
        { start: "09:00", end: "12:30" },
        { start: "13:00", end: "17:00" },
      ],
    },
  ])
);

/** Migrate legacy {start, end} format to slots array, preserve flexible fields */
function normalise(schedule: Record<string, any>) {
  const out: Record<string, any> = {};
  // Preserve flexible schedule fields
  if (schedule.flexible !== undefined) out.flexible = !!schedule.flexible;
  if (schedule.flexible_hours !== undefined) out.flexible_hours = Number(schedule.flexible_hours) || 0;
  for (const day of DAYS) {
    const d = schedule[day] ?? { enabled: false, slots: [{ start: "09:00", end: "12:30" }, { start: "13:00", end: "17:00" }] };
    if (d.start !== undefined && !d.slots) {
      out[day] = { enabled: d.enabled, slots: [{ start: d.start, end: d.end }] };
    } else {
      out[day] = d;
    }
  }
  return out;
}

// Only admins, and managers with the manage_staff permission, can edit work schedules.
// Staff cannot edit their own schedule (it's set by HR/admin).
async function canEdit(callerRole: string): Promise<boolean> {
  if (callerRole === "admin") return true;
  if (callerRole === "manager") {
    const { data } = await supabaseAdmin
      .from("role_permissions")
      .select("enabled")
      .eq("role", "manager")
      .eq("feature", "manage_staff")
      .single();
    return data?.enabled ?? false;
  }
  return false;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data } = await supabaseAdmin
    .from("staff_schedules")
    .select("schedule, updated_at")
    .eq("staff_id", id)
    .single();

  const raw = data?.schedule ?? DEFAULT_SCHEDULE;
  return NextResponse.json({
    schedule: normalise(raw),
    updated_at: data?.updated_at ?? null,
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session.user?.email)
    .single();

  if (!caller) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canEdit(caller.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { schedule } = body;

  if (!schedule || typeof schedule !== "object") {
    return NextResponse.json({ error: "Invalid schedule" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("staff_schedules")
    .upsert(
      { staff_id: id, schedule: normalise(schedule), updated_at: new Date().toISOString() },
      { onConflict: "staff_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Let the staff member know their schedule was changed (skip self-edits).
  if (caller.id !== id) {
    await createNotification({
      staff_id: id,
      title: "Work schedule updated",
      message: "Your regular work schedule has been updated. Tap to review it.",
      type: "schedule",
      link: "/dashboard/schedule",
      is_read: false,
    });
  }

  return NextResponse.json(data);
}
