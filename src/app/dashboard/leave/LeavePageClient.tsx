"use client";

import { useEffect, useState } from "react";
import { Palmtree, Plus, X, CheckCircle, XCircle, AlertCircle, RefreshCw } from "lucide-react";
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
  title: string;      // Xero Title field — shown as "Description" column in Xero
  startDate: string;
  endDate: string;
  status: string;     // SCHEDULED | COMPLETED | CANCELLED | REJECTED
  units: number;
}

interface Approver {
  id: string;
  full_name: string;
  role: string;
}

interface Props {
  staffId: string;
  staffName: string;
  hasXeroLink: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

/** Format date range to match Xero: "21 May 2026" or "30 Oct - 04 Nov 2025" */
function formatLeavePeriod(start: string, end: string) {
  const s = parseISO(start);
  const e = parseISO(end);
  if (start === end) return format(s, "dd MMM yyyy");
  return `${format(s, "dd MMM")} - ${format(e, "dd MMM yyyy")}`;
}

function businessDayCount(start: string, end: string) {
  return differenceInBusinessDays(addDays(parseISO(end), 1), parseISO(start));
}

// ─── Status Badge (matching Xero labels) ─────────────────────────────────────

// Xero status values: SCHEDULED (approved, may be past or future until payroll runs),
// COMPLETED (payroll processed), REJECTED, CANCELLED
function StatusBadge({ status }: { status: string }) {
  if (status === "SCHEDULED") return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border border-green-300 text-green-700 bg-green-50">
      <CheckCircle className="w-3 h-3" /> Approved
    </span>
  );
  if (status === "COMPLETED") return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border border-[#ECE3DF] text-[#9BADB7] bg-[#F8F6F4]">
      <CheckCircle className="w-3 h-3" /> Complete
    </span>
  );
  if (status === "REJECTED") return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border border-red-300 text-red-600 bg-red-50">
      <XCircle className="w-3 h-3" /> Rejected
    </span>
  );
  if (status === "CANCELLED") return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border border-[#ECE3DF] text-[#9BADB7] bg-[#F8F6F4]">
      <XCircle className="w-3 h-3" /> Cancelled
    </span>
  );
  return <span className="text-xs text-[#9BADB7]">{status}</span>;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LeavePageClient({ staffId, staffName, hasXeroLink }: Props) {
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [applications, setApplications] = useState<LeaveApplication[]>([]);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [appLoading, setAppLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ leaveTypeId: "", startDate: "", endDate: "", description: "" });
  const [approvers, setApprovers] = useState<Approver[]>([]);
  const [approverId, setApproverId] = useState("");
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

  // Fetch approvers (managers + admins) when modal opens
  useEffect(() => {
    if (!showModal || approvers.length > 0) return;
    fetch("/api/staff")
      .then(r => r.json())
      .then(d => {
        const list: Approver[] = (Array.isArray(d) ? d : []).filter(
          (s: Approver) => s.role === "admin" || s.role === "manager"
        );
        setApprovers(list);
        if (list.length === 1) setApproverId(list[0].id);
      })
      .catch(() => {});
  }, [showModal]);

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
      setApproverId("");
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

  if (!hasXeroLink) {
    return (
      <div className="space-y-6 max-w-3xl">
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
      <div className="space-y-6 max-w-3xl">
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
              New Leave Request
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

        {/* Available Leave Balances */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <span className="font-semibold text-[#223149]">Available Leave Balances</span>
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {balances.map(b => (
                <div key={b.name} className={`px-4 py-4 rounded-xl border ${leaveColour(b.name)}`}>
                  <p className="text-xs font-medium mb-1 opacity-75">{b.name}</p>
                  <p className="text-2xl font-bold tabular-nums">
                    {Math.floor(b.balance)}
                    <span className="text-sm font-normal">.{String(Math.round((b.balance % 1) * 100)).padStart(2, "0")}</span>
                    <span className="text-sm font-medium ml-1">
                      {b.units.toLowerCase() === "days" ? "Days" : "Hours"}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Leave Requests table */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#ECE3DF]">
            <h2 className="font-semibold text-[#223149]">Leave Requests</h2>
          </div>

          {appLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-5 h-5 border-2 border-[#223149] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : applications.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm text-[#9BADB7]">No leave requests found.</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#F8F6F4] text-left">
                      <th className="px-6 py-3 text-xs font-semibold text-[#9BADB7] uppercase tracking-wide">Leave Type</th>
                      <th className="px-6 py-3 text-xs font-semibold text-[#9BADB7] uppercase tracking-wide">Description</th>
                      <th className="px-6 py-3 text-xs font-semibold text-[#9BADB7] uppercase tracking-wide">Leave Period</th>
                      <th className="px-6 py-3 text-xs font-semibold text-[#9BADB7] uppercase tracking-wide text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ECE3DF]">
                    {applications.map(app => {
                      const typeName = balances.find(b => b.leaveTypeId === app.leaveTypeId)?.name ?? "Leave";
                      return (
                        <tr key={app.id} className="hover:bg-[#F8F6F4] transition-colors">
                          <td className="px-6 py-4 font-medium text-[#223149]">{typeName}</td>
                          <td className="px-6 py-4 text-[#5F7C84]">{app.title || "—"}</td>
                          <td className="px-6 py-4 text-[#5F7C84] tabular-nums">{formatLeavePeriod(app.startDate, app.endDate)}</td>
                          <td className="px-6 py-4 text-right">
                            <StatusBadge status={app.status} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="sm:hidden divide-y divide-[#ECE3DF]">
                {applications.map(app => {
                  const typeName = balances.find(b => b.leaveTypeId === app.leaveTypeId)?.name ?? "Leave";
                  return (
                    <div key={app.id} className="px-4 py-4 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#223149]">{typeName}</p>
                        {app.title && <p className="text-xs text-[#5F7C84] mt-0.5">{app.title}</p>}
                        <p className="text-xs text-[#9BADB7] mt-1">{formatLeavePeriod(app.startDate, app.endDate)}</p>
                      </div>
                      <StatusBadge status={app.status} />
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Request Leave Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-xl w-full md:max-w-md pb-safe">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#ECE3DF]">
              <h2 className="text-lg font-bold text-[#223149]">New Leave Request</h2>
              <button
                onClick={() => { setShowModal(false); setSubmitError(""); setApproverId(""); }}
                className="p-2 rounded-xl hover:bg-[#F8F6F4] transition-colors"
              >
                <X className="w-5 h-5 text-[#5F7C84]" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Type of Request */}
              <div>
                <label className="block text-sm font-semibold text-[#223149] mb-1.5">Type of Request</label>
                <select
                  required
                  value={form.leaveTypeId}
                  onChange={e => setForm({ ...form, leaveTypeId: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors bg-white"
                >
                  <option value="">Select request…</option>
                  {balances.map(b => (
                    <option key={b.leaveTypeId} value={b.leaveTypeId}>{b.name}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-[#223149] mb-1.5">
                  Description <span className="font-normal text-[#9BADB7]">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Any additional context…"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors resize-none"
                />
              </div>

              {/* Approver */}
              <div>
                <label className="block text-sm font-semibold text-[#223149] mb-1.5">Approver</label>
                <select
                  value={approverId}
                  onChange={e => setApproverId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors bg-white"
                >
                  <option value="">Select approver…</option>
                  {approvers.map(a => (
                    <option key={a.id} value={a.id}>{a.full_name}</option>
                  ))}
                </select>
                <p className="text-xs text-[#9BADB7] mt-1">For your reference — approval is managed in Xero.</p>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-[#223149] mb-1.5">Start Date</label>
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
                  <label className="block text-sm font-semibold text-[#223149] mb-1.5">End Date</label>
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

              {/* Current Leave Balance */}
              {selectedBalance && (
                <div className="border border-[#ECE3DF] rounded-xl divide-y divide-[#ECE3DF]">
                  <div className="flex items-center justify-between px-4 py-3 text-sm">
                    <span className="font-semibold text-[#223149]">Current Leave Balance</span>
                    <span className="text-xs text-[#9BADB7] font-medium uppercase tracking-wide">
                      {selectedBalance.units.toLowerCase() === "days" ? "Days" : "Hours"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 text-sm">
                    <span className="text-[#5F7C84]">{selectedBalance.name}</span>
                    <span className="font-bold text-[#223149] tabular-nums">
                      {Math.round(selectedBalance.balance * 100) / 100}
                    </span>
                  </div>
                  {form.startDate && form.endDate && businessDays > 0 && (
                    <div className="flex items-center justify-between px-4 py-3 text-sm">
                      <span className="text-[#5F7C84]">
                        {format(parseISO(form.startDate), "MMMM yyyy")}
                        {form.startDate.slice(0, 7) !== form.endDate.slice(0, 7) &&
                          ` – ${format(parseISO(form.endDate), "MMMM yyyy")}`}
                      </span>
                      <span className="font-bold text-[#223149] tabular-nums">
                        {selectedBalance.units.toLowerCase() === "days"
                          ? businessDays
                          : Math.round(businessDays * 7.6 * 10) / 10}
                      </span>
                    </div>
                  )}
                </div>
              )}

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
                  onClick={() => { setShowModal(false); setSubmitError(""); setApproverId(""); }}
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
