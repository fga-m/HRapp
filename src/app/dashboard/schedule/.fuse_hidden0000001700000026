"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Users,
  TrendingUp,
  AlertCircle,
  Loader2,
  RefreshCw,
  Minus,
  Plus,
} from "lucide-react";
import { format, addDays, startOfWeek } from "date-fns";
import Link from "next/link";
import PageSubtitle from "@/components/PageSubtitle";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StaffMember {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  position: string | null;
  contracted_hours: number;
  scheduled_hours: number | null;
  toil_balance: number;
  has_calendar: boolean;
}

interface ScheduleData {
  staff: StaffMember[];
  weekStart: string;
  weekEnd: string;
  role: string;
  toilWindowWeeks: number;
}

const TOIL_WINDOW_MIN = 1;
const TOIL_WINDOW_MAX = 12;



// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMonday(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

function formatWeekRange(start: string, end: string): string {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const endDisplay = addDays(e, -1); // weekEnd is exclusive (start + 7)
  if (s.getMonth() === endDisplay.getMonth()) {
    return `Week of ${format(s, "d")}–${format(endDisplay, "d MMM yyyy")}`;
  }
  return `Week of ${format(s, "d MMM")}–${format(endDisplay, "d MMM yyyy")}`;
}

function toDateInputValue(date: Date): string {
  // Use local date parts (not UTC) so Melbourne's Monday stays Monday when sent to the server
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ member }: { member: StaffMember }) {
  if (member.avatar_url) {
    return (
      <img
        src={member.avatar_url}
        alt={member.full_name}
        className="w-9 h-9 rounded-full object-cover flex-shrink-0"
      />
    );
  }
  return (
    <div className="w-9 h-9 rounded-full bg-[#223149] flex items-center justify-center flex-shrink-0">
      <span className="text-white text-xs font-bold">{getInitials(member.full_name)}</span>
    </div>
  );
}

// ─── Variance Badge ───────────────────────────────────────────────────────────

function VarianceBadge({ contracted, scheduled }: { contracted: number; scheduled: number | null }) {
  if (scheduled === null) {
    return <span className="text-[#9BADB7] text-sm">—</span>;
  }
  const diff = Math.round((scheduled - contracted) * 10) / 10;
  if (diff === 0) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
        0 hrs
      </span>
    );
  }
  if (diff > 0) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
        +{diff} hrs
      </span>
    );
  }
  // Under-scheduled: amber
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
      {diff} hrs
    </span>
  );
}

// ─── TOIL Balance Badge ───────────────────────────────────────────────────────

