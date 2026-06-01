"use client";

import { useEffect, useState } from "react";
import { Clock, Edit2, Check, X, Plus, AlertTriangle } from "lucide-react";
import { format, parseISO } from "date-fns";

const DAYS = [
  { key: "monday",    label: "Mon", full: "Monday" },
  { key: "tuesday",   label: "Tue", full: "Tuesday" },
  { key: "wednesday", label: "Wed", full: "Wednesday" },
  { key: "thursday",  label: "Thu", full: "Thursday" },
  { key: "friday",    label: "Fri", full: "Friday" },
  { key: "saturday",  label: "Sat", full: "Saturday" },
  { key: "sunday",    label: "Sun", full: "Sunday" },
];

interface Slot { start: string; end: string; }
interface DaySchedule { enabled: boolean; slots: Slot[]; }
// Flexible fields sit alongside day keys in the same flat JSON object
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WeekSchedule = Record<string, any>;

interface ScheduleCardProps {
  staffId: string;
  canEdit: boolean;
  contractedHours?: number; // from staff.contracted_hours — used to show mismatch warning
}

function slotHours(slot: Slot): number {
  const [sh, sm] = slot.start.split(":").map(Number);
  const [eh, em] = slot.end.split(":").map(Number);
  return Math.max(0, (eh * 60 + em - (sh * 60 + sm)) / 60);
}

// Whether a day should have a 30-min lunch deduction applied:
// only when there is a single continuous slot >= 5.5 hours (split slots already exclude lunch).
function lunchDeduction(day: DaySchedule): number {
  if (!day.enabled || day.slots.length !== 1) return 0;
  const raw = slotHours(day.slots[0]);
  return raw >= 5.5 ? 0.5 : 0;
}

function dayHours(day: DaySchedule): number {
  if (!day.enabled) return 0;
  const raw = day.slots.reduce((t, s) => t + slotHours(s), 0);
  return raw - lunchDeduction(day);
}

function totalWeekHours(schedule: WeekSchedule): number {
  const fixed = Object.entries(schedule)
    .filter(([k]) => !["flexible", "flexible_hours"].includes(k))
    .reduce((t, [, d]) => t + dayHours(d as DaySchedule), 0);
  return fixed + (schedule.flexible_hours ?? 0);
}

