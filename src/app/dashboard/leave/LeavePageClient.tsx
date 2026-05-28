"use client";

import { useEffect, useState } from "react";
import { Palmtree, Plus, X, Clock, CheckCircle, XCircle, AlertCircle, RefreshCw } from "lucide-react";
import { format, parseISO, differenceInBusinessDays, addDays } from "date-fns";

interface LeaveBalance {
  name: string;
  leaveTypeId: string;
  balance: number;
  units: string;
}

interface LeaveApplication {
  id: string;
  leaveTypeId: string;
  leaveName: string;
  startDate: string;
  endDate: string;
  description: string;
  status: string;
  units: number;
}

interface Props {
  staffId: string;
  staffName: string;
  hasXeroLink: boolean;
}

function leaveColour(name: string) {
  const n = name.toLowerCase();
  if (n.includes("annual")) return "bg-blue-50 text-blue-700 border-blue-100";
  if (n.includes("sick") || n.includes("personal")) return "bg-amber-50 text-amber-700 border-amber-100";
  if (n.includes("long service")) return "bg-purple-50 text-purple-700 border-purple-100";
  if (n.includes("parental") || n.includes("maternity") || n.includes("paternity")) return "bg-pink-50 text-pink-700 border-pink-100";
  if (n.includes("carer")) return "bg-orange-50 text-orange-700 border-orange-100";
  return "bg-[#F8F6F4] text-[#223149] border-[#ECE3DF]";
}

function formatBalance(balance: number, units: string) {
  const rounded = Math.round(balance * 10) / 10;
  if (units.toLowerCase() === "days") return `${rounded} ${rounded === 1 ? "day" : "days"}`;
  const days = balance / 7.6;
  if (days >= 1) return `${rounded} hrs (${Math.round(days * 10) / 10} days)`;
  return `${rounded} hrs`;
}

function toXeroDate(dateStr: string): string {
  const ms = new Date(dateStr).getTime();
  return `/Date(${ms}+0000)/`;
}

function StatusBadge({ status, isPast }: { status: string; isPast: boolean }) {
  if (status === "CANCELLED") return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#F8F6F4] text-[#9BADB7]">
      <XCircle className="w-3 h-3" /> Cancelled
    </span>
  );
  if (status === "SCHEDULED" || status === "COMPLETED") {
    if (isPast) return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-600">
        <CheckCircle className="w-3 h-3" /> Approved
      </span>
    );
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600">
        <Clock className="w-3 h-3" /> Upcoming
      </span>
    );
  }
  return <span className="text-xs text-[#9BADB7]">{status}</span>;
}

function formatDateRange(start: string, end: string) {
  const s = parseISO(start);
  const e = parseISO(end);
  if (start === end) return format(s, "d MMMM yyyy");
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
    return `${format(s, "d")}–${format(e, "d MMMM yyyy")}`;
  }
  if (s.getFullYear() === e.getFullYear()) {
    return `${format(s, "d MMM")} – ${format(e, "d MMM yyyy")}`;
  }
  return `${format(s, "d MMM yyyy")} – ${format(e, "d MMM yyyy")}`;
}

function businessDayCount(start: string, end: string) {
  const s = parseISO(start);
  const e = parseISO(end);
  return differenceInBusinessDays(addDays(e, 1), s);
}

