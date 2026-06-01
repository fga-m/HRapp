import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

async function callerCanDo(callerRole: string, feature: string): Promise<boolean> {
  if (callerRole === "admin") return true;
  if (callerRole !== "manager") return false;
  const { data } = await supabaseAdmin
    .from("role_permissions")
    .select("enabled")
    .eq("role", "manager")
    .eq("feature", feature)
    .single();
  return data?.enabled ?? false;
}

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

// Return the UTC+offset string for Australia/Melbourne on a given date (handles AEST/AEDT).
// e.g. "+10:00" in winter, "+11:00" in summer.
function getMelbourneOffset(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    timeZoneName: "shortOffset",
  }).formatToParts(date);
  const tz = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+10";
  const match = tz.match(/GMT([+-])(\d+)/);
  if (!match) return "+10:00";
  return `${match[1]}${match[2].padStart(2, "0")}:00`;
}

// Build a local-midnight ISO string for Australia/Melbourne, e.g. "2026-05-25T00:00:00+10:00"
function toMelbourneISO(dateStr: string): string {
  // Create a reference Date just to get the correct DST offset for that week
  const ref = new Date(dateStr + "T12:00:00Z");
  return `${dateStr}T00:00:00${getMelbourneOffset(ref)}`;
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

  const canViewTeam = await callerCanDo(caller.role, "view_team_schedule");

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
  const staffQuery = canViewTeam
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

  // Build calendar items — only staff with a calendar id or email
  const calendarItems = (staffList as any[])
    .map((s: any) => ({ calId: s.google_calendar_id || s.email, staffId: s.id }))
    .filter((item) => !!item.calId);

  // Fetch scheduled hours via Calendar Events API (uses calendar.events scope, already granted).
  // FreeBusy requires calendar.freebusy scope which we don't have — Events API works instead.
  // Parallel fetch per staff member; only timed events count (all-day events are skipped).
  const scheduledHoursMap = new Map<string, number>();

  // Use Melbourne-local midnight boundaries so events on Mon morning don't bleed into the prior week
  const weekStartStr = toISODateString(weekStart);
  const weekEndStr = toISODateString(weekEnd);
  const timeMin = toMelbourneISO(weekStartStr);
  const timeMax = toMelbourneISO(weekEndStr);

  if (token && calendarItems.length > 0) {
    const results = await Promise.allSettled(
      calendarItems.map(async ({ calId, staffId }) => {
        const url = new URL(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`
        );
        url.searchParams.set("timeMin", timeMin);
        url.searchParams.set("timeMax", timeMax);
        url.searchParams.set("singleEvents", "true");
        url.searchParams.set("maxResults", "250");

        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) return { staffId, hours: null };

        const data = await res.json();
        const events: any[] = data.items ?? [];

        // Sum only timed events (skip all-day events which have .date but no .dateTime)
        let totalMinutes = 0;
        for (const event of events) {
          if (event.start?.dateTime && event.end?.dateTime) {
            const start = new Date(event.start.dateTime).getTime();
            const end = new Date(event.end.dateTime).getTime();
            totalMinutes += (end - start) / 60_000;
          }
        }

        return { staffId, hours: Math.round((totalMinutes / 60) * 10) / 10 };
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value.hours !== null) {
        scheduledHoursMap.set(result.value.staffId, result.value.hours);
      }
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
    // null = no calendar linked; number = fetched (0 if calendar has no events that week)
    const scheduledHours = hasCalendar
      ? (scheduledHoursMap.has(s.id) ? scheduledHoursMap.get(s.id)! : null)
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
