"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  format, startOfWeek, addDays, isToday, eachDayOfInterval,
  addWeeks, subWeeks, isSameDay,
} from "date-fns";

// ── Constants ──────────────────────────────────────────────────────────────
const HOUR_H = 64;       // px per hour
const START_H = 7;       // 7 am
const END_H = 21;        // 9 pm
const HOURS = Array.from({ length: END_H - START_H }, (_, i) => START_H + i);

// Cycling palette for staff chips & events
const PALETTE = [
  { chip: "bg-[#223149] text-white", event: "bg-[#223149]/90 border-[#223149]" },
  { chip: "bg-[#5F7C84] text-white", event: "bg-[#5F7C84]/90 border-[#5F7C84]" },
  { chip: "bg-indigo-500 text-white", event: "bg-indigo-500/90 border-indigo-500" },
  { chip: "bg-emerald-500 text-white", event: "bg-emerald-500/90 border-emerald-500" },
  { chip: "bg-amber-500 text-white", event: "bg-amber-500/90 border-amber-500" },
  { chip: "bg-rose-500 text-white", event: "bg-rose-500/90 border-rose-500" },
  { chip: "bg-violet-500 text-white", event: "bg-violet-500/90 border-violet-500" },
  { chip: "bg-teal-500 text-white", event: "bg-teal-500/90 border-teal-500" },
];

type GEvent = {
  id: string;
  summary?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  htmlLink?: string;
  location?: string;
  description?: string;
};