export default function LeavePageClient({ staffId, staffName, hasXeroLink }: Props) {
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [applications, setApplications] = useState<LeaveApplication[]>([]);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [appLoading, setAppLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ leaveTypeId: "", startDate: "", endDate: "", description: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const fetchAll = async (silent = false) => {
    if (!silent) { setBalanceLoading(true); setAppLoading(true); }
    else setRefreshing(true);

    await Promise.all([
      fetch(`/api/staff/${staffId}/leave-balances`)
        .then(r => r.json())
        .then(d => { setBalances(d.balances ?? []); setBalanceLoading(false); })
        .catch(() => setBalanceLoading(false)),

      fetch(`/api/staff/${staffId}/leave-requests`)
        .then(r => r.json())
        .then(d => { setApplications(d.applications ?? []); setAppLoading(false); })
        .catch(() => setAppLoading(false)),
    ]);

    setRefreshing(false);
  };

  useEffect(() => { fetchAll(); }, [staffId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch(`/api/staff/${staffId}/leave-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed to submit");
      setShowModal(false);
      setForm({ leaveTypeId: "", startDate: "", endDate: "", description: "" });
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 5000);
      fetchAll(true);
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedBalance = balances.find(b => b.leaveTypeId === form.leaveTypeId);
  const businessDays = form.startDate && form.endDate ? businessDayCount(form.startDate, form.endDate) : 0;

  const today = new Date().toISOString().split("T")[0];
  const upcoming = applications.filter(a => a.endDate >= today && a.status !== "CANCELLED");
  const past = applications.filter(a => a.endDate < today || a.status === "CANCELLED");

  if (!hasXeroLink) {
    return (
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-3xl font-bold text-[#223149]">My Leave</h1>
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center space-y-3">
          <Palmtree className="w-8 h-8 text-[#9BADB7] mx-auto" />
          <p className="font-semibold text-[#223149]">Not linked to Xero</p>
          <p className="text-sm text-[#9BADB7]">
            An admin needs to link your profile to Xero Payroll before you can view or request leave.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6 max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-[#223149]">My Leave</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchAll(true)}
              disabled={refreshing}
              className="p-2 rounded-xl hover:bg-[#ECE3DF] transition-colors text-[#9BADB7] hover:text-[#223149]"
              title="Refresh from Xero"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Request leave
            </button>
          </div>
        </div>

        {/* Success banner */}
        {submitSuccess && (
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">Leave request submitted. Your manager will approve it in Xero.</p>
          </div>
        )}

        {/* Leave balances */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="font-semibold text-[#223149]">Balances</span>
            <span className="flex items-center px-1.5 py-0.5 rounded-md bg-[#13B5EA]/10 text-[#13B5EA] text-[10px] font-semibold">
              Xero
            </span>
          </div>
          {balanceLoading ? (
            <div className="flex justify-center py-6">
              <div className="w-5 h-5 border-2 border-[#223149] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : balances.length === 0 ? (
            <p className="text-sm text-[#9BADB7]">No leave balances found in Xero.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {balances.map(b => (
                <div key={b.name} className={`flex items-center justify-between px-4 py-3 rounded-xl border ${leaveColour(b.name)}`}>
                  <span className="text-sm font-medium">{b.name}</span>
                  <span className="text-sm font-bold tabular-nums">{formatBalance(b.balance, b.units)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming requests */}
        {(appLoading || upcoming.length > 0) && (
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="font-semibold text-[#223149] mb-4">Upcoming</h2>
            {appLoading ? (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 border-2 border-[#223149] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : upcoming.length === 0 ? (
              <p className="text-sm text-[#9BADB7]">No upcoming leave.</p>
            ) : (
              <div className="space-y-3">
                {upcoming.map(app => (
                  <div key={app.id} className="flex items-center justify-between gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                    <div>
                      <p className="text-sm font-semibold text-[#223149]">{app.leaveName || "Leave"}</p>
                      <p className="text-sm text-[#5F7C84] mt-0.5">{formatDateRange(app.startDate, app.endDate)}</p>
                      {app.description && <p className="text-xs text-[#9BADB7] mt-0.5 italic">{app.description}</p>}
                    </div>
                    <StatusBadge status={app.status} isPast={false} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* History */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="font-semibold text-[#223149] mb-4">History</h2>
          {appLoading ? (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 border-[#223149] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : past.length === 0 ? (
            <p className="text-sm text-[#9BADB7]">No leave history yet.</p>
          ) : (
            <div className="space-y-2">
              {past.map(app => (
                <div key={app.id} className="flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl border border-[#ECE3DF] hover:bg-[#F8F6F4] transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#223149]">{app.leaveName || "Leave"}</p>
                    <p className="text-sm text-[#9BADB7] mt-0.5">{formatDateRange(app.startDate, app.endDate)}</p>
                  </div>
                  <StatusBadge status={app.status} isPast={true} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Request Leave Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-xl w-full md:max-w-md pb-safe">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#ECE3DF]">
              <h2 className="text-lg font-bold text-[#223149]">Request Leave</h2>
              <button
                onClick={() => { setShowModal(false); setSubmitError(""); }}
                className="p-2 rounded-xl hover:bg-[#F8F6F4] transition-colors"
              >
                <X className="w-5 h-5 text-[#5F7C84]" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Leave type */}
              <div>
                <label className="block text-sm font-semibold text-[#223149] mb-1.5">Leave type</label>
                <select
                  required
                  value={form.leaveTypeId}
                  onChange={e => setForm({ ...form, leaveTypeId: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors bg-white"
                >
                  <option value="">Select leave type…</option>
                  {balances.map(b => (
                    <option key={b.leaveTypeId} value={b.leaveTypeId}>
                      {b.name} — {formatBalance(b.balance, b.units)} remaining
                    </option>
                  ))}
                </select>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-[#223149] mb-1.5">Start date</label>
                  <input
                    type="date"
                    required
                    value={form.startDate}
                    onChange={e => setForm({
                      ...form,
                      startDate: e.target.value,
                      endDate: form.endDate < e.target.value ? e.target.value : form.endDate,
                    })}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#223149] mb-1.5">End date</label>
                  <input
                    type="date"
                    required
                    value={form.endDate}
                    min={form.startDate}
                    onChange={e => setForm({ ...form, endDate: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
                  />
                </div>
              </div>

              {/* Duration hint */}
              {form.startDate && form.endDate && businessDays > 0 && (
                <div className="flex items-center justify-between px-4 py-2.5 bg-[#F8F6F4] rounded-xl text-sm">
                  <span className="text-[#5F7C84]">Duration</span>
                  <span className="font-semibold text-[#223149]">
                    {businessDays} business {businessDays === 1 ? "day" : "days"}
                    {selectedBalance && ` (~${Math.round(businessDays * 7.6 * 10) / 10} hrs)`}
                  </span>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-[#223149] mb-1.5">
                  Notes <span className="font-normal text-[#9BADB7]">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Any additional context for your manager…"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors resize-none"
                />
              </div>

              <div className="p-3 bg-blue-50 rounded-xl text-xs text-blue-700">
                Your request will be sent directly to Xero. Your manager approves or declines it there.
              </div>

              {submitError && (
                <div className="flex items-start gap-2 text-sm text-red-500">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {submitError}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={submitting || !form.leaveTypeId || !form.startDate || !form.endDate}
                  className="flex-1 px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Submitting…" : "Submit Request"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setSubmitError(""); }}
                  className="px-4 py-2.5 border border-[#ECE3DF] text-[#5F7C84] rounded-xl text-sm font-semibold hover:bg-[#F8F6F4] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