function fmtHours(h: number): string {
  return h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`;
}

function SlotDisplay({ slot }: { slot: Slot }) {
  return (
    <span className="text-sm text-[#5F7C84]">
      {slot.start}
      <span className="text-[#9BADB7] text-xs mx-1">–</span>
      {slot.end}
      <span className="text-xs text-[#9BADB7] ml-1">({fmtHours(slotHours(slot))})</span>
    </span>
  );
}

function SlotEditor({
  slot,
  onChange,
  onRemove,
  canRemove,
}: {
  slot: Slot;
  onChange: (s: Slot) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="time"
        value={slot.start}
        onChange={(e) => onChange({ ...slot, start: e.target.value })}
        className="px-2 py-1 text-sm border border-[#ECE3DF] rounded-lg text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
      />
      <span className="text-xs text-[#9BADB7]">to</span>
      <input
        type="time"
        value={slot.end}
        onChange={(e) => onChange({ ...slot, end: e.target.value })}
        className="px-2 py-1 text-sm border border-[#ECE3DF] rounded-lg text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
      />
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="p-1 rounded-lg hover:bg-red-50 text-[#9BADB7] hover:text-red-400 transition-colors"
          title="Remove slot"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export default function ScheduleCard({ staffId, canEdit, contractedHours }: ScheduleCardProps) {
  const [schedule, setSchedule] = useState<WeekSchedule | null>(null);
  const [draft, setDraft] = useState<WeekSchedule | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/staff/${staffId}/schedule`)
      .then((r) => r.json())
      .then((d) => {
        setSchedule(d.schedule);
        setUpdatedAt(d.updated_at);
      });
  }, [staffId]);

  const startEditing = () => {
    setDraft(JSON.parse(JSON.stringify(schedule)));
    setEditing(true);
    setError("");
  };

  const cancelEditing = () => {
    setDraft(null);
    setEditing(false);
    setError("");
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/staff/${staffId}/schedule`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule: draft }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed to save");
      setSchedule(draft);
      setUpdatedAt(d.updated_at);
      setEditing(false);
      setDraft(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (key: string) => {
    if (!draft) return;
    setDraft({ ...draft, [key]: { ...draft[key], enabled: !draft[key].enabled } });
  };

  const updateSlot = (dayKey: string, i: number, slot: Slot) => {
    if (!draft) return;
    const slots = [...draft[dayKey].slots];
    slots[i] = slot;
    setDraft({ ...draft, [dayKey]: { ...draft[dayKey], slots } });
  };

  const addSlot = (dayKey: string) => {
    if (!draft) return;
    const prev = draft[dayKey].slots[draft[dayKey].slots.length - 1];
    // Default: start 30 min after previous slot ends, run for 4h — capped at 23:00/23:30
    const [eh, em] = prev.end.split(":").map(Number);
    const prevEndMins = eh * 60 + em;
    const startMins = Math.min(prevEndMins + 30, 23 * 60);       // cap start at 23:00
    const endMins   = Math.min(startMins + 4 * 60, 23 * 60 + 30); // cap end at 23:30
    const toTime = (mins: number) =>
      String(Math.floor(mins / 60)).padStart(2, "0") + ":" + String(mins % 60).padStart(2, "0");
    setDraft({
      ...draft,
      [dayKey]: { ...draft[dayKey], slots: [...draft[dayKey].slots, { start: toTime(startMins), end: toTime(endMins) }] },
    });
  };

  const removeSlot = (dayKey: string, i: number) => {
    if (!draft) return;
    const slots = draft[dayKey].slots.filter((_: Slot, idx: number) => idx !== i);
    setDraft({ ...draft, [dayKey]: { ...draft[dayKey], slots } });
  };

  const setFlexibleHours = (h: number) => {
    if (!draft) return;
    setDraft({ ...draft, flexible_hours: h });
  };

  const current = editing ? draft : schedule;

  if (!current) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-[#9BADB7]" />
          <span className="font-semibold text-[#223149]">Work Schedule</span>
        </div>
        <div className="flex justify-center py-4">
          <div className="w-5 h-5 border-2 border-[#223149] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const totalHours = Math.round(totalWeekHours(current) * 10) / 10;
  const flexHours = current.flexible_hours ?? 0;
  const workingDays = Object.entries(current)
    .filter(([k, d]) => !["flexible", "flexible_hours"].includes(k) && (d as DaySchedule).enabled)
    .length;

  // Mismatch: compare schedule total against contracted_hours (within 0.1h tolerance)
  const hasMismatch = !editing
    && contractedHours != null
    && Math.abs(totalHours - contractedHours) > 0.1;

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2 flex-wrap">
          <Clock className="w-4 h-4 text-[#9BADB7]" />
          <span className="font-semibold text-[#223149]">Work Schedule</span>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-[#9BADB7]">
              {workingDays} {workingDays === 1 ? "day" : "days"} · {fmtHours(totalHours)}/week
              {flexHours > 0 && ` (incl. ${fmtHours(flexHours)} flex)`}
            </span>
            {hasMismatch && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-200">
                <AlertTriangle className="w-3 h-3" />
                Doesn't match contracted {fmtHours(contractedHours!)}
              </span>
            )}
          </div>
        </div>
        {canEdit && !editing && (
          <button
            onClick={startEditing}
            className="flex items-center gap-1.5 text-xs font-medium text-[#5F7C84] hover:text-[#223149] transition-colors flex-shrink-0"
          >
            <Edit2 className="w-3.5 h-3.5" />
            Edit
          </button>
        )}
        {editing && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#223149] text-white rounded-lg text-xs font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={cancelEditing}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-[#ECE3DF] text-[#5F7C84] rounded-lg text-xs font-semibold hover:bg-[#F8F6F4] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Day rows */}
      <div className="space-y-1.5">
        {DAYS.map((day) => {
          const d = current[day.key];
          if (!d) return null;
          const hours = dayHours(d);

          return (
            <div
              key={day.key}
              className={`rounded-xl transition-colors ${d.enabled ? "bg-[#F8F6F4]" : ""}`}
            >
              <div className={`flex items-center gap-3 px-3 py-2.5 ${!d.enabled ? "opacity-50" : ""}`}>
                {/* Toggle */}
                {editing ? (
                  <button
                    type="button"
                    onClick={() => toggleDay(day.key)}
                    style={{ touchAction: "manipulation" }}
                    className={`relative w-9 h-5 rounded-full flex-shrink-0 transition-colors ${
                      d.enabled ? "bg-[#223149]" : "bg-[#ECE3DF]"
                    }`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${d.enabled ? "right-0.5" : "left-0.5"}`} />
                  </button>
                ) : (
                  <div className={`relative w-9 h-5 rounded-full flex-shrink-0 ${d.enabled ? "bg-[#223149]" : "bg-[#ECE3DF]"}`}>
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow ${d.enabled ? "right-0.5" : "left-0.5"}`} />
                  </div>
                )}

                {/* Day label */}
                <span className="w-8 text-sm font-semibold text-[#223149] flex-shrink-0">{day.label}</span>
                <span className="hidden sm:block text-xs text-[#9BADB7] w-20 flex-shrink-0">{day.full}</span>

                {/* Read-only: show slots inline */}
                {!editing && (
                  d.enabled ? (
                    <div className="ml-auto flex items-center gap-3 flex-wrap justify-end">
                      {d.slots.map((slot: Slot, i: number) => (
                        <SlotDisplay key={i} slot={slot} />
                      ))}
                      {(() => {
                        const deduction = lunchDeduction(d);
                        if (deduction > 0) {
                          return (
                            <span className="text-xs text-[#9BADB7]">
                              = {fmtHours(hours)}
                              <span className="ml-1 text-[#9BADB7]/70">(−30 min lunch)</span>
                            </span>
                          );
                        }
                        if (hours > 0 && d.slots.length > 1) {
                          return <span className="text-xs text-[#9BADB7]">= {fmtHours(hours)}</span>;
                        }
                        return null;
                      })()}
                    </div>
                  ) : (
                    <span className="ml-auto text-xs text-[#9BADB7]">Day off</span>
                  )
                )}
              </div>

              {/* Edit mode: slot editors stacked */}
              {editing && d.enabled && (
                <div className="px-3 pb-2.5 space-y-1.5 ml-[68px] sm:ml-[136px]">
                  {d.slots.map((slot: Slot, i: number) => (
                    <SlotEditor
                      key={i}
                      slot={slot}
                      onChange={(s) => updateSlot(day.key, i, s)}
                      onRemove={() => removeSlot(day.key, i)}
                      canRemove={d.slots.length > 1}
                    />
                  ))}
                  {d.slots.length < 2 && (
                    <button
                      type="button"
                      onClick={() => addSlot(day.key)}
                      className="flex items-center gap-1 text-xs text-[#5F7C84] hover:text-[#223149] transition-colors mt-1"
                    >
                      <Plus className="w-3 h-3" />
                      Add second slot
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Flexible hours line item */}
      {(editing || flexHours > 0) && (
        <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl mt-1 ${flexHours > 0 ? "bg-[#F8F6F4]" : ""}`}>
          {/* Spacer matching toggle + day-label width */}
          <span className="w-8 text-sm font-semibold text-[#5F7C84] flex-shrink-0">Flex</span>
          <span className="hidden sm:block text-xs text-[#9BADB7] w-20 flex-shrink-0">Flexible</span>
          {editing ? (
            <div className="ml-auto flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={168}
                step={0.5}
                value={flexHours || ""}
                placeholder="0"
                onChange={(e) => setFlexibleHours(parseFloat(e.target.value) || 0)}
                className="w-20 px-2 py-1 text-sm border border-[#ECE3DF] rounded-lg text-[#223149] text-right focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
              />
              <span className="text-xs text-[#9BADB7]">hrs/week</span>
            </div>
          ) : (
            <span className="ml-auto text-sm text-[#5F7C84]">
              {fmtHours(flexHours)}/week
            </span>
          )}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      {updatedAt && !editing && (
        <p className="mt-4 text-xs text-[#9BADB7]">
          Last updated {format(parseISO(updatedAt), "d MMM yyyy")}
        </p>
      )}
    </div>
  );
}
