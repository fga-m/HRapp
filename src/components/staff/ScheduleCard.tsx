"use client";

import { useEffect, useState } from "react";
import { Clock, Edit2, Check, X } from "lucide-react";
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

interface DaySchedule {
  enabled: boolean;
  start: string;
  end: string;
}

type WeekSchedule = Record<string, DaySchedule>;

interface ScheduleCardProps {
  staffId: string;
  canEdit: boolean;
}

function hoursFromSchedule(schedule: WeekSchedule): number {
  return Object.values(schedule).reduce((total, day) => {
    if (!day.enabled) return total;
    const [sh, sm] = day.start.split(":").map(Number);
    const [eh, em] = day.end.split(":").map(Number);
    const hours = (eh * 60 + em - (sh * 60 + sm)) / 60;
    return total + Math.max(0, hours);
  }, 0);
}

export default function ScheduleCard({ staffId, canEdit }: ScheduleCardProps) {
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

  const setTime = (key: string, field: "start" | "end", value: string) => {
    if (!draft) return;
    setDraft({ ...draft, [key]: { ...draft[key], [field]: value } });
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

  const totalHours = hoursFromSchedule(current);
  const workingDays = Object.values(current).filter((d) => d.enabled).length;

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#9BADB7]" />
          <span className="font-semibold text-[#223149]">Work Schedule</span>
          <span className="text-xs text-[#9BADB7] ml-1">
            {workingDays} {workingDays === 1 ? "day" : "days"} · {totalHours % 1 === 0 ? totalHours : totalHours.toFixed(1)} hrs/week
          </span>
        </div>
        {canEdit && !editing && (
          <button
            onClick={startEditing}
            className="flex items-center gap-1.5 text-xs font-medium text-[#5F7C84] hover:text-[#223149] transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
            Edit
          </button>
        )}
        {editing && (
          <div className="flex items-center gap-2">
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
      <div className="space-y-1">
        {DAYS.map((day) => {
          const d = current[day.key];
          if (!d) return null;
          return (
            <div
              key={day.key}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                d.enabled ? "bg-[#F8F6F4]" : "opacity-50"
              }`}
            >
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
                  <span
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                      d.enabled ? "right-0.5" : "left-0.5"
                    }`}
                  />
                </button>
              ) : (
                <div
                  className={`relative w-9 h-5 rounded-full flex-shrink-0 ${
                    d.enabled ? "bg-[#223149]" : "bg-[#ECE3DF]"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow ${
                      d.enabled ? "right-0.5" : "left-0.5"
                    }`}
                  />
                </div>
              )}

              {/* Day label */}
              <span className="w-10 text-sm font-semibold text-[#223149] flex-shrink-0">
                {day.label}
              </span>
              <span className="hidden sm:block text-xs text-[#9BADB7] w-20 flex-shrink-0">
                {day.full}
              </span>

              {/* Times */}
              {d.enabled ? (
                editing ? (
                  <div className="flex items-center gap-2 ml-auto">
                    <input
                      type="time"
                      value={d.start}
                      onChange={(e) => setTime(day.key, "start", e.target.value)}
                      className="px-2 py-1 text-sm border border-[#ECE3DF] rounded-lg text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
                    />
                    <span className="text-xs text-[#9BADB7]">to</span>
                    <input
                      type="time"
                      value={d.end}
                      onChange={(e) => setTime(day.key, "end", e.target.value)}
                      className="px-2 py-1 text-sm border border-[#ECE3DF] rounded-lg text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
                    />
                  </div>
                ) : (
                  <div className="ml-auto flex items-center gap-1.5 text-sm text-[#5F7C84]">
                    <span>{d.start}</span>
                    <span className="text-[#9BADB7] text-xs">–</span>
                    <span>{d.end}</span>
                    <span className="text-xs text-[#9BADB7] ml-1">
                      ({(() => {
                        const [sh, sm] = d.start.split(":").map(Number);
                        const [eh, em] = d.end.split(":").map(Number);
                        const h = (eh * 60 + em - (sh * 60 + sm)) / 60;
                        return h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`;
                      })()})
                    </span>
                  </div>
                )
              ) : (
                <span className="ml-auto text-xs text-[#9BADB7]">Day off</span>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-500">{error}</p>
      )}

      {updatedAt && !editing && (
        <p className="mt-4 text-xs text-[#9BADB7]">
          Last updated {format(parseISO(updatedAt), "d MMM yyyy")}
        </p>
      )}
    </div>
  );
}
