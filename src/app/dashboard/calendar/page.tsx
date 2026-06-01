"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Copy, Plus, Pencil, Trash2, X } from "lucide-react";
import {
  format, startOfWeek, addDays, isToday, eachDayOfInterval,
  addWeeks, subWeeks, isSameDay,
} from "date-fns";

// ── Constants ──────────────────────────────────────────────────────────────
const HOUR_H = 64;
const START_H = 7;
const END_H = 24;
const HOURS = Array.from({ length: END_H - START_H }, (_, i) => START_H + i);

const PALETTE = [
  { chip: "bg-[#223149] text-white", event: "bg-[#223149]/90 border-[#223149]", hex: "#223149" },
  { chip: "bg-[#5F7C84] text-white", event: "bg-[#5F7C84]/90 border-[#5F7C84]", hex: "#5F7C84" },
  { chip: "bg-indigo-500 text-white", event: "bg-indigo-500/90 border-indigo-500", hex: "#6366f1" },
  { chip: "bg-emerald-500 text-white", event: "bg-emerald-500/90 border-emerald-500", hex: "#10b981" },
  { chip: "bg-amber-500 text-white", event: "bg-amber-500/90 border-amber-500", hex: "#f59e0b" },
  { chip: "bg-rose-500 text-white", event: "bg-rose-500/90 border-rose-500", hex: "#f43f5e" },
  { chip: "bg-violet-500 text-white", event: "bg-violet-500/90 border-violet-500", hex: "#8b5cf6" },
  { chip: "bg-teal-500 text-white", event: "bg-teal-500/90 border-teal-500", hex: "#14b8a6" },
];

// ── Types ──────────────────────────────────────────────────────────────────
type GEvent = {
  id: string;
  summary?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  htmlLink?: string;
  location?: string;
  description?: string;
  transparency?: string;      // "opaque" (busy, default) | "transparent" (free/available)
  eventType?: string;         // "default" | "outOfOffice" | "focusTime" | "workingLocation"
  recurrence?: string[];      // RRULE strings on the master recurring event
  recurringEventId?: string;  // set on instances belonging to a recurring series
  attendees?: { email: string; displayName?: string; responseStatus?: string; self?: boolean; organizer?: boolean }[];
};

type StaffMember = {
  id: string;
  full_name: string;
  email: string;
  google_calendar_id: string | null;
  role: string;
};

// ── Event classification ───────────────────────────────────────────────────
function isOOO(ev: GEvent) {
  return ev.eventType === "outOfOffice";
}
function isFreeEvent(ev: GEvent) {
  return !isOOO(ev) && ev.transparency === "transparent";
}
function isBusyEvent(ev: GEvent) {
  return !isOOO(ev) && !isFreeEvent(ev);
}

// ── Geometry helpers ───────────────────────────────────────────────────────
function isAllDay(ev: GEvent) {
  return !ev.start.dateTime;
}
// A timed event spanning more than one calendar day (e.g. a multi-day camp).
// These should be shown in the all-day row, not as a massive tall timed block.
function isMultiDayTimed(ev: GEvent) {
  if (!ev.start.dateTime || !ev.end.dateTime) return false;
  const start = new Date(ev.start.dateTime);
  const end   = new Date(ev.end.dateTime);
  return start.toDateString() !== end.toDateString();
}
// Treat both true all-day events and multi-day timed events as "all-day" for rendering
function isAllDayLike(ev: GEvent) {
  return isAllDay(ev) || isMultiDayTimed(ev);
}

function eventTopPx(ev: GEvent) {
  if (isAllDayLike(ev)) return 0;
  const d = new Date(ev.start.dateTime!);
  return Math.max(0, (d.getHours() + d.getMinutes() / 60 - START_H) * HOUR_H);
}
function eventHeightPx(ev: GEvent) {
  if (isAllDayLike(ev)) return HOUR_H;
  const start = new Date(ev.start.dateTime!);
  const end = new Date(ev.end.dateTime!);
  const mins = (end.getTime() - start.getTime()) / 60000;
  return Math.max(22, (mins / 60) * HOUR_H);
}

function dayMidnight(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function eventsForDay(events: GEvent[], day: Date) {
  const dayN = dayMidnight(day);
  return events.filter((ev) => {
    if (isMultiDayTimed(ev)) {
      // Multi-day timed: show in every calendar day it overlaps
      const startN = dayMidnight(new Date(ev.start.dateTime!));
      const endN   = dayMidnight(new Date(ev.end.dateTime!));
      return dayN >= startN && dayN <= endN;
    }
    if (ev.start.dateTime) {
      // Single-day timed event: match start day only
      return isSameDay(new Date(ev.start.dateTime), day);
    }
    // All-day event: check if `day` falls within [start, end)
    // Google uses exclusive end dates, so "Jun 2–3" has end.date = "Jun 4"
    const startN = (() => { const d = new Date(ev.start.date!); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); })();
    const endRaw = ev.end?.date ?? ev.start.date!;
    const endN   = (() => { const d = new Date(endRaw); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); })();
    return dayN >= startN && dayN < endN;
  });
}
function allDayEventsForDay(events: GEvent[], day: Date) {
  return eventsForDay(events, day).filter(isAllDayLike);
}
function timedEventsForDay(events: GEvent[], day: Date) {
  // Exclude both all-day and multi-day timed events — those go in the all-day row
  return eventsForDay(events, day).filter((ev) => !isAllDayLike(ev));
}

// Only lay out busy events — free/OOO are always full-width backgrounds
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
      if (start >= lastEnd) { col.push(ev); placed = true; break; }
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

// ── Event form modal ───────────────────────────────────────────────────────
type RecurrenceFreq = "none" | "daily" | "weekday" | "weekly" | "fortnightly" | "monthly" | "yearly";

const RECURRENCE_LABELS: Record<RecurrenceFreq, string> = {
  none: "Does not repeat",
  daily: "Daily",
  weekday: "Every weekday (Mon–Fri)",
  weekly: "Weekly",
  fortnightly: "Every 2 weeks",
  monthly: "Monthly",
  yearly: "Yearly",
};

/** Parse an RRULE string back into a RecurrenceFreq + until date */
function parseRRule(rrules: string[]): { freq: RecurrenceFreq; until: string } {
  const rule = (rrules ?? []).find((r) => r.startsWith("RRULE:")) ?? "";
  const freqMatch  = rule.match(/FREQ=(\w+)/);
  const intMatch   = rule.match(/INTERVAL=(\d+)/);
  const untilMatch = rule.match(/UNTIL=(\d{8})/);
  const bydayMatch = rule.match(/BYDAY=([A-Z,]+)/);
  const freq     = freqMatch?.[1] ?? "";
  const interval = intMatch ? parseInt(intMatch[1]) : 1;
  const byday    = bydayMatch?.[1] ?? null;
  const until    = untilMatch
    ? `${untilMatch[1].slice(0, 4)}-${untilMatch[1].slice(4, 6)}-${untilMatch[1].slice(6, 8)}`
    : format(addDays(new Date(), 90), "yyyy-MM-dd");
  let parsedFreq: RecurrenceFreq = "none";
  if (freq === "DAILY") parsedFreq = "daily";
  else if (freq === "WEEKLY" && byday === "MO,TU,WE,TH,FR") parsedFreq = "weekday";
  else if (freq === "WEEKLY" && interval === 2) parsedFreq = "fortnightly";
  else if (freq === "WEEKLY") parsedFreq = "weekly";
  else if (freq === "MONTHLY") parsedFreq = "monthly";
  else if (freq === "YEARLY") parsedFreq = "yearly";
  return { freq: parsedFreq, until };
}

function buildRRule(freq: RecurrenceFreq, startISO: string, untilDate: string): string | null {
  if (freq === "none") return null;
  // UNTIL must be UTC datetime: YYYYMMDDTHHMMSSZ
  const until = untilDate.replace(/-/g, "") + "T235959Z";
  // Day abbreviation from start date for weekly-based rules
  const DAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
  const day = DAY[new Date(startISO).getDay()];
  switch (freq) {
    case "daily":      return `RRULE:FREQ=DAILY;UNTIL=${until}`;
    case "weekday":    return `RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;UNTIL=${until}`;
    case "weekly":     return `RRULE:FREQ=WEEKLY;BYDAY=${day};UNTIL=${until}`;
    case "fortnightly":return `RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=${day};UNTIL=${until}`;
    case "monthly":    return `RRULE:FREQ=MONTHLY;UNTIL=${until}`;
    case "yearly":     return `RRULE:FREQ=YEARLY;UNTIL=${until}`;
  }
}