type StaffMember = {
  id: string;
  full_name: string;
  email: string;
  google_calendar_id: string | null;
  role: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────
function isAllDay(ev: GEvent) {
  return !ev.start.dateTime;
}

function eventTopPx(ev: GEvent) {
  if (isAllDay(ev)) return 0;
  const d = new Date(ev.start.dateTime!);
  return Math.max(0, (d.getHours() + d.getMinutes() / 60 - START_H) * HOUR_H);
}

function eventHeightPx(ev: GEvent) {
  if (isAllDay(ev)) return HOUR_H;
  const start = new Date(ev.start.dateTime!);
  const end = new Date(ev.end.dateTime!);
  const mins = (end.getTime() - start.getTime()) / 60000;
  return Math.max(22, (mins / 60) * HOUR_H);
}

function eventsForDay(events: GEvent[], day: Date) {
  return events.filter((ev) => {
    const dateStr = ev.start.dateTime
      ? new Date(ev.start.dateTime)
      : new Date(ev.start.date!);
    return isSameDay(dateStr, day);
  });
}

function allDayEventsForDay(events: GEvent[], day: Date) {
  return eventsForDay(events, day).filter(isAllDay);
}

function timedEventsForDay(events: GEvent[], day: Date) {
  return eventsForDay(events, day).filter((ev) => !isAllDay(ev));
}

// Simple overlap layout: returns { left%, width% } for each event
function layoutEvents(events: GEvent[]): Map<string, { left: number; width: number }> {
  const sorted = [...events].sort(
    (a, b) => new Date(a.start.dateTime!).getTime() - new Date(b.start.dateTime!).getTime()
  );
  const layout = new Map<string, { left: number; width: number }>();
  const columns: GEvent[][] = [];

  for (const ev of sorted) {
    const start = new Date(ev.start.dateTime!).getTime();
    const end = new Date(ev.end.dateTime!).getTime();
    let placed = false;
    for (let c = 0; c < columns.length; c++) {
      const col = columns[c];
      const last = col[col.length - 1];
      const lastEnd = new Date(last.end.dateTime!).getTime();
      if (start >= lastEnd) {
        col.push(ev);
        placed = true;
        break;
      }
    }
    if (!placed) columns.push([ev]);
  }

  const total = columns.length || 1;
  columns.forEach((col, ci) => {
    col.forEach((ev) => {
      layout.set(ev.id, { left: (ci / total) * 100, width: (1 / total) * 96 });
    });
  });
  return layout;
}

// ── Component ──────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [events, setEvents] = useState<GEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [role, setRole] = useState<"admin" | "staff">("staff");
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [selectedId, setSelectedId] = useState("primary"); // calendarId
  const [selectedLabel, setSelectedLabel] = useState("My Calendar");
  const gridRef = useRef<HTMLDivElement>(null);
  const [nowTop, setNowTop] = useState(0);
  const [tooltip, setTooltip] = useState<GEvent | null>(null);

  const days = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });

  // ── Fetch staff + role ──────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/staff")
      .then((r) => r.json())
      .then((data: StaffMember[]) => {
        if (!Array.isArray(data)) return;
        // Determine current user's role by checking if they're in the admin list
        // We use a separate call to get role info
        const withCalendar = data.filter((s) => s.google_calendar_id);
        setStaffList(withCalendar);
      });
    // Get role via policies endpoint (returns role field)
    fetch("/api/policies")
      .then((r) => r.json())
      .then((d) => { if (d.role) setRole(d.role); });
  }, []);

  // ── Fetch events ─────────────────────────────────────────────────────────
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError("");
    const timeMin = weekStart.toISOString();
    const timeMax = addDays(weekStart, 7).toISOString();
    const res = await fetch(
      `/api/calendar/events?calendarId=${encodeURIComponent(selectedId)}&timeMin=${timeMin}&timeMax=${timeMax}`
    );
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to load events");
      setEvents([]);
    } else {
      setEvents(data);
    }
    setLoading(false);
  }, [weekStart, selectedId]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // ── Current time line ────────────────────────────────────────────────────
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const top = (now.getHours() + now.getMinutes() / 60 - START_H) * HOUR_H;
      setNowTop(top);
    };
    update();
    const t = setInterval(update, 60000);
    return () => clearInterval(t);
  }, []);

  // ── Auto-scroll to current time on load ──────────────────────────────────
  useEffect(() => {
    if (gridRef.current && nowTop > 0) {
      gridRef.current.scrollTop = Math.max(0, nowTop - 120);
    }
  }, [nowTop]);

  // ── Staff color map ───────────────────────────────────────────────────────
  const colorForIndex = (i: number) => PALETTE[i % PALETTE.length];
  const staffColorMap = new Map(staffList.map((s, i) => [s.google_calendar_id ?? s.email, colorForIndex(i + 1)]));
  const eventColor = staffColorMap.get(selectedId) ?? PALETTE[0];

  const goToday = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] min-h-0">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 space-y-3 mb-3">
        {/* Week nav */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setWeekStart((w) => subWeeks(w, 1))}
              className="p-2 rounded-xl hover:bg-[#ECE3DF] transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-[#223149]" />
            </button>
            <button
              onClick={() => setWeekStart((w) => addWeeks(w, 1))}
              className="p-2 rounded-xl hover:bg-[#ECE3DF] transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-[#223149]" />
            </button>
          </div>
          <h2 className="text-lg font-bold text-[#223149]">
            {format(weekStart, "d MMM")} – {format(addDays(weekStart, 6), "d MMM yyyy")}
          </h2>
          <button
            onClick={goToday}
            className="px-3 py-1.5 text-xs font-semibold border border-[#ECE3DF] rounded-lg text-[#5F7C84] hover:bg-[#F8F6F4] transition-colors"
          >
            Today
          </button>
          {loading && (
            <div className="w-4 h-4 border-2 border-[#223149] border-t-transparent rounded-full animate-spin" />
          )}
        </div>

        {/* Staff selector — admin only */}
        {role === "admin" && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button
              onClick={() => { setSelectedId("primary"); setSelectedLabel("My Calendar"); }}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                selectedId === "primary"
                  ? "bg-[#223149] text-white border-[#223149]"
                  : "bg-white text-[#5F7C84] border-[#ECE3DF] hover:border-[#9BADB7]"
              }`}
            >
              My Calendar
            </button>
            {staffList.map((s, i) => {
              const calId = s.google_calendar_id ?? s.email;
              const active = selectedId === calId;
              const colors = colorForIndex(i + 1);
              return (
                <button
                  key={s.id}
                  onClick={() => { setSelectedId(calId); setSelectedLabel(s.full_name); }}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                    active ? colors.chip + " border-transparent" : "bg-white text-[#5F7C84] border-[#ECE3DF] hover:border-[#9BADB7]"
                  }`}
                >
                  {s.full_name.split(" ")[0]}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Error ──────────────────────────────────────────────────── */}
      {error && (
        <div className="flex-shrink-0 mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          {error.includes("401") || error.includes("token")
            ? "Your session has expired. Please sign out and sign back in."
            : error.includes("403") || error.includes("forbidden") || error.includes("notFound")
            ? `No access to ${selectedLabel}'s calendar. They may need to share it with you in Google Calendar.`
            : error}
        </div>
      )}

      {/* ── Calendar grid ──────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col">
        {/* Day headers */}
        <div className="flex-shrink-0 grid border-b border-[#ECE3DF]" style={{ gridTemplateColumns: "52px repeat(7, 1fr)" }}>
          <div className="border-r border-[#ECE3DF]" /> {/* spacer */}
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className={`py-2 text-center border-r border-[#ECE3DF] last:border-r-0 ${isToday(day) ? "bg-[#223149]/5" : ""}`}
            >
              <p className="text-xs text-[#9BADB7] uppercase tracking-wide">{format(day, "EEE")}</p>
              <p className={`text-base font-bold mt-0.5 w-8 h-8 flex items-center justify-center mx-auto rounded-full ${
                isToday(day) ? "bg-[#223149] text-white" : "text-[#223149]"
              }`}>
                {format(day, "d")}
              </p>
            </div>
          ))}
        </div>

        {/* All-day row */}
        {days.some((d) => allDayEventsForDay(events, d).length > 0) && (
          <div className="flex-shrink-0 grid border-b border-[#ECE3DF]" style={{ gridTemplateColumns: "52px repeat(7, 1fr)" }}>
            <div className="border-r border-[#ECE3DF] flex items-center justify-end pr-2">
              <span className="text-[10px] text-[#9BADB7]">all-day</span>
            </div>
            {days.map((day) => {
              const allDay = allDayEventsForDay(events, day);
              return (
                <div key={day.toISOString()} className="border-r border-[#ECE3DF] last:border-r-0 p-1 min-h-[28px]">
                  {allDay.map((ev) => (
                    <div
                      key={ev.id}
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded mb-0.5 truncate text-white ${eventColor.event.split(" ")[0]}`}
                    >
                      {ev.summary || "(No title)"}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* Timed events grid — scrollable */}
        <div ref={gridRef} className="flex-1 overflow-y-auto">
          <div className="grid relative" style={{ gridTemplateColumns: "52px repeat(7, 1fr)" }}>
            {/* Time labels column */}
            <div className="border-r border-[#ECE3DF]">
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="border-b border-[#ECE3DF]/60 flex items-start justify-end pr-2 pt-1"
                  style={{ height: HOUR_H }}
                >
                  <span className="text-[10px] text-[#9BADB7]">
                    {h === 12 ? "12pm" : h > 12 ? `${h - 12}pm` : `${h}am`}
                  </span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((day, di) => {
              const timed = timedEventsForDay(events, day);
              const positions = layoutEvents(timed);
              const isCurrentDay = isToday(day);
              return (
                <div
                  key={day.toISOString()}
                  className={`relative border-r border-[#ECE3DF] last:border-r-0 ${isCurrentDay ? "bg-[#223149]/[0.02]" : ""}`}
                  style={{ height: HOUR_H * HOURS.length }}
                >
                  {/* Hour lines */}
                  {HOURS.map((h) => (
                    <div
                      key={h}
                      className="absolute w-full border-b border-[#ECE3DF]/60"
                      style={{ top: (h - START_H) * HOUR_H }}
                    />
                  ))}

                  {/* Current time line */}
                  {isCurrentDay && nowTop >= 0 && nowTop <= HOUR_H * HOURS.length && (
                    <div
                      className="absolute w-full flex items-center z-10 pointer-events-none"
                      style={{ top: nowTop }}
                    >
                      <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 flex-shrink-0" />
                      <div className="flex-1 border-t-2 border-red-500" />
                    </div>
                  )}

                  {/* Events */}
                  {timed.map((ev) => {
                    const pos = positions.get(ev.id) ?? { left: 0, width: 96 };
                    const top = eventTopPx(ev);
                    const height = eventHeightPx(ev);
                    const startLabel = format(new Date(ev.start.dateTime!), "h:mm a");
                    const isShort = height < 40;
                    return (
                      <div
                        key={ev.id}
                        className={`absolute rounded-lg border-l-2 px-1.5 py-1 cursor-pointer hover:brightness-95 transition-all overflow-hidden ${eventColor.event}`}
                        style={{
                          top,
                          height,
                          left: `${pos.left}%`,
                          width: `${pos.width}%`,
                          zIndex: 5,
                        }}
                        onClick={() => setTooltip(tooltip?.id === ev.id ? null : ev)}
                      >
                        <p className="text-[11px] font-semibold text-white leading-tight truncate">
                          {ev.summary || "(No title)"}
                        </p>
                        {!isShort && (
                          <p className="text-[10px] text-white/80 leading-tight">{startLabel}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Event tooltip / detail ─────────────────────────────────── */}
      {tooltip && (
        <div
          className="fixed inset-0 z-40 flex items-end md:items-center justify-center p-4 bg-black/30"
          onClick={() => setTooltip(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl p-5 w-full max-w-sm space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`w-3 h-3 rounded-full ${eventColor.event.split(" ")[0]}`} />
            <h3 className="text-lg font-bold text-[#223149]">{tooltip.summary || "(No title)"}</h3>
            <div className="space-y-1 text-sm text-[#5F7C84]">
              {tooltip.start.dateTime ? (
                <p>
                  {format(new Date(tooltip.start.dateTime), "EEE d MMM, h:mm a")}
                  {" – "}
                  {format(new Date(tooltip.end.dateTime!), "h:mm a")}
                </p>
              ) : (
                <p>{format(new Date(tooltip.start.date!), "EEE d MMM")} · All day</p>
              )}
              {tooltip.location && <p>📍 {tooltip.location}</p>}
            </div>
            {tooltip.htmlLink && (
              <a
                href={tooltip.htmlLink}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center text-xs font-semibold text-[#223149] underline"
              >
                Open in Google Calendar
              </a>
            )}
            <button
              onClick={() => setTooltip(null)}
              className="w-full px-4 py-2 rounded-xl border border-[#ECE3DF] text-sm text-[#5F7C84] hover:bg-[#F8F6F4] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
