"use client";

import { useEffect, useState, useCallback } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Users,
  TrendingUp,
  X,
  Trash2,
  Loader2,
  AlertCircle,
  Plus,
} from "lucide-react";
import { format, addDays, startOfWeek } from "date-fns";

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
}

interface ToilTransaction {
  id: string;
  staff_id: string;
  hours: number;
  reason: string | null;
  transaction_date: string;
  created_at: string;
  created_by: string | null;
}

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
  return date.toISOString().split("T")[0];
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

// ─── TOIL Modal ───────────────────────────────────────────────────────────────

interface ToilModalProps {
  member: StaffMember;
  onClose: () => void;
  onSaved: () => void;
}

function ToilModal({ member, onClose, onSaved }: ToilModalProps) {
  const [hours, setHours] = useState("");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(toDateInputValue(new Date()));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [transactions, setTransactions] = useState<ToilTransaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadTransactions = useCallback(async () => {
    setLoadingTx(true);
    try {
      const res = await fetch(`/api/schedule/toil?staff_id=${member.id}`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
      }
    } finally {
      setLoadingTx(false);
    }
  }, [member.id]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hours || isNaN(Number(hours))) {
      setSaveError("Please enter a valid number of hours.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/schedule/toil", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staff_id: member.id,
          hours: Number(hours),
          reason: reason || null,
          transaction_date: date,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setSaveError(data.error || "Failed to save.");
        return;
      }
      setHours("");
      setReason("");
      setDate(toDateInputValue(new Date()));
      await loadTransactions();
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/schedule/toil/${id}`, { method: "DELETE" });
      if (res.ok) {
        await loadTransactions();
        onSaved();
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom)] sm:pb-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#ECE3DF]">
          <div className="flex items-center gap-3">
            <Avatar member={member} />
            <div>
              <p className="font-semibold text-[#223149]">TOIL — {member.full_name}</p>
              {member.position && <p className="text-xs text-[#9BADB7]">{member.position}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#9BADB7] hover:bg-[#F8F6F4] hover:text-[#223149] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          {/* Log form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <h3 className="text-sm font-semibold text-[#223149]">Log TOIL entry</h3>
            <p className="text-xs text-[#9BADB7]">
              Use a positive number to accrue TOIL (e.g. 3.5) or a negative number when someone takes it (e.g. -3.5).
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#5F7C84] mb-1">Hours *</label>
                <input
                  type="number"
                  step="0.5"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder="e.g. 3.5 or -3.5"
                  className="w-full px-3 py-2 rounded-xl border border-[#ECE3DF] text-sm text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#5F7C84]/30 focus:border-[#5F7C84]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#5F7C84] mb-1">Date *</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#ECE3DF] text-sm text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#5F7C84]/30 focus:border-[#5F7C84]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#5F7C84] mb-1">Reason</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Worked Sunday service"
                className="w-full px-3 py-2 rounded-xl border border-[#ECE3DF] text-sm text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#5F7C84]/30 focus:border-[#5F7C84]"
              />
            </div>

            {saveError && (
              <div className="flex items-center gap-2 text-red-600 text-xs">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {saveError}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#223149] text-white text-sm font-semibold hover:bg-[#2d4261] transition-colors disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {saving ? "Saving…" : "Log Entry"}
            </button>
          </form>

          {/* Transaction history */}
          <div>
            <h3 className="text-sm font-semibold text-[#223149] mb-3">Transaction history</h3>
            {loadingTx ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-[#9BADB7]" />
              </div>
            ) : transactions.length === 0 ? (
              <p className="text-sm text-[#9BADB7] text-center py-4">No TOIL transactions yet.</p>
            ) : (
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#F8F6F4] border border-[#ECE3DF]"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-semibold ${
                            tx.hours > 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {tx.hours > 0 ? "+" : ""}
                          {tx.hours} hrs
                        </span>
                        <span className="text-xs text-[#9BADB7]">
                          {format(new Date(tx.transaction_date + "T00:00:00"), "d MMM yyyy")}
                        </span>
                      </div>
                      {tx.reason && (
                        <p className="text-xs text-[#5F7C84] truncate mt-0.5">{tx.reason}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(tx.id)}
                      disabled={deletingId === tx.id}
                      className="p-1.5 rounded-lg text-[#9BADB7] hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-40"
                      title="Delete transaction"
                    >
                      {deletingId === tx.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [data, setData] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toilModal, setToilModal] = useState<StaffMember | null>(null);

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
          <div className="w-10 h-10 rounded-xl bg-[#223149] flex items-center justify-center flex-shrink-0">
            <CalendarDays className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#223149]">Team Schedule</h1>
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
                    Variance
                  </th>
                  <th className="text-center px-4 py-4 text-xs font-semibold text-[#9BADB7] uppercase tracking-wider">
                    TOIL Balance
                  </th>
                  {isAdmin && (
                    <th className="text-right px-6 py-4 text-xs font-semibold text-[#9BADB7] uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F8F6F4]">
                {data.staff.map((member) => (
                  <tr key={member.id} className="hover:bg-[#F8F6F4] transition-colors">
                    {/* Staff cell */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar member={member} />
                        <div>
                          <p className="text-sm font-semibold text-[#223149]">{member.full_name}</p>
                          {member.position && (
                            <p className="text-xs text-[#9BADB7]">{member.position}</p>
                          )}
                        </div>
                      </div>
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

                    {/* Actions */}
                    {isAdmin && (
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setToilModal(member)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#ECE3DF] text-[#223149] hover:bg-[#223149] hover:text-white transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Log TOIL
                        </button>
                      </td>
                    )}
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
                  <div className="flex items-center gap-3">
                    <Avatar member={member} />
                    <div>
                      <p className="text-sm font-semibold text-[#223149]">{member.full_name}</p>
                      {member.position && (
                        <p className="text-xs text-[#9BADB7]">{member.position}</p>
                      )}
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => setToilModal(member)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#ECE3DF] text-[#223149] hover:bg-[#223149] hover:text-white transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      TOIL
                    </button>
                  )}
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
                    <p className="text-[#9BADB7] mb-1">Variance</p>
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

      {/* TOIL Modal */}
      {toilModal && (
        <ToilModal
          member={toilModal}
          onClose={() => setToilModal(null)}
          onSaved={() => fetchData(weekStart)}
        />
      )}
    </div>
  );
}