type EventFormProps = {
  initial?: {
    id?: string;
    summary: string;
    startDateTime: string;
    endDateTime: string;
    transparency: string;
    attendees?: string[];
    recurringEventId?: string; // set when editing an instance of a recurring series
    existingRules?: string[];  // current RRULE(s) from the master event
  };
  calendarId: string;
  staffList?: StaffMember[];
  onClose: () => void;
  onSuccess: () => void;
};

function EventFormModal({ initial, calendarId, staffList = [], onClose, onSuccess }: EventFormProps) {
  const isEdit = !!initial?.id;
  const isRecurringInstance = !!initial?.recurringEventId;

  // For recurring instances: "this" = edit only this occurrence, "all" = edit all
  const [editScope, setEditScope] = useState<"this" | "all">("this");

  // Pre-parse existing recurrence when editing "all events" in a series
  const existingRule = initial?.existingRules?.length
    ? parseRRule(initial.existingRules)
    : null;

  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [startDateTime, setStartDateTime] = useState(
    initial?.startDateTime ?? format(new Date(), "yyyy-MM-dd'T'HH:mm")
  );
  const [endDateTime, setEndDateTime] = useState(
    initial?.endDateTime ?? format(addDays(new Date(), 0), "yyyy-MM-dd'T'HH:mm")
  );
  const [transparency, setTransparency] = useState(initial?.transparency ?? "opaque");
  const [recurrence, setRecurrence] = useState<RecurrenceFreq>(existingRule?.freq ?? "none");
  const [recurrenceEnd, setRecurrenceEnd] = useState(
    existingRule?.until ?? format(addDays(new Date(), 90), "yyyy-MM-dd")
  );
  const [attendees, setAttendees] = useState<string[]>(initial?.attendees ?? []);
  const [staffSearch, setStaffSearch] = useState("");
  const [externalInput, setExternalInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Staff picker helpers
  const activeStaff = staffList.filter(s => s.email);
  const filteredStaff = staffSearch.trim()
    ? activeStaff.filter(s =>
        s.full_name.toLowerCase().includes(staffSearch.toLowerCase()) ||
        s.email.toLowerCase().includes(staffSearch.toLowerCase()))
    : activeStaff;

  const allSelected = activeStaff.length > 0 && activeStaff.every(s => attendees.includes(s.email));
  const someSelected = !allSelected && activeStaff.some(s => attendees.includes(s.email));

  const toggleStaff = (email: string) => {
    setAttendees(prev =>
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    );
  };

  const toggleAll = () => {
    if (allSelected) {
      // Deselect all staff (keep any manually added external emails)
      const staffEmails = new Set(activeStaff.map(s => s.email));
      setAttendees(prev => prev.filter(e => !staffEmails.has(e)));
    } else {
      // Add all staff emails not already present
      const toAdd = activeStaff.map(s => s.email).filter(e => !attendees.includes(e));
      setAttendees(prev => [...prev, ...toAdd]);
    }
  };

  const addExternal = (email: string) => {
    const e = email.trim().toLowerCase();
    if (!e || attendees.includes(e)) return;
    setAttendees(prev => [...prev, e]);
    setExternalInput("");
  };

  const removeAttendee = (email: string) => setAttendees(prev => prev.filter(a => a !== email));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim()) { setError("Title is required."); return; }
    if (new Date(endDateTime) <= new Date(startDateTime)) {
      setError("End time must be after start time.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      // Include recurrence for new events, or when editing all events in a series,
      // or when adding recurrence to a previously non-recurring event
      const includeRRule = !isEdit || (isEdit && (!isRecurringInstance || editScope === "all"));
      const rrule = includeRRule ? buildRRule(recurrence, startDateTime, recurrenceEnd) : null;

      const body: Record<string, unknown> = {
        calendarId,
        summary: summary.trim(),
        start: { dateTime: new Date(startDateTime).toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        end: { dateTime: new Date(endDateTime).toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        transparency,
        attendees: attendees.map((email) => ({ email })),
        ...(rrule ? { recurrence: [rrule] } : {}),
      };

      // For recurring instances editing "all events", patch the master event ID
      const targetId = (isRecurringInstance && editScope === "all")
        ? initial!.recurringEventId
        : initial?.id;

      const res = isEdit
        ? await fetch(`/api/calendar/events/${targetId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        : await fetch("/api/calendar/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Failed to save event");
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-xl w-full md:max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#223149]">{isEdit ? "Edit Event" : "New Event"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F8F6F4] transition-colors">
            <X className="w-5 h-5 text-[#9BADB7]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[#223149] mb-1.5">
              Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              autoFocus
              placeholder="e.g. Work, Team Meeting..."
              className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-[#223149] mb-1.5">Start</label>
              <input
                type="datetime-local"
                value={startDateTime}
                onChange={(e) => setStartDateTime(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] text-sm focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#223149] mb-1.5">End</label>
              <input
                type="datetime-local"
                value={endDateTime}
                onChange={(e) => setEndDateTime(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] text-sm focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
              />
            </div>
          </div>

          {/* Recurring series: scope selector */}
          {isRecurringInstance && (
            <div className="p-3 rounded-xl bg-[#F8F6F4] border border-[#ECE3DF] space-y-2">
              <p className="text-xs font-semibold text-[#5F7C84]">This is a recurring event</p>
              <div className="flex gap-2">
                {(["this", "all"] as const).map((scope) => (
                  <button
                    key={scope}
                    type="button"
                    onClick={() => setEditScope(scope)}
                    className={`flex-1 px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
                      editScope === scope
                        ? "bg-[#223149] text-white border-[#223149]"
                        : "border-[#ECE3DF] text-[#5F7C84] hover:bg-white"
                    }`}
                  >
                    {scope === "this" ? "This event only" : "All events in series"}
                  </button>
                ))}
              </div>
              {editScope === "this" && (
                <p className="text-xs text-[#9BADB7]">Only this occurrence will be changed. Other events in the series stay the same.</p>
              )}
              {editScope === "all" && (
                <p className="text-xs text-[#9BADB7]">All events in the series will be updated, including future occurrences.</p>
              )}
            </div>
          )}

          {/* Repeat — shown for new events, and for edits when not a recurring instance
              or when editing "all events" in a series */}
          {(!isRecurringInstance || editScope === "all") && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-[#223149] mb-1.5">Repeat</label>
                <select
                  value={recurrence}
                  onChange={(e) => setRecurrence(e.target.value as RecurrenceFreq)}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] text-sm focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors bg-white"
                >
                  {(Object.keys(RECURRENCE_LABELS) as RecurrenceFreq[]).map((key) => (
                    <option key={key} value={key}>{RECURRENCE_LABELS[key]}</option>
                  ))}
                </select>
              </div>
              {recurrence !== "none" && (
                <div>
                  <label className="block text-sm font-semibold text-[#223149] mb-1.5">Ends on</label>
                  <input
                    type="date"
                    value={recurrenceEnd}
                    min={startDateTime.split("T")[0]}
                    onChange={(e) => setRecurrenceEnd(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] text-sm focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
                  />
                </div>
              )}
            </div>
          )}

          {/* Show as */}
          <div>
            <label className="block text-sm font-semibold text-[#223149] mb-2">Show as</label>
            <div className="flex gap-3">
              {([["opaque", "Busy"], ["transparent", "Free (Working)"]] as const).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setTransparency(val)}
                  className={`flex-1 px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
                    transparency === val
                      ? "bg-[#223149] text-white border-[#223149]"
                      : "border-[#ECE3DF] text-[#5F7C84] hover:bg-[#F8F6F4]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-[#9BADB7] mt-1.5">
              {transparency === "transparent"
                ? "Shows as a working block — others can see you're available"
                : "Shows as busy — you're in a meeting or unavailable"}
            </p>
          </div>

          {/* Attendees */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-[#223149]">
                Invite people <span className="text-xs font-normal text-[#9BADB7]">(optional)</span>
              </label>
              {attendees.length > 0 && (
                <span className="text-xs text-[#9BADB7]">{attendees.length} selected</span>
              )}
            </div>

            {/* Staff picker panel */}
            <div className="border border-[#ECE3DF] rounded-xl overflow-hidden">
              {/* Search */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-[#ECE3DF]">
                <svg className="w-3.5 h-3.5 text-[#9BADB7] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/></svg>
                <input
                  type="text"
                  value={staffSearch}
                  onChange={e => setStaffSearch(e.target.value)}
                  placeholder="Search staff…"
                  className="flex-1 text-sm text-[#223149] placeholder:text-[#9BADB7] focus:outline-none bg-transparent"
                />
              </div>

              {/* All staff toggle */}
              <button
                type="button"
                onClick={toggleAll}
                className="w-full flex items-center gap-3 px-3 py-2.5 border-b border-[#ECE3DF] hover:bg-[#F8F6F4] transition-colors text-left"
              >
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  allSelected ? "bg-[#223149] border-[#223149]" : someSelected ? "bg-[#223149]/30 border-[#223149]/50" : "border-[#9BADB7]"
                }`}>
                  {allSelected && <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10"><path d="M1.5 5l2.5 2.5L8.5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>}
                  {someSelected && !allSelected && <div className="w-2 h-0.5 bg-[#223149] rounded" />}
                </div>
                <span className="text-sm font-semibold text-[#223149]">All staff</span>
                <span className="ml-auto text-xs text-[#9BADB7]">{activeStaff.length} people</span>
              </button>

              {/* Staff list */}
              <div className="max-h-44 overflow-y-auto divide-y divide-[#F8F6F4]">
                {filteredStaff.map(s => {
                  const checked = attendees.includes(s.email);
                  const initials = s.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleStaff(s.email)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${checked ? "bg-[#223149]/5" : "hover:bg-[#F8F6F4]"}`}
                    >
                      <div className="w-7 h-7 rounded-full bg-[#ECE3DF] flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-[#5F7C84]">
                        {initials}
                      </div>
                      <span className="flex-1 text-sm text-[#223149] truncate">{s.full_name}</span>
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${checked ? "bg-[#223149] border-[#223149]" : "border-[#9BADB7]"}`}>
                        {checked && <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10"><path d="M1.5 5l2.5 2.5L8.5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>}
                      </div>
                    </button>
                  );
                })}
                {filteredStaff.length === 0 && (
                  <p className="px-3 py-3 text-sm text-[#9BADB7]">No staff found</p>
                )}
              </div>
            </div>

            {/* Selected chips */}
            {attendees.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {attendees.map(email => {
                  const s = staffList.find(st => st.email === email);
                  return (
                    <span key={email} className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#223149]/10 text-[#223149] rounded-full text-xs font-medium">
                      {s ? s.full_name : email}
                      <button type="button" onClick={() => removeAttendee(email)} className="hover:text-rose-500 transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* External email input */}
            <div className="flex gap-2">
              <input
                type="email"
                value={externalInput}
                onChange={e => setExternalInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") { e.preventDefault(); addExternal(externalInput); }
                }}
                placeholder="Add external email address…"
                className="flex-1 px-3 py-2 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#9BADB7] text-sm focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
              />
              <button
                type="button"
                onClick={() => addExternal(externalInput)}
                disabled={!externalInput.trim()}
                className="px-3 py-2 rounded-xl border border-[#ECE3DF] text-sm text-[#5F7C84] hover:bg-[#F8F6F4] transition-colors disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-rose-500">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Event"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-[#ECE3DF] text-[#5F7C84] rounded-xl text-sm font-semibold hover:bg-[#F8F6F4] transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
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
  const [userEmail, setUserEmail] = useState("");
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState("primary");
  const [selectedLabel, setSelectedLabel] = useState("My Calendar");

  // Pre-select staff calendar from ?staff= URL param on first render
  useEffect(() => {
    const staffEmail = searchParams.get("staff");
    if (staffEmail) {
      setSelectedId(staffEmail);
      setSelectedLabel(""); // will be updated to full name when staffList loads
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount only
  const gridRef = useRef<HTMLDivElement>(null);
  const [scrollbarWidth, setScrollbarWidth] = useState(0);
  const [nowTop, setNowTop] = useState(0);
  const [tooltip, setTooltip] = useState<GEvent | null>(null);
  // Work-hour override state (for the event detail modal)
  const [overrideHours, setOverrideHours] = useState<string>("");
  const [overrideNote, setOverrideNote] = useState<string>("");
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [overrideExisting, setOverrideExisting] = useState<number | null>(null); // null = no override set
  const [editingEvent, setEditingEvent] = useState<GEvent | null>(null);
  const [duplicatingEvent, setDuplicatingEvent] = useState<GEvent | null>(null);
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  const [hoverPopup, setHoverPopup] = useState<{ event: GEvent; x: number; y: number } | null>(null);
  const [pendingInvites, setPendingInvites] = useState<GEvent[]>([]);
  const [showPendingInvites, setShowPendingInvites] = useState(true);
  const hoverPopupTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [rsvpLoading, setRsvpLoading] = useState<string | null>(null);

  const showPopup = (ev: GEvent, e: React.MouseEvent) => {
    if (hoverPopupTimeout.current) clearTimeout(hoverPopupTimeout.current);
    setHoverPopup({ event: ev, x: e.clientX, y: e.clientY });
  };
  const hidePopup = () => {
    hoverPopupTimeout.current = setTimeout(() => setHoverPopup(null), 200);
  };

  const handleRsvp = async (ev: GEvent, responseStatus: "accepted" | "declined" | "tentative") => {
    if (!ev.attendees) return;
    setRsvpLoading(responseStatus);
    const updatedAttendees = ev.attendees.map((a) =>
      (a.self || a.email === userEmail) ? { ...a, responseStatus } : a
    );
    // Optimistic updates
    setHoverPopup((prev) =>
      prev ? { ...prev, event: { ...prev.event, attendees: updatedAttendees } } : prev
    );
    setEvents((prev) =>
      prev.map((e) => e.id === ev.id ? { ...e, attendees: updatedAttendees } : e)
    );
    // Remove from pending invites since user has now responded
    setPendingInvites((prev) => prev.filter((e) => e.id !== ev.id));
    try {
      const res = await fetch(`/api/calendar/events/${ev.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calendarId: "primary", attendees: updatedAttendees }),
      });
      if (!res.ok) fetchEvents();
    } catch { fetchEvents(); }
    setRsvpLoading(null);
  };

  const handleRsvpFromPanel = async (ev: GEvent, responseStatus: "accepted" | "declined" | "tentative") => {
    if (!ev.attendees) return;
    const updatedAttendees = ev.attendees.map((a) =>
      (a.self || a.email === userEmail) ? { ...a, responseStatus } : a
    );
    // Optimistic: remove from panel immediately
    setPendingInvites((prev) => prev.filter((e) => e.id !== ev.id));
    // Also update the main events list if the event is in the current week view
    setEvents((prev) =>
      prev.map((e) => e.id === ev.id ? { ...e, attendees: updatedAttendees } : e)
    );
    try {
      const res = await fetch(`/api/calendar/events/${ev.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calendarId: "primary", attendees: updatedAttendees }),
      });
      if (!res.ok) {
        // Revert: add back to pending
        setPendingInvites((prev) => [ev, ...prev]);
      }
    } catch {
      setPendingInvites((prev) => [ev, ...prev]);
    }
  };

  // ── Drag state ───────────────────────────────────────────────────────────
  const dragStateRef = useRef<{
    event: GEvent;
    offsetY: number;
    preview: { eventId: string; dayIndex: number; topPx: number } | null;
  } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ eventId: string; dayIndex: number; topPx: number } | null>(null);

  // ── Resize state ─────────────────────────────────────────────────────────
  const resizeStateRef = useRef<{
    event: GEvent;
    edge: "top" | "bottom";
    preview: { eventId: string; topPx: number; height: number } | null;
  } | null>(null);
  const [resizePreview, setResizePreview] = useState<{ eventId: string; topPx: number; height: number } | null>(null);

  const days = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });

  // ── Fetch staff + role ──────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/staff")
      .then((r) => r.json())
      .then((data: StaffMember[]) => {
        if (!Array.isArray(data)) return;
        setStaffList(data);
        // Set label for pre-selected staff from URL param
        const staffEmail = searchParams.get("staff");
        if (staffEmail) {
          const match = data.find((s) => s.email === staffEmail);
          if (match) setSelectedLabel(match.full_name);
        }
      });
    fetch("/api/policies")
      .then((r) => r.json())
      .then((d) => {
        if (d.role) setRole(d.role);
        if (d.email) setUserEmail(d.email);
      });
  }, [searchParams]);

  // ── Fetch pending invites (next 30 days, self + needsAction) ─────────────
  useEffect(() => {
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 30 * 86400000).toISOString();
    fetch(`/api/calendar/events?calendarId=primary&timeMin=${timeMin}&timeMax=${timeMax}`)
      .then((r) => r.json())
      .then((items) => {
        if (!Array.isArray(items)) return;
        setPendingInvites(
          items.filter((ev) =>
            ev.attendees?.some((a: any) => a.self && a.responseStatus === "needsAction")
          )
        );
      })
      .catch(() => {});
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
      setNowTop((now.getHours() + now.getMinutes() / 60 - START_H) * HOUR_H);
    };
    update();
    const t = setInterval(update, 60000);
    return () => clearInterval(t);
  }, []);

  // ── Drag helpers ─────────────────────────────────────────────────────────
  const getTargetFromMouse = useCallback((clientX: number, clientY: number, offsetY = 0) => {
    if (!gridRef.current) return null;
    const rect = gridRef.current.getBoundingClientRect();
    const scrollTop = gridRef.current.scrollTop;
    const relX = clientX - rect.left;
    const relY = clientY - rect.top + scrollTop - offsetY;
    const colWidth = (rect.width - 52) / 7;
    const dayIndex = Math.max(0, Math.min(6, Math.floor((relX - 52) / colWidth)));
    const rawHours = relY / HOUR_H + START_H;
    // Snap to 15-minute intervals
    const snappedH = Math.floor(rawHours) + Math.round((rawHours % 1) * 4) / 4;
    const clampedH = Math.max(START_H, Math.min(END_H - 0.25, snappedH));
    return { dayIndex, topPx: (clampedH - START_H) * HOUR_H };
  }, []);

  const handleEventMouseDown = useCallback((e: React.MouseEvent, ev: GEvent) => {
    if (isAllDayLike(ev)) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const daysArr = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });
    const dayIndex = daysArr.findIndex((d) => isSameDay(d, new Date(ev.start.dateTime!)));
    const initialPreview = { eventId: ev.id, dayIndex: Math.max(0, dayIndex), topPx: eventTopPx(ev) };
    dragStateRef.current = { event: ev, offsetY, preview: initialPreview };
    setDragPreview(initialPreview);
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
  }, [weekStart]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const drag = dragStateRef.current;
      if (!drag) return;
      const result = getTargetFromMouse(e.clientX, e.clientY, drag.offsetY);
      if (result) {
        const next = { eventId: drag.event.id, ...result };
        drag.preview = next; // sync update — no stale closure
        setDragPreview(next);
      }
    };
    const onUp = async () => {
      const drag = dragStateRef.current;
      if (!drag) return;
      const preview = drag.preview; // always current — updated synchronously in onMove
      dragStateRef.current = null;
      setDragPreview(null);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      if (!preview) return;

      const origStart = new Date(drag.event.start.dateTime!);
      const origEnd = new Date(drag.event.end.dateTime!);
      const duration = origEnd.getTime() - origStart.getTime();
      const daysArr = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });
      const targetDay = daysArr[preview.dayIndex];
      const hours = preview.topPx / HOUR_H + START_H;
      const newStart = new Date(targetDay);
      newStart.setHours(Math.floor(hours), Math.round((hours % 1) * 60), 0, 0);
      const newEnd = new Date(newStart.getTime() + duration);
      if (newStart.getTime() === origStart.getTime()) return;

      // Optimistic update
      setEvents((prev) => prev.map((ev) =>
        ev.id === drag.event.id
          ? { ...ev, start: { dateTime: newStart.toISOString() }, end: { dateTime: newEnd.toISOString() } }
          : ev
      ));
      try {
        const res = await fetch(`/api/calendar/events/${drag.event.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            calendarId: selectedId,
            start: { dateTime: newStart.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
            end: { dateTime: newEnd.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
          }),
        });
        if (!res.ok) fetchEvents(); // revert on failure
      } catch { fetchEvents(); }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [weekStart, selectedId, getTargetFromMouse, fetchEvents]);

  // ── Resize handlers ───────────────────────────────────────────────────────
  const handleResizeMouseDown = useCallback((e: React.MouseEvent, ev: GEvent, edge: "top" | "bottom") => {
    e.preventDefault();
    e.stopPropagation();
    const initialPreview = { eventId: ev.id, topPx: eventTopPx(ev), height: eventHeightPx(ev) };
    resizeStateRef.current = { event: ev, edge, preview: initialPreview };
    setResizePreview(initialPreview);
    document.body.style.cursor = "ns-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const getY = (clientY: number) => {
      if (!gridRef.current) return 0;
      const rect = gridRef.current.getBoundingClientRect();
      const relY = clientY - rect.top + gridRef.current.scrollTop;
      const rawH = Math.max(START_H, Math.min(END_H, relY / HOUR_H + START_H));
      const snappedH = Math.floor(rawH) + Math.round((rawH % 1) * 4) / 4;
      return (Math.max(START_H, Math.min(END_H, snappedH)) - START_H) * HOUR_H;
    };
    const onMove = (e: MouseEvent) => {
      const resize = resizeStateRef.current;
      if (!resize) return;
      const snappedPx = getY(e.clientY);
      const origTopPx = eventTopPx(resize.event);
      const origHeight = eventHeightPx(resize.event);
      const minH = HOUR_H / 4; // 15 min
      let next: { eventId: string; topPx: number; height: number };
      if (resize.edge === "bottom") {
        next = { eventId: resize.event.id, topPx: origTopPx, height: Math.max(minH, snappedPx - origTopPx) };
      } else {
        const endPx = origTopPx + origHeight;
        const newTop = Math.min(endPx - minH, snappedPx);
        next = { eventId: resize.event.id, topPx: newTop, height: endPx - newTop };
      }
      resize.preview = next; // sync update — no stale closure
      setResizePreview(next);
    };
    const onUp = async () => {
      const resize = resizeStateRef.current;
      if (!resize) return;
      const preview = resize.preview; // always current — updated synchronously in onMove
      resizeStateRef.current = null;
      setResizePreview(null);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      if (!preview) return;
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const origStart = new Date(resize.event.start.dateTime!);
      const origEnd = new Date(resize.event.end.dateTime!);
      const toTime = (px: number) => { const h = px / HOUR_H + START_H; return { h: Math.floor(h), m: Math.round((h % 1) * 60) }; };
      let newStart = origStart, newEnd = origEnd;
      if (resize.edge === "bottom") {
        const t = toTime(preview.topPx + preview.height);
        newEnd = new Date(origStart); newEnd.setHours(t.h, t.m, 0, 0);
      } else {
        const t = toTime(preview.topPx);
        newStart = new Date(origStart); newStart.setHours(t.h, t.m, 0, 0);
      }
      if (newStart.getTime() === origStart.getTime() && newEnd.getTime() === origEnd.getTime()) return;
      setEvents((prev) => prev.map((ev) =>
        ev.id === resize.event.id ? { ...ev, start: { dateTime: newStart.toISOString() }, end: { dateTime: newEnd.toISOString() } } : ev
      ));
      try {
        const res = await fetch(`/api/calendar/events/${resize.event.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ calendarId: selectedId, start: { dateTime: newStart.toISOString(), timeZone: tz }, end: { dateTime: newEnd.toISOString(), timeZone: tz } }),
        });
        if (!res.ok) fetchEvents();
      } catch { fetchEvents(); }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [selectedId, fetchEvents]);

  // ── Auto-scroll to current time ───────────────────────────────────────────
  useEffect(() => {
    if (gridRef.current && nowTop > 0) {
      gridRef.current.scrollTop = Math.max(0, nowTop - 120);
    }
  }, [nowTop]);

  // ── Scrollbar width compensation ─────────────────────────────────────────
  // The scrollable time grid is narrower than the fixed day headers by the
  // scrollbar width. Measure it and add matching padding to the headers.
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const measure = () => setScrollbarWidth(el.offsetWidth - el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Colours ───────────────────────────────────────────────────────────────
  const colorForIndex = (i: number) => PALETTE[i % PALETTE.length];
  const staffColorMap = new Map(
    staffList.map((s, i) => [s.email, colorForIndex(i + 1)])
  );
  const eventColor = staffColorMap.get(selectedId) ?? PALETTE[0];

  const goToday = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const handleSaveOverride = async () => {
    if (!tooltip || !viewingStaff) return;
    setOverrideSaving(true);
    await fetch("/api/calendar/overrides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        staff_id: viewingStaff.id,
        event_id: tooltip.id,
        work_hours: parseFloat(overrideHours) || 0,
        note: overrideNote.trim() || null,
      }),
    });
    setOverrideExisting(parseFloat(overrideHours) || 0);
    setOverrideSaving(false);
  };

  const handleDeleteOverride = async () => {
    if (!tooltip || !viewingStaff) return;
    setOverrideSaving(true);
    await fetch(`/api/calendar/overrides?staff_id=${viewingStaff.id}&event_id=${tooltip.id}`, { method: "DELETE" });
    setOverrideExisting(null);
    setOverrideHours("");
    setOverrideNote("");
    setOverrideSaving(false);
  };

  const handleDelete = async (ev: GEvent) => {
    if (!confirm(`Delete "${ev.summary || "this event"}"?`)) return;
    await fetch(`/api/calendar/events/${ev.id}?calendarId=${encodeURIComponent(selectedId)}`, { method: "DELETE" });
    setTooltip(null);
    fetchEvents();
  };

  // Only own calendar is editable (primary = your own)
  const isOwnCalendar = selectedId === "primary";

  // The staff member whose calendar is being viewed (null if "My Calendar")
  const viewingStaff = selectedId !== "primary"
    ? staffList.find((s) => s.email === selectedId) ?? null
    : null;

  // Load existing override when the detail modal opens on a staff calendar
  useEffect(() => {
    setOverrideHours("");
    setOverrideNote("");
    setOverrideExisting(null);
    if (!tooltip || !viewingStaff || role !== "admin") return;
    fetch(`/api/calendar/overrides?staff_id=${viewingStaff.id}`)
      .then((r) => r.json())
      .then((d) => {
        const match = (d.overrides ?? []).find((o: any) => o.event_id === tooltip.id);
        if (match) {
          setOverrideExisting(match.work_hours);
          setOverrideHours(String(match.work_hours));
          setOverrideNote(match.note ?? "");
        }
      })
      .catch(() => {});
  }, [tooltip?.id, viewingStaff?.id, role]);

  // Hex with alpha suffix helper
  const hexA = (hex: string, alpha: number) => {
    const a = Math.round(alpha * 255).toString(16).padStart(2, "0");
    return hex + a;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] md:h-[calc(100vh-120px)] min-h-0">
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
          {isOwnCalendar && (
            <button
              onClick={() => setShowNewEvent(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#223149] text-white rounded-lg hover:bg-[#1a2638] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Event
            </button>
          )}
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
            {staffList.filter((s) => s.email !== userEmail).map((s, i) => {
              const calId = s.email;
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

        {/* Legend */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-sm border-l-2"
              style={{ backgroundColor: hexA(eventColor.hex, 0.1), borderLeftColor: hexA(eventColor.hex, 0.5) }}
            />
            <span className="text-xs text-[#9BADB7]">Working (free)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: eventColor.hex }} />
            <span className="text-xs text-[#9BADB7]">Busy</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm border-l-2 bg-rose-100 border-rose-400" />
            <span className="text-xs text-[#9BADB7]">Out of office</span>
          </div>
        </div>
      </div>

      {/* ── Pending invites panel ──────────────────────────────────── */}
      {pendingInvites.length > 0 && (
        <div className="flex-shrink-0 mb-3">
          <button
            onClick={() => setShowPendingInvites((v) => !v)}
            className="flex items-center gap-2 text-xs font-semibold text-[#223149] mb-2 group"
          >
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
              {pendingInvites.length}
            </span>
            <span>Pending invite{pendingInvites.length !== 1 ? "s" : ""}</span>
            <svg
              className={`w-3.5 h-3.5 text-[#9BADB7] transition-transform ${showPendingInvites ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showPendingInvites && (
            <div className="bg-white rounded-2xl shadow-sm border border-amber-100 divide-y divide-[#F8F6F4] overflow-hidden">
              {pendingInvites.map((ev) => {
                const dateLabel = ev.start.dateTime
                  ? isMultiDayTimed(ev)
                    ? `${format(new Date(ev.start.dateTime), "EEE d MMM, h:mm a")} – ${format(new Date(ev.end.dateTime!), "EEE d MMM, h:mm a")}`
                    : `${format(new Date(ev.start.dateTime), "EEE d MMM, h:mm")}–${format(new Date(ev.end.dateTime!), "h:mm a")}`
                  : ev.start.date
                  ? format(new Date(ev.start.date), "EEE d MMM") + " · All day"
                  : "";
                const organiser = ev.attendees?.find((a) => a.organizer);
                const organiserStaff = organiser ? staffList.find((s) => s.email === organiser.email) : null;
                const organiserName = organiserStaff?.full_name ?? organiser?.email?.split("@")[0];
                return (
                  <div key={ev.id} className="flex items-center gap-3 px-4 py-3 flex-wrap sm:flex-nowrap">
                    {/* Event info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#223149] truncate">{ev.summary || "(No title)"}</p>
                      <p className="text-xs text-[#9BADB7] mt-0.5">{dateLabel}</p>
                      {organiserName && (
                        <p className="text-xs text-[#9BADB7]">From {organiserName}</p>
                      )}
                    </div>
                    {/* RSVP buttons */}
                    <div className="flex gap-1.5 flex-shrink-0">
                      {(["accepted", "tentative", "declined"] as const).map((status) => {
                        const labels = { accepted: "✓ Yes", tentative: "~ Maybe", declined: "✗ No" };
                        const colours = {
                          accepted: "border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400",
                          tentative: "border-amber-200 text-amber-700 hover:bg-amber-50 hover:border-amber-400",
                          declined: "border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-400",
                        };
                        return (
                          <button
                            key={status}
                            onClick={() => handleRsvpFromPanel(ev, status)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${colours[status]}`}
                          >
                            {labels[status]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Error ──────────────────────────────────────────────────── */}
      {error && (
        <div className="flex-shrink-0 mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-center justify-between gap-3">
          <span>
            {error.includes("401") || error.includes("token")
              ? "Your Google session has expired."
              : error.includes("403") || error.includes("forbidden") || error.includes("notFound")
              ? `No access to ${selectedLabel}'s calendar. They may need to share it with you in Google Calendar.`
              : error}
          </span>
          {(error.includes("401") || error.includes("token")) && (
            <a
              href="/api/auth/signin"
              className="flex-shrink-0 px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors"
            >
              Re-connect Google
            </a>
          )}
        </div>
      )}

      {/* ── Calendar grid ──────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 bg-white rounded-2xl shadow-sm overflow-x-auto flex flex-col">
        <div className="flex flex-col flex-1 min-h-0 min-w-[560px]">
        {/* Day headers — paddingRight compensates for the scrollbar width in the grid below */}
        <div
          className="flex-shrink-0 grid border-b border-[#ECE3DF]"
          style={{ gridTemplateColumns: "52px repeat(7, 1fr)", paddingRight: scrollbarWidth }}
        >
          <div className="border-r border-[#ECE3DF]" />
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
          <div
            className="flex-shrink-0 grid border-b border-[#ECE3DF]"
            style={{ gridTemplateColumns: "52px repeat(7, 1fr)", paddingRight: scrollbarWidth }}
          >
            <div className="border-r border-[#ECE3DF] flex items-center justify-end pr-2">
              <span className="text-[10px] text-[#9BADB7]">all-day</span>
            </div>
            {days.map((day) => {
              const allDay = allDayEventsForDay(events, day);
              return (
                <div key={day.toISOString()} className="border-r border-[#ECE3DF] last:border-r-0 p-1 min-h-[28px]">
                  {allDay.map((ev) => {
                    const ooo = isOOO(ev);
                    const free = isFreeEvent(ev);
                    const bg = ooo
                      ? "bg-rose-100 text-rose-600"
                      : free
                      ? "text-white"
                      : "text-white " + eventColor.event.split(" ")[0];
                    return (
                      <div
                        key={ev.id}
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded mb-0.5 truncate cursor-pointer ${bg}`}
                        style={
                          free && !ooo
                            ? { backgroundColor: hexA(eventColor.hex, 0.15), color: eventColor.hex }
                            : undefined
                        }
                        onClick={() => setTooltip(tooltip?.id === ev.id ? null : ev)}
                      >
                        {ev.summary || (ooo ? "Out of Office" : "(No title)")}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* Timed events grid — scrollable */}
        <div ref={gridRef} className="flex-1 overflow-y-auto">
          <div className="grid relative" style={{ gridTemplateColumns: "52px repeat(7, 1fr)" }}>
            {/* Time labels */}
            <div className="border-r border-[#ECE3DF]">
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="border-b border-[#ECE3DF]/60 flex items-start justify-end pr-2 pt-1"
                  style={{ height: HOUR_H }}
                >
                  <span className="text-[10px] text-[#9BADB7]">
                    {h === 0 ? "12am" : h === 12 ? "12pm" : h > 12 ? `${h - 12}pm` : `${h}am`}
                  </span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((day) => {
              const timed = timedEventsForDay(events, day);
              const freeEvs  = timed.filter(isFreeEvent);
              const oooEvs   = timed.filter(isOOO);
              const busyEvs  = timed.filter(isBusyEvent);
              const positions = layoutEvents(busyEvs);
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

                  {/* ── Layer 1: Free / Working events (background) ── */}
                  {freeEvs.map((ev) => {
                    const isResizing = resizePreview?.eventId === ev.id;
                    const isDragging = dragPreview?.eventId === ev.id;
                    const top = isResizing ? resizePreview!.topPx : eventTopPx(ev);
                    const height = isResizing ? resizePreview!.height : eventHeightPx(ev);
                    const isShort = height < 32;
                    const isTall = height >= 44;
                    const isExtraTall = height >= 60;
                    // Live time — updates during resize
                    const freeStartH = top / HOUR_H + START_H;
                    const freeEndH = (top + height) / HOUR_H + START_H;
                    const freeStartD = new Date(ev.start.dateTime!); freeStartD.setHours(Math.floor(freeStartH), Math.round((freeStartH % 1) * 60), 0, 0);
                    const freeEndD = new Date(ev.start.dateTime!); freeEndD.setHours(Math.floor(freeEndH), Math.round((freeEndH % 1) * 60), 0, 0);
                    const freeTimeLabel = isResizing
                      ? `${format(freeStartD, "h:mm")}–${format(freeEndD, "h:mm a")}`
                      : `${format(new Date(ev.start.dateTime!), "h:mm")}–${format(new Date(ev.end.dateTime!), "h:mm a")}`;
                    return (
                      <div
                        key={ev.id}
                        className={`absolute left-0 right-0 group/ev overflow-hidden ${isOwnCalendar ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${isDragging ? "opacity-30" : ""}`}
                        style={{
                          top,
                          height,
                          backgroundColor: hexA(eventColor.hex, 0.08),
                          borderLeft: `2px solid ${hexA(eventColor.hex, 0.35)}`,
                          zIndex: 1,
                        }}
                        onMouseEnter={(e) => showPopup(ev, e)}
                        onMouseLeave={hidePopup}
                        onMouseDown={isOwnCalendar ? (e) => handleEventMouseDown(e, ev) : undefined}
                        onClick={() => { if (!dragStateRef.current && !resizeStateRef.current) setTooltip(tooltip?.id === ev.id ? null : ev); }}
                      >
                        {/* Top resize handle */}
                        {isOwnCalendar && (
                          <div
                            className="absolute top-0 left-0 right-0 h-2.5 flex items-center justify-center opacity-0 group-hover/ev:opacity-100 cursor-ns-resize z-10"
                            onMouseDown={(e) => { e.stopPropagation(); handleResizeMouseDown(e, ev, "top"); }}
                          >
                            <div className="w-5 h-0.5 rounded-full bg-white/70" />
                          </div>
                        )}

                        {!isShort && (
                          <div className="px-1.5 pt-0.5">
                            <p className="text-[10px] truncate font-medium leading-tight" style={{ color: hexA(eventColor.hex, 0.65) }}>
                              {ev.summary || "Working"}
                            </p>
                            {isTall && (
                              <p className="text-[10px] truncate leading-tight" style={{ color: hexA(eventColor.hex, 0.45) }}>
                                {freeTimeLabel}
                              </p>
                            )}
                            {isExtraTall && ev.location && (
                              <p className="text-[10px] truncate leading-tight" style={{ color: hexA(eventColor.hex, 0.35) }}>
                                📍 {ev.location}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Bottom resize handle */}
                        {isOwnCalendar && (
                          <div
                            className="absolute bottom-0 left-0 right-0 h-2.5 flex items-center justify-center opacity-0 group-hover/ev:opacity-100 cursor-ns-resize z-10"
                            onMouseDown={(e) => { e.stopPropagation(); handleResizeMouseDown(e, ev, "bottom"); }}
                          >
                            <div className="w-5 h-0.5 rounded-full bg-white/70" />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* ── Layer 2: Out of Office ── */}
                  {oooEvs.map((ev) => {
                    const top = eventTopPx(ev);
                    const height = eventHeightPx(ev);
                    const isShort = height < 32;
                    const isTall = height >= 44;
                    const isExtraTall = height >= 60;
                    const oooTimeLabel = ev.start.dateTime
                      ? `${format(new Date(ev.start.dateTime), "h:mm")}–${format(new Date(ev.end.dateTime!), "h:mm a")}`
                      : null;
                    return (
                      <div
                        key={ev.id}
                        className="absolute left-0 right-0 overflow-hidden cursor-pointer"
                        style={{
                          top,
                          height,
                          backgroundColor: "rgba(251, 207, 232, 0.35)",
                          borderLeft: "2px solid #f9a8d4",
                          zIndex: 2,
                        }}
                        onMouseEnter={(e) => showPopup(ev, e)}
                        onMouseLeave={hidePopup}
                        onClick={() => setTooltip(tooltip?.id === ev.id ? null : ev)}
                      >
                        {!isShort && (
                          <div className="px-1.5 pt-0.5">
                            <p className="text-[10px] truncate font-medium text-rose-500 leading-tight">
                              {ev.summary || "Out of Office"}
                            </p>
                            {isTall && oooTimeLabel && (
                              <p className="text-[10px] truncate text-rose-400 leading-tight">{oooTimeLabel}</p>
                            )}
                            {isExtraTall && ev.location && (
                              <p className="text-[10px] truncate text-rose-300 leading-tight">📍 {ev.location}</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Current time line */}
                  {isCurrentDay && nowTop >= 0 && nowTop <= HOUR_H * HOURS.length && (
                    <div
                      className="absolute w-full flex items-center pointer-events-none"
                      style={{ top: nowTop, zIndex: 10 }}
                    >
                      <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 flex-shrink-0" />
                      <div className="flex-1 border-t-2 border-red-500" />
                    </div>
                  )}

                  {/* ── Layer 3: Busy events ── */}
                  {busyEvs.map((ev) => {
                    const pos = positions.get(ev.id) ?? { left: 0, width: 96 };
                    const isResizing = resizePreview?.eventId === ev.id;
                    const isDragging = dragPreview?.eventId === ev.id;
                    const top = isResizing ? resizePreview!.topPx : eventTopPx(ev);
                    const height = isResizing ? resizePreview!.height : eventHeightPx(ev);
                    const isTall = height >= 44;
                    const isExtraTall = height >= 60;
                    // Live time label — updates during resize
                    const liveStartH = top / HOUR_H + START_H;
                    const liveEndH = (top + height) / HOUR_H + START_H;
                    const liveStart = new Date(ev.start.dateTime!);
                    liveStart.setHours(Math.floor(liveStartH), Math.round((liveStartH % 1) * 60), 0, 0);
                    const liveEnd = new Date(ev.start.dateTime!);
                    liveEnd.setHours(Math.floor(liveEndH), Math.round((liveEndH % 1) * 60), 0, 0);
                    const timeLabel = isResizing
                      ? `${format(liveStart, "h:mm")}–${format(liveEnd, "h:mm a")}`
                      : `${format(new Date(ev.start.dateTime!), "h:mm")}–${format(new Date(ev.end.dateTime!), "h:mm a")}`;
                    return (
                      <div
                        key={ev.id}
                        className={`absolute group/ev rounded-lg border-l-2 overflow-hidden transition-opacity ${eventColor.event} ${isOwnCalendar ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${isDragging ? "opacity-30" : "hover:brightness-95"}`}
                        style={{ top, height, left: `${pos.left}%`, width: `${pos.width}%`, zIndex: hoveredEventId === ev.id ? 15 : 5 }}
                        onMouseEnter={(e) => { setHoveredEventId(ev.id); showPopup(ev, e); }}
                        onMouseLeave={() => { setHoveredEventId(null); hidePopup(); }}
                        onMouseDown={isOwnCalendar ? (e) => handleEventMouseDown(e, ev) : undefined}
                        onClick={() => { if (!dragStateRef.current && !resizeStateRef.current) setTooltip(tooltip?.id === ev.id ? null : ev); }}
                      >
                        {/* Top resize handle */}
                        {isOwnCalendar && (
                          <div
                            className="absolute top-0 left-0 right-0 h-2.5 flex items-center justify-center opacity-0 group-hover/ev:opacity-100 cursor-ns-resize z-10"
                            onMouseDown={(e) => { e.stopPropagation(); handleResizeMouseDown(e, ev, "top"); }}
                          >
                            <div className="w-5 h-0.5 rounded-full bg-white/70" />
                          </div>
                        )}

                        <div className="px-1.5 py-1">
                          <p className="text-[11px] font-semibold text-white leading-tight truncate">
                            {ev.summary || "(No title)"}
                          </p>
                          {isTall && (
                            <p className="text-[10px] text-white/80 leading-tight truncate">{timeLabel}</p>
                          )}
                          {isExtraTall && ev.location && (
                            <p className="text-[10px] text-white/60 leading-tight truncate">📍 {ev.location}</p>
                          )}
                        </div>

                        {/* Bottom resize handle */}
                        {isOwnCalendar && (
                          <div
                            className="absolute bottom-0 left-0 right-0 h-2.5 flex items-center justify-center opacity-0 group-hover/ev:opacity-100 cursor-ns-resize z-10"
                            onMouseDown={(e) => { e.stopPropagation(); handleResizeMouseDown(e, ev, "bottom"); }}
                          >
                            <div className="w-5 h-0.5 rounded-full bg-white/70" />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* ── Drag preview ghost ── */}
                  {dragPreview && dragPreview.dayIndex === days.indexOf(day) && (() => {
                    const dragEv = events.find((ev) => ev.id === dragPreview.eventId);
                    if (!dragEv) return null;
                    const height = eventHeightPx(dragEv);
                    const isFree = isFreeEvent(dragEv);
                    const isShortGhost = height < 40;
                    // Compute live start/end from current drag position
                    const ghostH = dragPreview.topPx / HOUR_H + START_H;
                    const ghostStart = new Date(days[dragPreview.dayIndex]);
                    ghostStart.setHours(Math.floor(ghostH), Math.round((ghostH % 1) * 60), 0, 0);
                    const duration = new Date(dragEv.end.dateTime!).getTime() - new Date(dragEv.start.dateTime!).getTime();
                    const ghostEnd = new Date(ghostStart.getTime() + duration);
                    const ghostTimeLabel = `${format(ghostStart, "h:mm")}–${format(ghostEnd, "h:mm a")}`;
                    return isFree ? (
                      <div
                        className="absolute left-0 right-0 pointer-events-none overflow-hidden"
                        style={{
                          top: dragPreview.topPx,
                          height,
                          backgroundColor: hexA(eventColor.hex, 0.2),
                          borderLeft: `2px dashed ${hexA(eventColor.hex, 0.6)}`,
                          zIndex: 20,
                        }}
                      >
                        <p className="text-[10px] px-1.5 pt-0.5 truncate font-medium" style={{ color: hexA(eventColor.hex, 0.7) }}>
                          {dragEv.summary || "Working"}
                        </p>
                        {!isShortGhost && (
                          <p className="text-[10px] px-1.5 truncate" style={{ color: hexA(eventColor.hex, 0.55) }}>
                            {ghostTimeLabel}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div
                        className={`absolute left-1 right-1 rounded-lg border-2 border-dashed pointer-events-none overflow-hidden ${eventColor.event}`}
                        style={{ top: dragPreview.topPx, height, zIndex: 20, opacity: 0.85 }}
                      >
                        <div className="px-1.5 py-1">
                          <p className="text-[11px] font-semibold text-white leading-tight truncate">
                            {dragEv.summary || "(No title)"}
                          </p>
                          {!isShortGhost && (
                            <p className="text-[10px] text-white/80 leading-tight">{ghostTimeLabel}</p>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>
        </div>{/* end min-w wrapper */}
      </div>

      {/* ── Hover popup (all event types) ─────────────────────────── */}
      {hoverPopup && (() => {
        const ev = hoverPopup.event;
        const ooo = isOOO(ev);
        const free = isFreeEvent(ev);
        const badge = ooo
          ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">Out of Office</span>
          : free
          ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">Working — available</span>
          : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#223149]/10 text-[#223149]">Busy</span>;
        const timeLabel = ev.start.dateTime
          ? isMultiDayTimed(ev)
            ? `${format(new Date(ev.start.dateTime), "EEE d MMM, h:mm a")} – ${format(new Date(ev.end.dateTime!), "EEE d MMM, h:mm a")}`
            : `${format(new Date(ev.start.dateTime), "h:mm")}–${format(new Date(ev.end.dateTime!), "h:mm a")}`
          : null;
        const canEdit = isOwnCalendar && !ooo && !isAllDayLike(ev);
        return (
          <div
            className="fixed z-50 bg-white rounded-xl shadow-xl border border-[#ECE3DF] p-3 w-64 pointer-events-auto"
            style={{
              left: Math.min(hoverPopup.x + 14, (typeof window !== "undefined" ? window.innerWidth : 800) - 268),
              top: Math.max(8, hoverPopup.y - 50),
            }}
            onMouseEnter={() => { if (hoverPopupTimeout.current) clearTimeout(hoverPopupTimeout.current); }}
            onMouseLeave={() => { hoverPopupTimeout.current = setTimeout(() => setHoverPopup(null), 200); }}
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              {badge}
              <button onClick={() => setHoverPopup(null)} className="text-[#9BADB7] hover:text-[#223149] flex-shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-sm font-semibold text-[#223149] truncate">{ev.summary || (ooo ? "Out of Office" : "(No title)")}</p>
            {timeLabel && <p className="text-xs text-[#9BADB7] mt-0.5">{timeLabel}</p>}
            {ev.location && <p className="text-xs text-[#9BADB7] mt-0.5 truncate">📍 {ev.location}</p>}

            {/* Attendees list with response status */}
            {ev.attendees && ev.attendees.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-[10px] font-semibold text-[#9BADB7] uppercase tracking-wide">Attendees</p>
                {ev.attendees.slice(0, 5).map((a) => {
                  const staff = staffList.find((s) => s.email === a.email);
                  const name = staff ? staff.full_name : a.email.split("@")[0];
                  const statusIcon =
                    a.responseStatus === "accepted" ? "✓"
                    : a.responseStatus === "declined" ? "✗"
                    : a.responseStatus === "tentative" ? "~"
                    : "·";
                  const statusColor =
                    a.responseStatus === "accepted" ? "text-emerald-500"
                    : a.responseStatus === "declined" ? "text-rose-500"
                    : a.responseStatus === "tentative" ? "text-amber-500"
                    : "text-[#9BADB7]";
                  return (
                    <div key={a.email} className="flex items-center gap-1.5 min-w-0">
                      <span className={`text-xs font-bold w-3 text-center flex-shrink-0 ${statusColor}`}>{statusIcon}</span>
                      <span className="text-xs text-[#223149] truncate">{name}</span>
                      {a.email === userEmail && <span className="text-[10px] text-[#9BADB7] ml-auto flex-shrink-0">(you)</span>}
                    </div>
                  );
                })}
                {ev.attendees.length > 5 && (
                  <p className="text-[10px] text-[#9BADB7]">+{ev.attendees.length - 5} more</p>
                )}
              </div>
            )}

            {/* RSVP buttons — shown when user is an attendee */}
            {ev.attendees?.some((a) => a.email === userEmail) && (() => {
              const myRsvp = ev.attendees!.find((a) => a.email === userEmail)?.responseStatus;
              return (
                <div className="mt-2 pt-2 border-t border-[#ECE3DF]">
                  <p className="text-[10px] font-semibold text-[#9BADB7] uppercase tracking-wide mb-1.5">Your response</p>
                  <div className="flex gap-1">
                    {(["accepted", "tentative", "declined"] as const).map((status) => {
                      const labels = { accepted: "✓ Yes", tentative: "~ Maybe", declined: "✗ No" };
                      const activeClass = {
                        accepted: "bg-emerald-500 text-white border-emerald-500",
                        tentative: "bg-amber-500 text-white border-amber-500",
                        declined: "bg-rose-500 text-white border-rose-500",
                      };
                      const hoverClass = {
                        accepted: "hover:bg-emerald-50 hover:border-emerald-300",
                        tentative: "hover:bg-amber-50 hover:border-amber-300",
                        declined: "hover:bg-rose-50 hover:border-rose-300",
                      };
                      const isActive = myRsvp === status;
                      return (
                        <button
                          key={status}
                          disabled={rsvpLoading !== null}
                          onClick={() => handleRsvp(ev, status)}
                          className={`flex-1 text-[10px] font-semibold py-1.5 rounded-lg border transition-colors disabled:opacity-60 ${
                            isActive
                              ? activeClass[status]
                              : `border-[#ECE3DF] text-[#5F7C84] ${hoverClass[status]}`
                          }`}
                        >
                          {rsvpLoading === status ? "…" : labels[status]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <div className="flex gap-1.5 mt-2">
              <button
                className="flex-1 text-xs text-[#223149] font-semibold py-1.5 rounded-lg border border-[#ECE3DF] hover:bg-[#F8F6F4] transition-colors"
                onClick={() => { setTooltip(ev); setHoverPopup(null); }}
              >
                View
              </button>
              {canEdit && (
                <button
                  className="flex-1 text-xs text-[#223149] font-semibold py-1.5 rounded-lg border border-[#ECE3DF] hover:bg-[#F8F6F4] transition-colors"
                  onClick={() => { setEditingEvent(ev); setHoverPopup(null); }}
                >
                  Edit
                </button>
              )}
              {canEdit && (
                <button
                  className="flex-1 text-xs text-[#223149] font-semibold py-1.5 rounded-lg border border-[#ECE3DF] hover:bg-[#F8F6F4] transition-colors"
                  onClick={() => { setDuplicatingEvent(ev); setHoverPopup(null); }}
                >
                  Copy
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Event detail modal ─────────────────────────────────────── */}
      {tooltip && (
        <div
          className="fixed inset-0 z-40 flex items-end md:items-center justify-center p-4 bg-black/30"
          onClick={() => setTooltip(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl p-5 w-full max-w-sm space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Status badge + actions */}
            <div className="flex items-center justify-between gap-2">
              {isOOO(tooltip) ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">
                  Out of Office
                </span>
              ) : isFreeEvent(tooltip) ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                  Working — available
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#223149]/10 text-[#223149]">
                  Busy
                </span>
              )}

              {/* Edit / Duplicate / Delete — only on your own calendar */}
              {isOwnCalendar && !isAllDayLike(tooltip) && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setEditingEvent(tooltip); setTooltip(null); }}
                    className="p-1.5 rounded-lg hover:bg-[#F8F6F4] transition-colors"
                    title="Edit event"
                  >
                    <Pencil className="w-4 h-4 text-[#5F7C84]" />
                  </button>
                  <button
                    onClick={() => { setDuplicatingEvent(tooltip); setTooltip(null); }}
                    className="p-1.5 rounded-lg hover:bg-[#F8F6F4] transition-colors"
                    title="Duplicate event"
                  >
                    <Copy className="w-4 h-4 text-[#5F7C84]" />
                  </button>
                  <button
                    onClick={() => handleDelete(tooltip)}
                    className="p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                    title="Delete event"
                  >
                    <Trash2 className="w-4 h-4 text-rose-400" />
                  </button>
                </div>
              )}
            </div>

            <h3 className="text-lg font-bold text-[#223149]">{tooltip.summary || "(No title)"}</h3>

            <div className="space-y-1 text-sm text-[#5F7C84]">
              {tooltip.start.dateTime ? (
                <p>
                  {format(new Date(tooltip.start.dateTime), "EEE d MMM, h:mm a")}
                  {" – "}
                  {isMultiDayTimed(tooltip)
                    ? format(new Date(tooltip.end.dateTime!), "EEE d MMM, h:mm a")
                    : format(new Date(tooltip.end.dateTime!), "h:mm a")}
                </p>
              ) : (
                <p>{format(new Date(tooltip.start.date!), "EEE d MMM")} · All day</p>
              )}
              {tooltip.location && <p>📍 {tooltip.location}</p>}
              {tooltip.attendees && tooltip.attendees.length > 0 && (
                <div className="pt-1">
                  <p className="text-xs font-semibold text-[#9BADB7] uppercase tracking-wide mb-1">Attendees</p>
                  <div className="flex flex-wrap gap-1">
                    {tooltip.attendees.map((a) => {
                      const staff = staffList.find((s) => s.email === a.email);
                      return (
                        <span key={a.email} className="inline-flex items-center px-2 py-0.5 bg-[#F8F6F4] rounded-full text-xs text-[#223149]">
                          {staff ? staff.full_name : a.email}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Work-hour override — admin only, staff calendars only */}
            {role === "admin" && viewingStaff && (
              <div className="pt-3 border-t border-[#ECE3DF] space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-[#9BADB7] uppercase tracking-wide">
                    Work hours (TOIL)
                  </p>
                  {overrideExisting !== null && (
                    <button
                      onClick={handleDeleteOverride}
                      disabled={overrideSaving}
                      className="text-[10px] text-red-400 hover:text-red-600 transition-colors disabled:opacity-50"
                    >
                      Reset to auto
                    </button>
                  )}
                </div>
                {overrideExisting !== null && (
                  <p className="text-[10px] text-amber-600 bg-amber-50 rounded-lg px-2 py-1">
                    Override set: {overrideExisting}h (auto would be full duration)
                  </p>
                )}
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={overrideHours}
                    onChange={(e) => setOverrideHours(e.target.value)}
                    placeholder="e.g. 8 or 0"
                    className="flex-1 px-3 py-1.5 text-sm rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
                  />
                  <span className="text-xs text-[#9BADB7] self-center">hrs</span>
                  <button
                    onClick={handleSaveOverride}
                    disabled={overrideSaving || overrideHours === ""}
                    className="px-3 py-1.5 bg-[#223149] text-white text-xs font-semibold rounded-xl hover:bg-[#1a2638] transition-colors disabled:opacity-50"
                  >
                    {overrideSaving ? "Saving…" : "Save"}
                  </button>
                </div>
                <input
                  type="text"
                  value={overrideNote}
                  onChange={(e) => setOverrideNote(e.target.value)}
                  placeholder="Note (optional)"
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
                />
              </div>
            )}

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

      {/* ── Edit event modal ───────────────────────────────────────── */}
      {editingEvent && editingEvent.start.dateTime && (
        <EventFormModal
          calendarId={selectedId}
          staffList={staffList}
          initial={{
            id: editingEvent.id,
            summary: editingEvent.summary ?? "",
            startDateTime: format(new Date(editingEvent.start.dateTime), "yyyy-MM-dd'T'HH:mm"),
            endDateTime: format(new Date(editingEvent.end.dateTime!), "yyyy-MM-dd'T'HH:mm"),
            transparency: editingEvent.transparency ?? "opaque",
            attendees: editingEvent.attendees?.map((a) => a.email) ?? [],
            recurringEventId: editingEvent.recurringEventId,
            existingRules: editingEvent.recurrence,
          }}
          onClose={() => setEditingEvent(null)}
          onSuccess={() => { setEditingEvent(null); fetchEvents(); }}
        />
      )}

      {/* ── Duplicate event modal ─────────────────────────────────── */}
      {duplicatingEvent && duplicatingEvent.start.dateTime && (
        <EventFormModal
          calendarId={selectedId}
          staffList={staffList}
          initial={{
            summary: `${duplicatingEvent.summary ?? ""} (copy)`,
            startDateTime: format(new Date(duplicatingEvent.start.dateTime), "yyyy-MM-dd'T'HH:mm"),
            endDateTime: format(new Date(duplicatingEvent.end.dateTime!), "yyyy-MM-dd'T'HH:mm"),
            transparency: duplicatingEvent.transparency ?? "opaque",
            attendees: duplicatingEvent.attendees?.map((a) => a.email) ?? [],
          }}
          onClose={() => setDuplicatingEvent(null)}
          onSuccess={() => { setDuplicatingEvent(null); fetchEvents(); }}
        />
      )}

      {/* ── New event modal ────────────────────────────────────────── */}
      {showNewEvent && (
        <EventFormModal
          calendarId={selectedId}
          staffList={staffList}
          onClose={() => setShowNewEvent(false)}
          onSuccess={() => { setShowNewEvent(false); fetchEvents(); }}
        />
      )}
    </div>
  );
}
