"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Palmtree, Plus, X, CheckCircle, XCircle, AlertCircle,
  RefreshCw, Clock, ChevronRight, ChevronLeft,
} from "lucide-react";
import { format, parseISO, differenceInBusinessDays, addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday } from "date-fns";
import PageSubtitle from "@/components/PageSubtitle";

// ─── Types ───────────────────────────────────────────────────────────────────

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
  title: string;
  startDate: string;
  endDate: string;
  status: string; // PENDING | REJECTED | CANCELLED | SCHEDULED | COMPLETED
  units: number;
  hours?: number | null;
  source?: "local" | "xero";
}

interface TeamLeaveRequest {
  id: string;
  staff_id: string;
  leave_type_name: string;
  start_date: string;
  end_date: string;
  description: string | null;
  hours: number | null;
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
  approver_note: string | null;
  staff: { full_name: string; email: string } | null;
}

// Keep PendingRequest as alias for backwards compat with the approval panel
type PendingRequest = TeamLeaveRequest;

interface Approver {
  id: string;
  full_name: string;
  role: string;
}

interface Props {
  staffId: string;
  staffName: string;
  hasXeroLink: boolean;
  isReviewer: boolean;
  contractedHours: number;
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
  const days = balance / 7.5;
  if (days >= 1) return `${rounded} hrs (${Math.round(days * 10) / 10} days)`;
  return `${rounded} hrs`;
}

function toXeroDate(dateStr: string): string {
  const ms = new Date(dateStr).getTime();
  return `/Date(${ms}+0000)/`;
}

function formatLeavePeriod(start: string, end: string) {
  const s = parseISO(start);
  const e = parseISO(end);
  if (start === end) return format(s, "dd MMM yyyy");
  return `${format(s, "dd MMM")} - ${format(e, "dd MMM yyyy")}`;
}

function businessDayCount(start: string, end: string) {
  return differenceInBusinessDays(addDays(parseISO(end), 1), parseISO(start));
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === "PENDING") return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border border-amber-200 text-amber-600 bg-amber-50">
      <Clock className="w-3 h-3" /> Pending
    </span>
  );
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

