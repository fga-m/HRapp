"use client";

import { useEffect, useState } from "react";
import { Palmtree, AlertCircle, Plus, X, ChevronDown, ChevronUp, Clock, CheckCircle, XCircle } from "lucide-react";
import { format, parseISO } from "date-fns";

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
  isOwnProfile: boolean;
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

function StatusBadge({ status }: { status: string }) {
  if (status === "SCHEDULED") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600">
      <Clock className="w-3 h-3" /> Pending
    </span>
  );
  if (status === "COMPLETED") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-600">
      <CheckCircle className="w-3 h-3" /> Approved
    </span>
  );
  if (status === "CANCELLED") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#F8F6F4] text-[#9BADB7]">
      <XCircle className="w-3 h-3" /> Cancelled
    </span>
  );
  return <span className="text-xs text-[#9BADB7]">{status}</span>;
}

export default function LeaveBalancesCard({ staffId, isOwnProfile }: Props) {
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [applications, setApplications] = useState<LeaveApplication[]>([]);
  const [balanceStatus, setBalanceStatus] = useState<"loading" | "unlinked" | "ready" | "error">("loading");
  const [appStatus, setAppStatus] = useState<"loading" | "ready" | "error">("loading");
  const [showHistory, setShowHistory] = useState(false);

  // Request leave modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ leaveTypeId: "", startDate: "", endDate: "", description: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const fetchBalances = () => {
    fetch(`/api/staff/${staffId}/leave-balances`)
      .then(r => r.json())
      .then(d => {
        if (!d.linked) { setBalanceStatus("unlinked"); return; }
        setBalances(d.balances ?? []);
        setBalanceStatus("ready");
      })
      .catch(() => setBalanceStatus("error"));
  };

  const fetchApplications = () => {
    fetch(`/api/staff/${staffId}/leave-requests`)
      .then(r => r.json())
      .then(d => {
        if (d.linked === false) { setAppStatus("ready"); return; }
        setApplications(d.applications ?? []);
        setAppStatus("ready");
      })
      .catch(() => setAppStatus("error"));
  };

  useEffect(() => {
    fetchBalances();
    fetchApplications();
  }, [staffId]);

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
      // Refresh both
      fetchBalances();
      fetchApplications();
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (balanceStatus === "unlinked") return null;

  const recentApps = applications.slice(0, showHistory ? undefined : 3);

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palmtree className="w-4 h-4 text-[#9BADB7]" />
            <span className="font-semibold text-[#223149]">Leave</span>
            <span className="flex items-center px-1.5 py-0.5 rounded-md bg-[#13B5EA]/10 text-[#13B5EA] text-[10px] font-semibold">
              Xero
            </span>
          </div>
          {isOwnProfile && balanceStatus === "ready" && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-[#5F7C84] hover:text-[#223149] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Request leave
            </button>
          )}
        </div>

        {/* Balances */}
        {balanceStatus === "loading" && (
          <div className="flex justify-center py-4">
            <div className="w-5 h-5 border-2 border-[#223149] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {balanceStatus === "error" && (
          <div className="flex items-center gap-2 text-sm text-red-500">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> Failed to load leave balances
          </div>
        )}
        {balanceStatus === "ready" && balances.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {balances.map(b => (
              <div key={b.name} className={`flex items-center justify-between px-4 py-3 rounded-xl border ${leaveColour(b.name)}`}>
                <span className="text-sm font-medium">{b.name}</span>
                <span className="text-sm font-bold tabular-nums">{formatBalance(b.balance, b.units)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Leave history */}
        {appStatus === "ready" && applications.length > 0 && (
          <div className="pt-4 border-t border-[#ECE3DF]">
            <button
              onClick={() => setShowHistory(v => !v)}
              className="flex items-center gap-2 text-sm font-semibold text-[#223149] mb-3"
            >
              Leave history
              <span className="text-xs font-normal text-[#9BADB7]">{applications.length}</span>
              {showHistory ? <ChevronUp className="w-3.5 h-3.5 text-[#9BADB7]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#9BADB7]" />}
            </button>
            <div className="space-y-2">
              {recentApps.map(app => (
                <div key={app.id} className="flex items-center justify-between gap-3 px-4 py-3 bg-[#F8F6F4] rounded-xl">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#223149] truncate">{app.leaveName || "Leave"}</p>
                    <p className="text-xs text-[#9BADB7] mt-0.5">
                      {format(parseISO(app.startDate), "d MMM yyyy")}
                      {app.endDate !== app.startDate && ` → ${format(parseISO(app.endDate), "d MMM yyyy")}`}
                    </p>
                  </div>
                  <StatusBadge status={app.status} />
                </div>
              ))}
            </div>
            {applications.length > 3 && !showHistory && (
              <button onClick={() => setShowHistory(true)} className="mt-2 text-xs text-[#5F7C84] hover:text-[#223149]">
                Show all {applications.length} requests
              </button>
            )}
          </div>
        )}
      </div>

      {/* Request Leave Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-xl w-full md:max-w-md pb-safe">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#ECE3DF]">
              <h2 className="text-lg font-bold text-[#223149]">Request Leave</h2>
              <button onClick={() => { setShowModal(false); setSubmitError(""); }}
                className="p-2 rounded-xl hover:bg-[#F8F6F4] transition-colors">
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
                      {b.name} ({formatBalance(b.balance, b.units)} remaining)
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
                    onChange={e => setForm({ ...form, startDate: e.target.value, endDate: form.endDate || e.target.value })}
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

              {/* Description */}
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
                Your request will be sent to Xero. Your manager will approve or decline it there.
              </div>

              {submitError && <p className="text-sm text-red-500">{submitError}</p>}

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
