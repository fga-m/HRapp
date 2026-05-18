"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, Copy, Plus, Pencil, Trash2, X } from "lucide-react";
import {
  format, startOfWeek, addDays, isToday, eachDayOfInterval,
  addWeeks, subWeeks, isSameDay,
} from "date-fns";

// ── Constants ──────────────────────────────────────────────────────────────
const HOUR_H = 64;
const START_H = 7;
const END_H = 21;
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
  transparency?: string;  // "opaque" (busy, default) | "transparent" (free/available)
  eventType?: string;     // "default" | "outOfOffice" | "focusTime" | "workingLocation"
  attendees?: { email: string; displayName?: string; responseStatus?: string }[];
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
    const d = ev.start.dateTime ? new Date(ev.start.dateTime) : new Date(ev.start.date!);
    return isSameDay(d, day);
  });
}
function allDayEventsForDay(events: GEvent[], day: Date) {
  return eventsForDay(events, day).filter(isAllDay);
}
function timedEventsForDay(events: GEvent[], day: Date) {
  return eventsForDay(events, day).filter((ev) => !isAllDay(ev));
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
type EventFormProps = {
  initial?: {
    id?: string;
    summary: string;
    startDateTime: string;
    endDateTime: string;
    transparency: string;
    attendees?: string[];
  };
  calendarId: string;
  staffList?: StaffMember[];
  onClose: () => void;
  onSuccess: () => void;
};

function EventFormModal({ initial, calendarId, staffList = [], onClose, onSuccess }: EventFormProps) {
  const isEdit = !!initial?.id;
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [startDateTime, setStartDateTime] = useState(
    initial?.startDateTime ?? format(new Date(), "yyyy-MM-dd'T'HH:mm")
  );
  const [endDateTime, setEndDateTime] = useState(
    initial?.endDateTime ?? format(addDays(new Date(), 0), "yyyy-MM-dd'T'HH:mm")
  );
  const [transparency, setTransparency] = useState(initial?.transparency ?? "opaque");
  const [attendees, setAttendees] = useState<string[]>(initial?.attendees ?? []);
  const [attendeeInput, setAttendeeInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const suggestions = staffList.filter(
    (s) => s.email && !attendees.includes(s.email) &&
      (s.full_name.toLowerCase().includes(attendeeInput.toLowerCase()) ||
       s.email.toLowerCase().includes(attendeeInput.toLowerCase()))
  );

  const addAttendee = (email: string) => {
    const e = email.trim().toLowerCase();
    if (!e || attendees.includes(e)) return;
    setAttendees((prev) => [...prev, e]);
    setAttendeeInput("");
    setShowSuggestions(false);
  };

  const removeAttendee = (email: string) => setAttendees((prev) => prev.filter((a) => a !== email));

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
      const body = {
        calendarId,
        summary: summary.trim(),
        start: { dateTime: new Date(startDateTime).toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        end: { dateTime: new Date(endDateTime).toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        transparency,
        attendees: attendees.map((email) => ({ email })),
      };
      const res = isEdit
        ? await fetch(`/api/calendar/events/${initial!.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
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
          <div>
            <label className="block text-sm font-semibold text-[#223149] mb-1.5">
              Invite people <span className="text-xs font-normal text-[#9BADB7]">(optional)</span>
            </label>
            {/* Chips */}
            {attendees.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {attendees.map((email) => {
                  const staff = staffList.find((s) => s.email === email);
                  return (
                    <span key={email} className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#223149]/10 text-[#223149] rounded-full text-xs font-medium">
                      {staff ? staff.full_name : email}
                      <button type="button" onClick={() => removeAttendee(email)} className="hover:text-rose-500 transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
            {/* Input + suggestions */}
            <div className="relative">
              <input
                type="text"
                value={attendeeInput}
                onChange={(e) => { setAttendeeInput(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addAttendee(attendeeInput); }
                  if (e.key === "," || e.key === " ") { e.preventDefault(); addAttendee(attendeeInput); }
                }}
                placeholder="Search name or type email, press Enter to add"
                className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#9BADB7] text-sm focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
              />
              {showSuggestions && (attendeeInput.length > 0) && suggestions.length > 0 && (
                <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-[#ECE3DF] rounded-xl shadow-lg overflow-hidden">
                  {suggestions.slice(0, 5).map((s) => (
                    <button
                      key={s.email}
                      type="button"
                      onMouseDown={() => addAttendee(s.email)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[#F8F6F4] transition-colors"
                    >
                      <div className="w-7 h-7 rounded-full bg-[#223149]/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-[#223149]">{s.full_name[0]}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#223149]">{s.full_name}</p>
                        <p className="text-xs text-[#9BADB7]">{s.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
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
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [selectedId, setSelectedId] = useState("primary");
  const [selectedLabel, setSelectedLabel] = useState("My Calendar");
  const gridRef = useRef<HTMLDivElement>(null);
  const [nowTop, setNowTop] = useState(0);
  const [tooltip, setTooltip] = useState<GEvent | null>(null);
  const [editingEvent, setEditingEvent] = useState<GEvent | null>(null);
  const [duplicatingEvent, setDuplicatingEvent] = useState<GEvent | null>(null);
  const [showNewEvent, setShowNewEvent] = useState(false);

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
      });
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
    if (isAllDay(ev)) return;
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

  // ── Colours ───────────────────────────────────────────────────────────────
  const colorForIndex = (i: number) => PALETTE[i % PALETTE.length];
  const staffColorMap = new Map(
    staffList.map((s, i) => [s.email, colorForIndex(i + 1)])
  );
  const eventColor = staffColorMap.get(selectedId) ?? PALETTE[0];

  const goToday = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const handleDelete = async (ev: GEvent) => {
    if (!confirm(`Delete "${ev.summary || "this event"}"?`)) return;
    await fetch(`/api/calendar/events/${ev.id}?calendarId=${encodeURIComponent(selectedId)}`, { method: "DELETE" });
    setTooltip(null);
    fetchEvents();
  };

  // Only own calendar is editable (primary = your own)
  const isOwnCalendar = selectedId === "primary";

  // Hex with alpha suffix helper
  const hexA = (hex: string, alpha: number) => {
    const a = Math.round(alpha * 255).toString(16).padStart(2, "0");
    return hex + a;
  };

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
            {staffList.map((s, i) => {
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
      <div className="flex-1 min-h-0 bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col">
        {/* Day headers */}
        <div
          className="flex-shrink-0 grid border-b border-[#ECE3DF]"
          style={{ gridTemplateColumns: "52px repeat(7, 1fr)" }}
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
            style={{ gridTemplateColumns: "52px repeat(7, 1fr)" }}
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
                    {h === 12 ? "12pm" : h > 12 ? `${h - 12}pm` : `${h}am`}
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
                    const top = eventTopPx(ev);
                    const height = eventHeightPx(ev);
                    const isShort = height < 32;
                    return (
                      <div
                        key={ev.id}
                        className="absolute left-0 right-0 cursor-pointer overflow-hidden"
                        style={{
                          top,
                          height,
                          backgroundColor: hexA(eventColor.hex, 0.08),
                          borderLeft: `2px solid ${hexA(eventColor.hex, 0.35)}`,
                          zIndex: 1,
                        }}
                        onClick={() => setTooltip(tooltip?.id === ev.id ? null : ev)}
                      >
                        {!isShort && (
                          <p
                            className="text-[10px] px-1.5 pt-0.5 truncate font-medium"
                            style={{ color: hexA(eventColor.hex, 0.55) }}
                          >
                            {ev.summary || "Working"}
                          </p>
                        )}
                      </div>
                    );
                  })}

                  {/* ── Layer 2: Out of Office ── */}
                  {oooEvs.map((ev) => {
                    const top = eventTopPx(ev);
                    const height = eventHeightPx(ev);
                    const isShort = height < 32;
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
                        onClick={() => setTooltip(tooltip?.id === ev.id ? null : ev)}
                      >
                        {!isShort && (
                          <p className="text-[10px] px-1.5 pt-0.5 truncate font-medium text-rose-500">
                            {ev.summary || "Out of Office"}
                          </p>
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
                    const isShort = height < 40;
                    const startLabel = format(new Date(ev.start.dateTime!), "h:mm a");
                    return (
                      <div
                        key={ev.id}
                        className={`absolute group/ev rounded-lg border-l-2 overflow-hidden transition-opacity ${eventColor.event} ${isOwnCalendar ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${isDragging ? "opacity-30" : "hover:brightness-95"}`}
                        style={{ top, height, left: `${pos.left}%`, width: `${pos.width}%`, zIndex: 5 }}
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
                          {!isShort && (
                            <p className="text-[10px] text-white/80 leading-tight">{startLabel}</p>
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
                    return (
                      <div
                        className={`absolute left-1 right-1 rounded-lg border-2 border-dashed pointer-events-none ${eventColor.event}`}
                        style={{ top: dragPreview.topPx, height, zIndex: 20, opacity: 0.85 }}
                      >
                        <p className="text-[11px] font-semibold text-white px-1.5 py-1 truncate">
                          {dragEv.summary || "(No title)"}
                        </p>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>
      </div>

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
              {isOwnCalendar && !isAllDay(tooltip) && (
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
                  {format(new Date(tooltip.end.dateTime!), "h:mm a")}
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