export default function LeavePageClient({ staffId, staffName, hasXeroLink, isReviewer, contractedHours }: Props) {
  const dailyHours = contractedHours / 5; // approximate hours per working day
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [applications, setApplications] = useState<LeaveApplication[]>([]);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [appLoading, setAppLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Tab for reviewers: "my" = own leave, "team" = all staff leave, "calendar" = leave calendar
  const [activeTab, setActiveTab] = useState<"my" | "team" | "calendar">("my");
  const [teamStatusFilter, setTeamStatusFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [teamRequests, setTeamRequests] = useState<TeamLeaveRequest[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);

  // Leave calendar state
  const [calMonth, setCalMonth] = useState(() => startOfMonth(new Date()));
  const [calRequests, setCalRequests] = useState<TeamLeaveRequest[]>([]);
  const [calLoading, setCalLoading] = useState(false);
  const [calFilter, setCalFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("ALL");

  // Pending approvals (reviewer only)
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewError, setReviewError] = useState("");

  // New / edit request form
  const [showModal, setShowModal] = useState(false);
  const [editingReqId, setEditingReqId] = useState<string | null>(null); // null = new, string = editing
  const [form, setForm] = useState({ leaveTypeId: "", startDate: "", endDate: "", hours: "", description: "" });
  const [approvers, setApprovers] = useState<Approver[]>([]);
  const [approverId, setApproverId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) { setBalanceLoading(true); setAppLoading(true); }
    else setRefreshing(true);

    const fetches: Promise<void>[] = [
      fetch(`/api/staff/${staffId}/leave-requests`)
        .then(r => r.json())
        .then(d => { setApplications(d.applications ?? []); setAppLoading(false); })
        .catch(() => setAppLoading(false)),
    ];

    if (hasXeroLink) {
      fetches.push(
        fetch(`/api/staff/${staffId}/leave-balances`)
          .then(r => r.json())
          .then(d => { setBalances(d.balances ?? []); setBalanceLoading(false); })
          .catch(() => setBalanceLoading(false))
      );
    } else {
      setBalanceLoading(false);
    }

    await Promise.all(fetches);
    setRefreshing(false);
  }, [staffId, hasXeroLink]);

  const fetchPending = useCallback(async () => {
    if (!isReviewer) return;
    setPendingLoading(true);
    fetch("/api/leave-requests?status=PENDING")
      .then(r => r.json())
      .then(d => setPendingRequests(d.requests ?? []))
      .catch(() => {})
      .finally(() => setPendingLoading(false));
  }, [isReviewer]);

  const fetchTeamRequests = useCallback(async (filter: "ALL" | "PENDING" | "APPROVED" | "REJECTED") => {
    if (!isReviewer) return;
    setTeamLoading(true);
    fetch(`/api/leave-requests?status=${filter}`)
      .then(r => r.json())
      .then(d => setTeamRequests(d.requests ?? []))
      .catch(() => {})
      .finally(() => setTeamLoading(false));
  }, [isReviewer]);

  const fetchCalRequests = useCallback(async () => {
    if (!isReviewer) return;
    setCalLoading(true);
    fetch("/api/leave-requests?status=ALL")
      .then(r => r.json())
      .then(d => setCalRequests(d.requests ?? []))
      .catch(() => {})
      .finally(() => setCalLoading(false));
  }, [isReviewer]);

  useEffect(() => {
    if (activeTab === "team") fetchTeamRequests(teamStatusFilter);
  }, [activeTab, teamStatusFilter, fetchTeamRequests]);

  useEffect(() => {
    if (activeTab === "calendar") fetchCalRequests();
  }, [activeTab, fetchCalRequests]);

  useEffect(() => {
    fetchAll();
    fetchPending();
  }, [fetchAll, fetchPending]);

  // Load approvers when modal opens
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
    const selectedBalance = balances.find(b => b.leaveTypeId === form.leaveTypeId);
    const effectiveHours = form.hours !== "" ? Number(form.hours) : autoHours || null;
    try {
      const isEdit = editingReqId !== null;
      const url = isEdit
        ? `/api/staff/${staffId}/leave-requests/${editingReqId}`
        : `/api/staff/${staffId}/leave-requests`;
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leaveTypeId: form.leaveTypeId,
          leaveTypeName: selectedBalance?.name ?? "",
          startDate: form.startDate,
          endDate: form.endDate,
          hours: effectiveHours,
          description: form.description,
          approverId: approverId || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? (isEdit ? "Failed to update" : "Failed to submit"));
      setShowModal(false);
      setForm({ leaveTypeId: "", startDate: "", endDate: "", hours: "", description: "" });
      setEditingReqId(null);
      setApproverId("");
      setSuccessMsg(isEdit
        ? "Your leave request has been updated."
        : "Your leave request has been submitted and is awaiting approval.");
      setTimeout(() => setSuccessMsg(""), 6000);
      fetchAll(true);
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async (reqId: string, action: "APPROVE" | "REJECT") => {
    setReviewingId(reqId);
    setReviewError("");
    try {
      const res = await fetch(`/api/leave-requests/${reqId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: reviewNote }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed to review");
      setReviewNote("");
      await fetchPending();
      await fetchAll(true);
    } catch (err: any) {
      setReviewError(err.message);
    } finally {
      setReviewingId(null);
    }
  };

  const selectedBalance = balances.find(b => b.leaveTypeId === form.leaveTypeId);
  const businessDays = form.startDate && form.endDate ? businessDayCount(form.startDate, form.endDate) : 0;
  // Auto-calculated hours (business days × daily contracted hours)
  const autoHours = businessDays > 0 ? Math.round(businessDays * dailyHours * 10) / 10 : 0;

  const openNewModal = () => {
    setEditingReqId(null);
    setForm({ leaveTypeId: "", startDate: "", endDate: "", hours: "", description: "" });
    setApproverId("");
    setSubmitError("");
    setShowModal(true);
  };

  const openEditModal = (app: LeaveApplication) => {
    setEditingReqId(app.id);
    setForm({
      leaveTypeId: app.leaveTypeId,
      startDate: app.startDate,
      endDate: app.endDate,
      hours: app.hours != null ? String(app.hours) : "",
      description: app.title || "",
    });
    setApproverId("");
    setSubmitError("");
    setShowModal(true);
  };

  if (!hasXeroLink) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-[#223149]">Leave Requests</h1>
        <PageSubtitle pageKey="leave" defaultDescription="Submit leave requests, track approvals, and view your available leave balance." />
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center space-y-3">
          <Palmtree className="w-8 h-8 text-[#9BADB7] mx-auto" />
          <p className="font-semibold text-[#223149]">Not linked to Xero</p>
          <p className="text-sm text-[#9BADB7]">An admin needs to link your profile to Xero Payroll before you can view or request leave.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-[#223149]">
              {isReviewer && activeTab === "team" ? "Team Leave" : "Leave Requests"}
            </h1>
            <PageSubtitle pageKey="leave" defaultDescription="Submit leave requests, track approvals, and view your available leave balance." />
            {isReviewer && (
              <div className="flex border border-[#ECE3DF] rounded-xl overflow-hidden text-sm font-semibold">
                <button
                  onClick={() => setActiveTab("my")}
                  className={`px-4 py-2 transition-colors ${activeTab === "my" ? "bg-[#223149] text-white" : "text-[#5F7C84] hover:bg-[#F8F6F4]"}`}
                >
                  Leave Requests
                </button>
                <button
                  onClick={() => setActiveTab("team")}
                  className={`px-4 py-2 transition-colors flex items-center gap-1.5 ${activeTab === "team" ? "bg-[#223149] text-white" : "text-[#5F7C84] hover:bg-[#F8F6F4]"}`}
                >
                  Team
                  {pendingRequests.length > 0 && (
                    <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold ${activeTab === "team" ? "bg-white/20" : "bg-amber-500 text-white"}`}>
                      {pendingRequests.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("calendar")}
                  className={`px-4 py-2 transition-colors ${activeTab === "calendar" ? "bg-[#223149] text-white" : "text-[#5F7C84] hover:bg-[#F8F6F4]"}`}
                >
                  Calendar
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { fetchAll(true); fetchPending(); }}
              disabled={refreshing}
              className="p-2 rounded-xl hover:bg-[#ECE3DF] transition-colors text-[#9BADB7] hover:text-[#223149]"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={openNewModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Leave Request
            </button>
          </div>
        </div>

        {/* ── Team Leave view ── */}
        {isReviewer && activeTab === "team" && (
          <div className="space-y-4">
            {/* Status filter tabs */}
            <div className="flex gap-1 border-b border-[#ECE3DF]">
              {(["PENDING", "APPROVED", "REJECTED", "ALL"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setTeamStatusFilter(f)}
                  className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors capitalize ${
                    teamStatusFilter === f
                      ? "border-[#223149] text-[#223149]"
                      : "border-transparent text-[#9BADB7] hover:text-[#5F7C84]"
                  }`}
                >
                  {f === "ALL" ? "All" : f === "PENDING" ? "Pending" : f === "APPROVED" ? "Approved" : "Rejected"}
                  {f === "PENDING" && pendingRequests.length > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">
                      {pendingRequests.length}
                    </span>
                  )}
                </button>
              ))}
              <button
                onClick={() => fetchTeamRequests(teamStatusFilter)}
                className="ml-auto p-2 text-[#9BADB7] hover:text-[#223149] transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${teamLoading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {teamLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-5 h-5 border-2 border-[#223149] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : teamRequests.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="w-8 h-8 text-[#ECE3DF] mx-auto mb-2" />
                  <p className="text-sm text-[#9BADB7]">
                    {teamStatusFilter === "PENDING" ? "No pending leave requests" : `No ${teamStatusFilter.toLowerCase()} leave requests`}
                  </p>
                </div>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#F8F6F4]">
                          <th className="px-6 py-3 text-left text-xs font-semibold text-[#9BADB7] uppercase tracking-wide">Staff</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-[#9BADB7] uppercase tracking-wide">Type</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-[#9BADB7] uppercase tracking-wide">Period</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-[#9BADB7] uppercase tracking-wide">Hours</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-[#9BADB7] uppercase tracking-wide">Submitted</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-[#9BADB7] uppercase tracking-wide">Status / Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#ECE3DF]">
                        {teamRequests.map(req => (
                          <tr key={req.id} className="hover:bg-[#F8F6F4] transition-colors">
                            <td className="px-6 py-4">
                              <p className="font-semibold text-[#223149]">{req.staff?.full_name ?? "—"}</p>
                              <p className="text-xs text-[#9BADB7]">{req.staff?.email}</p>
                            </td>
                            <td className="px-4 py-4 text-[#5F7C84]">{req.leave_type_name}</td>
                            <td className="px-4 py-4 text-[#5F7C84] tabular-nums">{formatLeavePeriod(req.start_date, req.end_date)}</td>
                            <td className="px-4 py-4 text-[#5F7C84] tabular-nums">
                              {req.hours != null ? `${req.hours}h` : "—"}
                            </td>
                            <td className="px-4 py-4 text-[#9BADB7] tabular-nums text-xs">
                              {format(parseISO(req.submitted_at), "d MMM yyyy")}
                            </td>
                            <td className="px-4 py-4 text-right">
                              {req.status === "PENDING" ? (
                                <div className="flex items-center justify-end gap-2">
                                  {reviewError && reviewingId === req.id && (
                                    <span className="text-xs text-red-500">{reviewError}</span>
                                  )}
                                  <button
                                    onClick={() => {
                                      setEditingReqId(req.id);
                                      setForm({
                                        leaveTypeId: req.leave_type_name, // best we have without leaveTypeId
                                        startDate: req.start_date,
                                        endDate: req.end_date,
                                        hours: req.hours != null ? String(req.hours) : "",
                                        description: req.description || "",
                                      });
                                      setApproverId("");
                                      setSubmitError("");
                                      setShowModal(true);
                                    }}
                                    className="text-xs font-semibold text-[#5F7C84] hover:text-[#223149] transition-colors underline"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleReview(req.id, "APPROVE")}
                                    disabled={reviewingId === req.id}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                                  >
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    {reviewingId === req.id ? "…" : "Approve"}
                                  </button>
                                  <button
                                    onClick={() => handleReview(req.id, "REJECT")}
                                    disabled={reviewingId === req.id}
                                    className="flex items-center gap-1 px-3 py-1.5 border border-red-200 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                    {reviewingId === req.id ? "…" : "Reject"}
                                  </button>
                                </div>
                              ) : (
                                <StatusBadge status={req.status} />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="sm:hidden divide-y divide-[#ECE3DF]">
                    {teamRequests.map(req => (
                      <div key={req.id} className="px-4 py-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-[#223149] text-sm">{req.staff?.full_name}</p>
                            <p className="text-xs text-[#9BADB7]">{req.leave_type_name} · {formatLeavePeriod(req.start_date, req.end_date)}{req.hours != null ? ` · ${req.hours}h` : ""}</p>
                          </div>
                          <StatusBadge status={req.status} />
                        </div>
                        {req.status === "PENDING" && (
                          <div className="flex gap-2 flex-wrap">
                            <button onClick={() => {
                              setEditingReqId(req.id);
                              setForm({ leaveTypeId: req.leave_type_name, startDate: req.start_date, endDate: req.end_date, hours: req.hours != null ? String(req.hours) : "", description: req.description || "" });
                              setApproverId(""); setSubmitError(""); setShowModal(true);
                            }} className="text-xs font-semibold text-[#5F7C84] hover:text-[#223149] transition-colors underline">
                              Edit
                            </button>
                            <button onClick={() => handleReview(req.id, "APPROVE")} disabled={reviewingId === req.id}
                              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50">
                              <CheckCircle className="w-3 h-3" /> Approve
                            </button>
                            <button onClick={() => handleReview(req.id, "REJECT")} disabled={reviewingId === req.id}
                              className="flex items-center gap-1 px-3 py-1.5 border border-red-200 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-50 disabled:opacity-50">
                              <XCircle className="w-3 h-3" /> Reject
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Leave Calendar ── */}
        {isReviewer && activeTab === "calendar" && (() => {
          // Build calendar grid: Mon–Sun weeks covering the full month
          const monthStart = startOfMonth(calMonth);
          const monthEnd   = endOfMonth(calMonth);
          const gridStart  = startOfWeek(monthStart, { weekStartsOn: 1 });
          const gridEnd    = endOfWeek(monthEnd,   { weekStartsOn: 1 });
          const days       = eachDayOfInterval({ start: gridStart, end: gridEnd });

          // Filter requests by status
          const visible = calFilter === "ALL"
            ? calRequests
            : calRequests.filter(r => r.status === calFilter);

          // For a given day, find overlapping requests
          const reqsForDay = (day: Date) => {
            const d = format(day, "yyyy-MM-dd");
            return visible.filter(r => d >= r.start_date && d <= r.end_date);
          };

          const statusColour = (status: string) => {
            if (status === "PENDING")  return "bg-amber-100 text-amber-800 border border-amber-200";
            if (status === "APPROVED") return "bg-green-100 text-green-800 border border-green-200";
            if (status === "REJECTED") return "bg-red-100 text-red-700 border border-red-200";
            return "bg-gray-100 text-gray-600";
          };

          return (
            <div className="space-y-4">
              {/* Month nav + filter */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <button onClick={() => setCalMonth(m => startOfMonth(addDays(m, -1)))}
                    className="p-1.5 rounded-xl border border-[#ECE3DF] hover:bg-[#F8F6F4] transition-colors">
                    <ChevronLeft className="w-4 h-4 text-[#223149]" />
                  </button>
                  <h2 className="text-base font-bold text-[#223149] w-36 text-center">
                    {format(calMonth, "MMMM yyyy")}
                  </h2>
                  <button onClick={() => setCalMonth(m => startOfMonth(addDays(endOfMonth(m), 1)))}
                    className="p-1.5 rounded-xl border border-[#ECE3DF] hover:bg-[#F8F6F4] transition-colors">
                    <ChevronRight className="w-4 h-4 text-[#223149]" />
                  </button>
                  <button onClick={() => setCalMonth(startOfMonth(new Date()))}
                    className="px-3 py-1.5 text-xs font-semibold border border-[#ECE3DF] rounded-xl text-[#5F7C84] hover:bg-[#F8F6F4] transition-colors">
                    Today
                  </button>
                </div>

                {/* Status filter */}
                <div className="flex border border-[#ECE3DF] rounded-xl overflow-hidden text-xs font-semibold">
                  {(["ALL", "PENDING", "APPROVED", "REJECTED"] as const).map(f => (
                    <button key={f} onClick={() => setCalFilter(f)}
                      className={`px-3 py-1.5 transition-colors ${calFilter === f ? "bg-[#223149] text-white" : "text-[#5F7C84] hover:bg-[#F8F6F4]"}`}>
                      {f === "ALL" ? "All" : f === "PENDING" ? "Pending" : f === "APPROVED" ? "Approved" : "Rejected"}
                    </button>
                  ))}
                </div>
              </div>

              {calLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-5 h-5 border-2 border-[#223149] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  {/* Day headers */}
                  <div className="grid grid-cols-7 border-b border-[#ECE3DF]">
                    {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => (
                      <div key={d} className="py-2 text-center text-xs font-semibold text-[#9BADB7] uppercase tracking-wide">
                        {d}
                      </div>
                    ))}
                  </div>

                  {/* Day cells */}
                  <div className="grid grid-cols-7 divide-x divide-y divide-[#ECE3DF]">
                    {days.map(day => {
                      const dayReqs  = reqsForDay(day);
                      const inMonth  = isSameMonth(day, calMonth);
                      const todayDay = isToday(day);
                      return (
                        <div key={day.toISOString()}
                          className={`min-h-[90px] p-1.5 ${!inMonth ? "bg-[#F8F6F4]/60" : ""}`}>
                          {/* Day number */}
                          <div className={`w-6 h-6 flex items-center justify-center text-xs font-semibold rounded-full mb-1 ${
                            todayDay ? "bg-[#223149] text-white" : inMonth ? "text-[#223149]" : "text-[#9BADB7]"
                          }`}>
                            {format(day, "d")}
                          </div>
                          {/* Leave chips */}
                          <div className="space-y-0.5">
                            {dayReqs.slice(0, 3).map(req => (
                              <div key={req.id}
                                className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md truncate leading-tight ${statusColour(req.status)}`}
                                title={`${req.staff?.full_name} — ${req.leave_type_name} (${req.status.toLowerCase()})`}>
                                {req.staff?.full_name?.split(" ")[0]}
                              </div>
                            ))}
                            {dayReqs.length > 3 && (
                              <div className="text-[10px] text-[#9BADB7] px-1">+{dayReqs.length - 3} more</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Legend */}
              <div className="flex items-center gap-4 text-xs text-[#5F7C84]">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-200" />Pending</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-100 border border-green-200" />Approved</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-100 border border-red-200" />Rejected</span>
              </div>
            </div>
          );
        })()}

        {/* ── Leave Requests content (hidden when viewing Team tab) ── */}
        {activeTab === "my" && <>

        {/* Success banner */}
        {successMsg && (
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">{successMsg}</p>
          </div>
        )}

        {/* ── My pending requests ── */}
        {(() => {
          const myPending = applications.filter(a => a.status === "PENDING" && a.source === "local");
          if (myPending.length === 0) return null;
          return (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-[#ECE3DF] flex items-center gap-3">
                <h2 className="font-semibold text-[#223149]">Your Pending Requests</h2>
                <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-xs font-semibold rounded-full border border-amber-100">
                  {myPending.length}
                </span>
              </div>
              <div className="divide-y divide-[#ECE3DF]">
                {myPending.map(app => {
                  const typeName = app.leaveName || balances.find(b => b.leaveTypeId === app.leaveTypeId)?.name || "Leave";
                  return (
                    <div key={app.id} className="px-6 py-4 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-[#223149]">{typeName}</p>
                        <p className="text-xs text-[#5F7C84] mt-0.5">
                          {formatLeavePeriod(app.startDate, app.endDate)}
                          {app.hours != null && <span className="ml-1.5 font-medium">· {app.hours}h</span>}
                          {app.title && <span className="ml-1.5 text-[#9BADB7]">· {app.title}</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <StatusBadge status="PENDING" />
                        <button
                          onClick={() => openEditModal(app)}
                          className="text-xs font-semibold text-[#5F7C84] hover:text-[#223149] transition-colors underline"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* ── Balances + Requests two-column layout at lg ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Leave Balances ── */}
          <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <span className="font-semibold text-[#223149]">Available Leave Balances</span>
              <span className="flex items-center px-1.5 py-0.5 rounded-md bg-[#13B5EA]/10 text-[#13B5EA] text-[10px] font-semibold">Xero</span>
            </div>
            {balanceLoading ? (
              <div className="flex justify-center py-6">
                <div className="w-5 h-5 border-2 border-[#223149] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : balances.length === 0 ? (
              <p className="text-sm text-[#9BADB7]">No leave balances found in Xero.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-4">
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
                    {/* Show days equivalent for hours, and hours equivalent for days */}
                    {b.units.toLowerCase() !== "days" && b.balance > 0 && (
                      <p className="text-xs opacity-60 mt-0.5 tabular-nums">
                        ≈ {Math.round((b.balance / 7.5) * 10) / 10} days
                      </p>
                    )}
                    {b.units.toLowerCase() === "days" && b.balance > 0 && (
                      <p className="text-xs opacity-60 mt-0.5 tabular-nums">
                        ≈ {Math.round(b.balance * 7.5 * 10) / 10} hrs
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Leave Requests table ── */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[#ECE3DF]">
              <h2 className="font-semibold text-[#223149]">Leave Requests</h2>
            </div>

            {appLoading ? (
              <div className="flex justify-center py-10">
                <div className="w-5 h-5 border-2 border-[#223149] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : applications.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-sm text-[#9BADB7]">No leave requests yet.</p>
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
                        <th className="px-6 py-3 text-xs font-semibold text-[#9BADB7] uppercase tracking-wide">Period</th>
                        <th className="px-6 py-3 text-xs font-semibold text-[#9BADB7] uppercase tracking-wide">Hours</th>
                        <th className="px-6 py-3 text-xs font-semibold text-[#9BADB7] uppercase tracking-wide text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#ECE3DF]">
                      {applications.map(app => {
                        const typeName = app.leaveName || balances.find(b => b.leaveTypeId === app.leaveTypeId)?.name || "Leave";
                        return (
                          <tr key={app.id} className="hover:bg-[#F8F6F4] transition-colors">
                            <td className="px-6 py-4 font-medium text-[#223149]">{typeName}</td>
                            <td className="px-6 py-4 text-[#5F7C84]">{app.title || "—"}</td>
                            <td className="px-6 py-4 text-[#5F7C84] tabular-nums">{formatLeavePeriod(app.startDate, app.endDate)}</td>
                            <td className="px-6 py-4 text-[#5F7C84] tabular-nums">{app.hours != null ? `${app.hours}h` : "—"}</td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {app.status === "PENDING" && app.source === "local" && (
                                  <button
                                    onClick={() => openEditModal(app)}
                                    className="text-xs font-semibold text-[#5F7C84] hover:text-[#223149] transition-colors underline"
                                  >
                                    Edit
                                  </button>
                                )}
                                <StatusBadge status={app.status} />
                              </div>
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
                    const typeName = app.leaveName || balances.find(b => b.leaveTypeId === app.leaveTypeId)?.name || "Leave";
                    return (
                      <div key={app.id} className="px-4 py-4 space-y-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#223149]">{typeName}</p>
                            {app.title && <p className="text-xs text-[#5F7C84] mt-0.5">{app.title}</p>}
                            <p className="text-xs text-[#9BADB7] mt-1">
                              {formatLeavePeriod(app.startDate, app.endDate)}
                              {app.hours != null && <span className="ml-2 font-medium">{app.hours}h</span>}
                            </p>
                          </div>
                          <StatusBadge status={app.status} />
                        </div>
                        {app.status === "PENDING" && app.source === "local" && (
                          <button
                            onClick={() => openEditModal(app)}
                            className="text-xs font-semibold text-[#5F7C84] hover:text-[#223149] transition-colors underline"
                          >
                            Edit request
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        </>} {/* end activeTab === "my" */}
      </div>

      {/* ── New Leave Request Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-xl w-full md:max-w-md pb-safe">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#ECE3DF]">
              <h2 className="text-lg font-bold text-[#223149]">{editingReqId ? "Edit Leave Request" : "New Leave Request"}</h2>
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
                <p className="text-xs text-[#9BADB7] mt-1">Your request will be sent for approval before going to Xero.</p>
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
                      hours: "", // reset so auto-calc kicks in
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
                    onChange={e => setForm({ ...form, endDate: e.target.value, hours: "" })}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
                  />
                </div>
              </div>

              {/* Hours */}
              {form.startDate && form.endDate && (
                <div>
                  <label className="block text-sm font-semibold text-[#223149] mb-1.5">
                    Hours
                    <span className="ml-1.5 text-xs font-normal text-[#9BADB7]">(optional — auto-calculated)</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={0.25}
                      step={0.25}
                      value={form.hours}
                      placeholder={autoHours > 0 ? String(autoHours) : ""}
                      onChange={e => setForm({ ...form, hours: e.target.value })}
                      className="w-32 px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
                    />
                    <span className="text-sm text-[#5F7C84]">hours</span>
                    {form.hours === "" && autoHours > 0 && (
                      <span className="text-xs text-[#9BADB7]">
                        {businessDays} {businessDays === 1 ? "day" : "days"} × {dailyHours}h = {autoHours}h
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#9BADB7] mt-1">
                    For a half day, enter {Math.round(dailyHours / 2 * 4) / 4}h. Leave blank to use the auto-calculated total.
                  </p>
                </div>
              )}

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
                          : Math.round(businessDays * 7.5 * 10) / 10}
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
                  {submitting ? (editingReqId ? "Saving…" : "Submitting…") : (editingReqId ? "Save Changes" : "Submit Request")}
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
