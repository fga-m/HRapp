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

/**
 * Merge overlapping time intervals so that only unique time is counted.
 * e.g. [[9am,5pm],[10am,11am]] → [[9am,5pm]] not 9h+1h=10h
 * Each interval is [startMs, endMs].
 */
function mergeIntervals(intervals: Array<[number, number]>): Array<[number, number]> {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [[sorted[0][0], sorted[0][1]]];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i][0] <= last[1]) {
      last[1] = Math.max(last[1], sorted[i][1]); // extend the current interval
    } else {
      merged.push([sorted[i][0], sorted[i][1]]);
    }
  }
  return merged;
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
        .order("full_name", { ascending: true })
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

  // Helper: fetch scheduled hours for all staff over a given week boundary
  // Fetch manual work-hour overrides for all staff (keyed by staffId → eventId → workHours)
  const staffIds = (staffList as any[]).map((s: any) => s.id);
  const { data: overrideRows } = await supabaseAdmin
    .from("calendar_event_overrides")
    .select("staff_id, event_id, work_hours")
    .in("staff_id", staffIds);

  // Build nested map: staffId → (eventId → work_hours)
  const overrideMap = new Map<string, Map<string, number>>();
  for (const row of (overrideRows ?? []) as any[]) {
    if (!overrideMap.has(row.staff_id)) overrideMap.set(row.staff_id, new Map());
    overrideMap.get(row.staff_id)!.set(row.event_id, Number(row.work_hours));
  }

  async function fetchWeekHours(tMin: string, tMax: string): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (!token || calendarItems.length === 0) return map;

    const results = await Promise.allSettled(
      calendarItems.map(async ({ calId, staffId }: { calId: string; staffId: string }) => {
        const url = new URL(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`
        );
        url.searchParams.set("timeMin", tMin);
        url.searchParams.set("timeMax", tMax);
        url.searchParams.set("singleEvents", "true");
        url.searchParams.set("maxResults", "250");

        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return { staffId, hours: null };

        const data = await res.json();
        const events: any[] = data.items ?? [];
        const staffOverrides = overrideMap.get(staffId);

        // Separate events into overridden (manual hours) and auto (calculate from duration).
        // Auto events are merged to avoid counting overlapping time twice.
        let overrideMinutes = 0;
        const autoIntervals: Array<[number, number]> = [];

        for (const event of events) {
          if (!event.start?.dateTime || !event.end?.dateTime) continue;
          if (staffOverrides?.has(event.id)) {
            overrideMinutes += staffOverrides.get(event.id)! * 60;
          } else {
            const start = new Date(event.start.dateTime).getTime();
            const end   = new Date(event.end.dateTime).getTime();
            if (end > start) autoIntervals.push([start, end]);
          }
        }

        // Merge overlapping intervals so e.g. a "Work" block + a meeting inside it
        // count as one continuous block, not two separate durations.
        const merged = mergeIntervals(autoIntervals);
        let autoMinutes = 0;
        for (const [start, end] of merged) {
          const durationMins = (end - start) / 60_000;
          // Apply 30-min lunch deduction for any merged block >= 5 hours
          autoMinutes += durationMins >= 300 ? durationMins - 30 : durationMins;
        }

        const totalMinutes = overrideMinutes + autoMinutes;
        return { staffId, hours: Math.round((totalMinutes / 60) * 10) / 10 };
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value.hours !== null) {
        map.set(result.value.staffId, result.value.hours);
      }
    }
    return map;
  }

  // Use Melbourne-local midnight boundaries so events on Mon morning don't bleed into the prior week
  const weekStartStr = toISODateString(weekStart);
  const weekEndStr   = toISODateString(weekEnd);
  const timeMin = toMelbourneISO(weekStartStr);
  const timeMax = toMelbourneISO(weekEndStr);

  // Build boundaries for the 3 prior weeks (TOIL accumulates over 4 weeks then resets)
  const TOIL_WEEKS = 4;
  const priorWeekBounds = Array.from({ length: TOIL_WEEKS - 1 }, (_, i) => {
    const offset = (i + 1) * 7;
    const s = new Date(weekStart); s.setDate(s.getDate() - offset);
    const e = new Date(weekEnd);   e.setDate(e.getDate() - offset);
    return { tMin: toMelbourneISO(toISODateString(s)), tMax: toMelbourneISO(toISODateString(e)) };
  });

  // Fetch current week + prior 3 weeks in parallel (all 4 weeks for TOIL window)
  const [scheduledHoursMap, ...priorMaps] = await Promise.all([
    fetchWeekHours(timeMin, timeMax),
    ...priorWeekBounds.map(({ tMin, tMax }) => fetchWeekHours(tMin, tMax)),
  ]);

  // Mark staff who have no linked calendar at all
  const hasCalendarSet = new Set<string>();
  for (const s of staffList as any[]) {
    if (s.google_calendar_id || s.email) hasCalendarSet.add(s.id);
  }

  // TOIL balance = sum of weekly variances (scheduled − contracted) over the last 4 weeks.
  // Weeks with no calendar data contribute 0 to the balance.
  const toilBalanceMap = new Map<string, number>();
  for (const s of staffList as any[]) {
    const contracted = s.contracted_hours ?? 37.5;
    const allWeekMaps = [scheduledHoursMap, ...priorMaps];
    const totalVariance = allWeekMaps.reduce((sum, weekMap) => {
      const scheduled = weekMap.get(s.id);
      return sum + (scheduled != null ? scheduled - contracted : 0);
    }, 0);
    toilBalanceMap.set(s.id, Math.round(totalVariance * 10) / 10);
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
      contracted_hours: s.contracted_hours ?? 37.5,
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