function ToilBadge({ balance }: { balance: number }) {
  if (balance > 0) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
        +{balance} hrs
      </span>
    );
  }
  if (balance < 0) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
        {balance} hrs
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-600">
      0 hrs
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [data, setData] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingWindow, setSavingWindow] = useState(false);

  const fetchData = useCallback(async (ws: Date) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/schedule?weekStart=${toDateInputValue(ws)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Failed to load schedule data.");
        return;
      }
      const json = await res.json();
      setData(json);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(weekStart);
  }, [weekStart, fetchData]);

  function prevWeek() {
    setWeekStart((prev) => addDays(prev, -7));
  }

  function nextWeek() {
    setWeekStart((prev) => addDays(prev, 7));
  }

  function thisWeek() {
    setWeekStart(getMonday(new Date()));
  }

  // Persist a new TOIL window length, then refetch so balances recompute.
  async function changeToilWindow(delta: number) {
    if (!data) return;
    const next = Math.min(TOIL_WINDOW_MAX, Math.max(TOIL_WINDOW_MIN, data.toilWindowWeeks + delta));
    if (next === data.toilWindowWeeks) return;
    setSavingWindow(true);
    try {
      const res = await fetch("/api/settings/toil", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weeks: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Failed to update TOIL window.");
        return;
      }
      await fetchData(weekStart);
    } catch {
      setError("Network error updating TOIL window.");
    } finally {
      setSavingWindow(false);
    }
  }

  const isAdmin = data?.role === "admin";

  // Summary stats (admin only)
  const totalContracted = data?.staff.reduce((sum, s) => sum + s.contracted_hours, 0) ?? 0;
  const totalScheduled = data?.staff.reduce((sum, s) => sum + (s.scheduled_hours ?? 0), 0) ?? 0;
  const staffWithToil = data?.staff.filter((s) => s.toil_balance > 0).length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-3xl font-bold text-[#223149]">Hours & TOIL</h1>
            <PageSubtitle pageKey="schedule" defaultDescription="Compare each person's scheduled hours against contracted hours and see TOIL balances." />
            {data && (
              <p className="text-sm text-[#5F7C84]">
                {formatWeekRange(data.weekStart, data.weekEnd)}
              </p>
            )}
          </div>
        </div>

        {/* Week navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={prevWeek}
            disabled={loading}
            className="flex items-center gap-1 px-3 py-2 rounded-xl border border-[#ECE3DF] bg-white text-sm font-medium text-[#223149] hover:bg-[#F8F6F4] transition-colors disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4" />
            Prev
          </button>
          <button
            onClick={thisWeek}
            disabled={loading}
            className="px-3 py-2 rounded-xl border border-[#ECE3DF] bg-white text-sm font-medium text-[#223149] hover:bg-[#F8F6F4] transition-colors disabled:opacity-50"
          >
            <span className="hidden sm:inline">This </span>week
          </button>
          <button
            onClick={nextWeek}
            disabled={loading}
            className="flex items-center gap-1 px-3 py-2 rounded-xl border border-[#ECE3DF] bg-white text-sm font-medium text-[#223149] hover:bg-[#F8F6F4] transition-colors disabled:opacity-50"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => fetchData(weekStart)}
            disabled={loading}
            title="Refresh from Google Calendar"
            aria-label="Refresh from Google Calendar"
            className="p-2 rounded-xl border border-[#ECE3DF] bg-white text-[#223149] hover:bg-[#F8F6F4] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Summary bar — admin only */}
      {isAdmin && data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#ECE3DF] flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-[#223149]" />
            </div>
            <div>
              <p className="text-xl font-bold text-[#223149]">{totalContracted} hrs</p>
              <p className="text-xs text-[#5F7C84]">Total contracted this week</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#ECE3DF] flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-5 h-5 text-[#223149]" />
            </div>
            <div>
              <p className="text-xl font-bold text-[#223149]">
                {Math.round(totalScheduled * 10) / 10} hrs
              </p>
              <p className="text-xs text-[#5F7C84]">Total scheduled this week</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 text-green-700" />
            </div>
            <div>
              <p className="text-xl font-bold text-[#223149]">{staffWithToil}</p>
              <p className="text-xs text-[#5F7C84]">Staff with TOIL banked</p>
            </div>
          </div>
        </div>
      )}

      {/* TOIL rolling-window control */}
      {data && (
        <div className="flex items-center justify-between gap-3 bg-white rounded-2xl p-4 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-[#223149]">Time Off in Lieu (TOIL) rolling window</p>
            <p className="text-xs text-[#5F7C84]">
              Balances sum each staff member&apos;s weekly difference over the last{" "}
              {data.toilWindowWeeks} {data.toilWindowWeeks === 1 ? "week" : "weeks"} (the viewed
              week plus the {data.toilWindowWeeks - 1} before it).
            </p>
          </div>
          {isAdmin ? (
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => changeToilWindow(-1)}
                  disabled={savingWindow || data.toilWindowWeeks <= TOIL_WINDOW_MIN}
                  title="Fewer weeks"
                  aria-label="Decrease weeks"
                  className="p-2 rounded-xl border border-[#ECE3DF] bg-white text-[#223149] hover:bg-[#F8F6F4] transition-colors disabled:opacity-40"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <div className="min-w-[72px] text-center">
                  {savingWindow ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#5F7C84] mx-auto" />
                  ) : (
                    <span className="text-base font-bold text-[#223149]">
                      {data.toilWindowWeeks} {data.toilWindowWeeks === 1 ? "week" : "weeks"}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => changeToilWindow(1)}
                  disabled={savingWindow || data.toilWindowWeeks >= TOIL_WINDOW_MAX}
                  title="More weeks"
                  aria-label="Increase weeks"
                  className="p-2 rounded-xl border border-[#ECE3DF] bg-white text-[#223149] hover:bg-[#F8F6F4] transition-colors disabled:opacity-40"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <span className="text-[11px] text-[#9BADB7]">includes current week</span>
            </div>
          ) : (
            <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
              <span className="text-base font-bold text-[#223149]">
                {data.toilWindowWeeks} {data.toilWindowWeeks === 1 ? "week" : "weeks"}
              </span>
              <span className="text-[11px] text-[#9BADB7]">includes current week</span>
            </div>
          )}
        </div>
      )}

      {/* Content area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#5F7C84]" />
          <p className="text-sm text-[#9BADB7]">Loading schedule…</p>
        </div>
      ) : error ? (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      ) : !data || data.staff.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <Users className="w-10 h-10 text-[#9BADB7]" />
          <p className="text-sm text-[#9BADB7]">No active staff found.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#ECE3DF]">
                  <th className="text-left px-6 py-4 text-xs font-semibold text-[#9BADB7] uppercase tracking-wider">
                    Staff
                  </th>
                  <th className="text-center px-4 py-4 text-xs font-semibold text-[#9BADB7] uppercase tracking-wider">
                    Contracted
                  </th>
                  <th className="text-center px-4 py-4 text-xs font-semibold text-[#9BADB7] uppercase tracking-wider">
                    Scheduled
                  </th>
                  <th className="text-center px-4 py-4 text-xs font-semibold text-[#9BADB7] uppercase tracking-wider">
                    Difference
                    <p className="text-[8px] font-normal normal-case tracking-normal mt-0.5 opacity-70">(over / under contracted)</p>
                  </th>
                  <th className="text-center px-4 py-4 text-xs font-semibold text-[#9BADB7] uppercase tracking-wider">
                    TOIL Balance
                    <p className="text-[8px] font-normal normal-case tracking-normal mt-0.5 opacity-70">rolling {data.toilWindowWeeks}-week window</p>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F8F6F4]">
                {data.staff.map((member) => (
                  <tr key={member.id} className="hover:bg-[#F8F6F4] transition-colors">
                    {/* Staff cell */}
                    <td className="px-6 py-4">
                      <Link href={`/dashboard/staff/${member.id}`} className="flex items-center gap-3 group w-fit">
                        <Avatar member={member} />
                        <div>
                          <p className="text-sm font-semibold text-[#223149] group-hover:underline">{member.full_name}</p>
                          {member.position && (
                            <p className="text-xs text-[#9BADB7]">{member.position}</p>
                          )}
                        </div>
                      </Link>
                    </td>

                    {/* Contracted */}
                    <td className="px-4 py-4 text-center text-sm text-[#223149]">
                      {member.contracted_hours} hrs
                    </td>

                    {/* Scheduled */}
                    <td className="px-4 py-4 text-center">
                      {member.scheduled_hours === null ? (
                        <span
                          className="text-[#9BADB7] text-sm"
                          title={!member.has_calendar ? "No calendar linked" : "Calendar data unavailable"}
                        >
                          —
                        </span>
                      ) : (
                        <span className="text-sm text-[#223149]">{member.scheduled_hours} hrs</span>
                      )}
                    </td>

                    {/* Variance */}
                    <td className="px-4 py-4 text-center">
                      <VarianceBadge
                        contracted={member.contracted_hours}
                        scheduled={member.scheduled_hours}
                      />
                    </td>

                    {/* TOIL balance */}
                    <td className="px-4 py-4 text-center">
                      <ToilBadge balance={member.toil_balance} />
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {data.staff.map((member) => (
              <div
                key={member.id}
                className="bg-white rounded-2xl shadow-sm p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <Link href={`/dashboard/staff/${member.id}`} className="flex items-center gap-3 group">
                    <Avatar member={member} />
                    <div>
                      <p className="text-sm font-semibold text-[#223149] group-hover:underline">{member.full_name}</p>
                      {member.position && (
                        <p className="text-xs text-[#9BADB7]">{member.position}</p>
                      )}
                    </div>
                  </Link>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-[#F8F6F4] rounded-xl px-3 py-2">
                    <p className="text-[#9BADB7] mb-0.5">Contracted</p>
                    <p className="font-semibold text-[#223149]">{member.contracted_hours} hrs</p>
                  </div>
                  <div className="bg-[#F8F6F4] rounded-xl px-3 py-2">
                    <p className="text-[#9BADB7] mb-0.5">Scheduled</p>
                    <p className="font-semibold text-[#223149]">
                      {member.scheduled_hours === null ? (
                        <span
                          className="text-[#9BADB7]"
                          title={!member.has_calendar ? "No calendar linked" : "Unavailable"}
                        >
                          —
                        </span>
                      ) : (
                        `${member.scheduled_hours} hrs`
                      )}
                    </p>
                  </div>
                  <div className="bg-[#F8F6F4] rounded-xl px-3 py-2">
                    <p className="text-[#9BADB7] mb-1">Difference</p>
                    <VarianceBadge
                      contracted={member.contracted_hours}
                      scheduled={member.scheduled_hours}
                    />
                  </div>
                  <div className="bg-[#F8F6F4] rounded-xl px-3 py-2">
                    <p className="text-[#9BADB7] mb-1">TOIL Balance</p>
                    <ToilBadge balance={member.toil_balance} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

    </div>
  );
}
