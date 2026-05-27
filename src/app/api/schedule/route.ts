import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day; // shift Sunday back 6, others to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toISODateString(date: Date): string {
  return date.toISOString().split("T")[0];
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = (session as any).accessToken;

  // Resolve caller
  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session.user?.email ?? "")
    .single();

  if (!caller) return NextResponse.json({ error: "Staff record not found" }, { status: 404 });

  const isAdmin = caller.role === "admin";

  // Parse weekStart param
  const { searchParams } = new URL(req.url);
  const weekStartParam = searchParams.get("weekStart");

  let weekStart: Date;
  if (weekStartParam) {
    const parsed = new Date(weekStartParam);
    weekStart = isNaN(parsed.getTime()) ? getMondayOfWeek(new Date()) : getMondayOfWeek(parsed);
  } else {
    weekStart = getMondayOfWeek(new Date());
  }

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  // Fetch staff
  const staffQuery = isAdmin
    ? supabaseAdmin
        .from("staff")
        .select("id, full_name, email, avatar_url, position, contracted_hours, google_calendar_id")
        .eq("is_active", true)
    : supabaseAdmin
        .from("staff")
        .select("id, full_name, email, avatar_url, position, contracted_hours, google_calendar_id")
        .eq("is_active", true)
        .eq("id", caller.id);

  const { data: staffList, error: staffError } = await staffQuery;

  if (staffError || !staffList) {
    return NextResponse.json({ error: "Failed to fetch staff" }, { status: 500 });
  }

  // Build FreeBusy items — only staff with a calendar id or email
  const calendarItems = staffList
    .map((s: any) => ({ id: s.google_calendar_id || s.email, staffId: s.id }))
    .filter((item: any) => !!item.id);

  // Map: calendarId → staffId
  const calendarToStaffId = new Map<string, string>();
  for (const s of staffList as any[]) {
    const calId = s.google_calendar_id || s.email;
    if (calId) calendarToStaffId.set(calId, s.id);
  }

  // Fetch FreeBusy if we have a token and calendar items
  const scheduledHoursMap = new Map<string, number | null>();

  if (token && calendarItems.length > 0) {
    try {
      const freeBusyRes = await fetch(
        "https://www.googleapis.com/calendar/v3/freeBusy",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            timeMin: weekStart.toISOString(),
            timeMax: weekEnd.toISOString(),
            items: calendarItems.map((item: any) => ({ id: item.id })),
          }),
        }
      );

      if (freeBusyRes.ok) {
        const freeBusyData = await freeBusyRes.json();
        const calendars: Record<string, { busy: Array<{ start: string; end: string }> }> =
          freeBusyData.calendars || {};

        for (const [calId, calData] of Object.entries(calendars)) {
          const staffId = calendarToStaffId.get(calId);
          if (!staffId) continue;

          const busyBlocks = calData.busy || [];
          let totalMinutes = 0;
          for (const block of busyBlocks) {
            const start = new Date(block.start).getTime();
            const end = new Date(block.end).getTime();
            totalMinutes += (end - start) / 60000;
          }
          scheduledHoursMap.set(staffId, Math.round((totalMinutes / 60) * 10) / 10);
        }
      }
      // If freeBusy fails (403 etc.), we just leave the map empty — staff get null
    } catch {
      // Network error or parse error — don't crash, just leave map empty
    }
  }

  // Mark staff who have no linked calendar at all
  const hasCalendarSet = new Set<string>();
  for (const s of staffList as any[]) {
    if (s.google_calendar_id || s.email) hasCalendarSet.add(s.id);
  }

  // Fetch TOIL balances
  const { data: toilRows } = await supabaseAdmin
    .from("toil_transactions")
    .select("staff_id, hours");

  const toilBalanceMap = new Map<string, number>();
  for (const row of (toilRows || []) as any[]) {
    const current = toilBalanceMap.get(row.staff_id) ?? 0;
    toilBalanceMap.set(row.staff_id, current + Number(row.hours));
  }

  // Build response
  const staffResponse = (staffList as any[]).map((s: any) => {
    const hasCalendar = hasCalendarSet.has(s.id);
    const scheduledHours = hasCalendar
      ? (scheduledHoursMap.get(s.id) ?? null)
      : null;
    const toilBalance = Math.round((toilBalanceMap.get(s.id) ?? 0) * 10) / 10;

    return {
      id: s.id,
      full_name: s.full_name,
      email: s.email,
      avatar_url: s.avatar_url ?? null,
      position: s.position ?? null,
      contracted_hours: s.contracted_hours ?? 38,
      scheduled_hours: scheduledHours,
      toil_balance: toilBalance,
      has_calendar: hasCalendar,
    };
  });

  return NextResponse.json({
    staff: staffResponse,
    weekStart: toISODateString(weekStart),
    weekEnd: toISODateString(weekEnd),
    role: caller.role,
  });
}
