"use client";

import { useEffect, useState } from "react";
import {
  Receipt, Plus, X, Trash2, Clock, CheckCircle, XCircle,
  ChevronDown, AlertCircle, RefreshCw
} from "lucide-react";
import { format, parseISO } from "date-fns";
import Image from "next/image";

interface Claim {
  id: string;
  staff_id: string;
  date: string;
  amount: number;
  category: string;
  description: string;
  status: "pending" | "approved" | "rejected";
  reviewer_notes?: string;
  created_at: string;
  staff?: {
    id: string;
    full_name: string;
    avatar_url?: string;
    position?: string;
  };
}

interface Props {
  staffId: string;
  isReviewer: boolean;
}

const CATEGORIES = [
  "Travel & Transport",
  "Meals & Entertainment",
  "Office Supplies",
  "Equipment",
  "Training & Education",
  "Ministry & Outreach",
  "Communication",
  "Other",
];

type FilterTab = "all" | "pending" | "approved" | "rejected";

function StatusBadge({ status }: { status: string }) {
  if (status === "pending") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-600 border border-amber-100">
      <Clock className="w-3 h-3" /> Pending
    </span>
  );
  if (status === "approved") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-600 border border-green-100">
      <CheckCircle className="w-3 h-3" /> Approved
    </span>
  );
  if (status === "rejected") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-100">
      <XCircle className="w-3 h-3" /> Rejected
    </span>
  );
  return null;
}

function StaffAvatar({ staff }: { staff: Claim["staff"] }) {
  const name = staff?.full_name ?? "?";
  const initials = name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  if (staff?.avatar_url) {
    return (
      <Image src={staff.avatar_url} alt={name} width={32} height={32}
        className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-[#223149] flex items-center justify-center flex-shrink-0">
      <span className="text-white text-xs font-bold">{initials}</span>
    </div>
  );
}

export default function ExpensesPageClient({ staffId, isReviewer }: Props) {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterTab>("all");

  // New claim modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ date: "", amount: "", category: "", description: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Review
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewing, setReviewing] = useState(false);

  const fetchClaims = async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch("/api/expenses");
      const d = await res.json();
      setClaims(Array.isArray(d) ? d : []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchClaims(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed to submit");
      setShowModal(false);
      setForm({ date: "", amount: "", category: "", description: "" });
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 5000);
      fetchClaims(true);
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async (claimId: string, status: "approved" | "rejected") => {
    setReviewing(true);
    await fetch(`/api/expenses/${claimId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, reviewer_notes: reviewNotes }),
    });
    setReviewingId(null);
    setReviewNotes("");
    setReviewing(false);
    fetchClaims(true);
  };

  const handleDelete = async (claimId: string) => {
    if (!confirm("Delete this expense claim?")) return;
    await fetch(`/api/expenses/${claimId}`, { method: "DELETE" });
    fetchClaims(true);
  };

  // Stats
  const pendingClaims = claims.filter(c => c.status === "pending");
  const pendingTotal = pendingClaims.reduce((sum, c) => sum + c.amount, 0);

  // Filtered list
  const filtered = claims.filter(c => filter === "all" || c.status === filter);

  const tabs: { key: FilterTab; label: string; count?: number }[] = [
    { key: "all", label: "All", count: claims.length },
    { key: "pending", label: "Pending", count: pendingClaims.length },
    { key: "approved", label: "Approved", count: claims.filter(c => c.status === "approved").length },
    { key: "rejected", label: "Rejected", count: claims.filter(c => c.status === "rejected").length },
  ];

  return (
    <>
      <div className="space-y-6 max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#223149]">Expense Claims</h1>
            {isReviewer && (
              <p className="text-sm text-[#9BADB7] mt-1">Review and approve staff expense claims.</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchClaims(true)}
              disabled={refreshing}
              className="p-2 rounded-xl hover:bg-[#ECE3DF] transition-colors text-[#9BADB7] hover:text-[#223149]"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors"
            >
              <Plus className="w-4 h-4" />
              New claim
            </button>
          </div>
        </div>

        {/* Success banner */}
        {submitSuccess && (
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">Expense claim submitted successfully.</p>
          </div>
        )}

        {/* Summary cards — reviewer only */}
        {isReviewer && !loading && pendingClaims.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <p className="text-xs text-[#9BADB7] font-medium">Pending Review</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{pendingClaims.length}</p>
              <p className="text-xs text-[#9BADB7] mt-0.5">
                {pendingClaims.length === 1 ? "claim" : "claims"} awaiting approval
              </p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <p className="text-xs text-[#9BADB7] font-medium">Total Pending</p>
              <p className="text-2xl font-bold text-[#223149] mt-1">
                ${pendingTotal.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-[#9BADB7] mt-0.5">AUD</p>
            </div>
          </div>
        )}

        {/* Claims list */}
        <div className="bg-white rounded-2xl shadow-sm">
          {/* Filter tabs */}
          <div className="flex border-b border-[#ECE3DF] px-2 pt-2">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-xl transition-colors ${
                  filter === tab.key
                    ? "text-[#223149] border-b-2 border-[#223149] -mb-px"
                    : "text-[#9BADB7] hover:text-[#5F7C84]"
                }`}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                    filter === tab.key ? "bg-[#223149] text-white" : "bg-[#F8F6F4] text-[#9BADB7]"
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="p-4">
            {loading ? (
              <div className="flex justify-center py-10">
                <div className="w-6 h-6 border-2 border-[#223149] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-10 space-y-2">
                <Receipt className="w-8 h-8 text-[#ECE3DF] mx-auto" />
                <p className="text-sm text-[#9BADB7]">
                  {filter === "all" ? "No expense claims yet." : `No ${filter} claims.`}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(claim => (
                  <div key={claim.id} className="border border-[#ECE3DF] rounded-xl p-4 space-y-3">
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        {isReviewer && claim.staff && (
                          <StaffAvatar staff={claim.staff} />
                        )}
                        <div className="min-w-0">
                          {isReviewer && claim.staff && (
                            <p className="text-xs font-semibold text-[#223149]">{claim.staff.full_name}</p>
                          )}
                          <div className="flex items-center gap-2 flex-wrap mt-0.5">
                            <span className="text-base font-bold text-[#223149]">
                              ${claim.amount.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className="text-xs text-[#9BADB7] bg-[#F8F6F4] px-2 py-0.5 rounded-full">
                              {claim.category}
                            </span>
                          </div>
                          <p className="text-sm text-[#5F7C84] mt-1">{claim.description}</p>
                          <p className="text-xs text-[#9BADB7] mt-1">
                            {format(parseISO(claim.date), "d MMMM yyyy")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <StatusBadge status={claim.status} />
                        {claim.staff_id === staffId && claim.status === "pending" && (
                          <button
                            onClick={() => handleDelete(claim.id)}
                            className="p-1 rounded-lg hover:bg-red-50 text-[#9BADB7] hover:text-red-400 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Reviewer notes */}
                    {claim.reviewer_notes && (
                      <div className="text-xs text-[#5F7C84] italic bg-[#F8F6F4] px-3 py-2 rounded-lg">
                        {claim.reviewer_notes}
                      </div>
                    )}

                    {/* Review actions */}
                    {isReviewer && claim.status === "pending" && (
                      reviewingId === claim.id ? (
                        <div className="space-y-2 pt-1 border-t border-[#ECE3DF]">
                          <textarea
                            rows={2}
                            value={reviewNotes}
                            onChange={e => setReviewNotes(e.target.value)}
                            placeholder="Optional notes for the staff member…"
                            className="w-full px-3 py-2 rounded-lg border border-[#ECE3DF] text-sm text-[#223149] placeholder:text-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 resize-none"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleReview(claim.id, "approved")}
                              disabled={reviewing}
                              className="flex-1 py-2 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleReview(claim.id, "rejected")}
                              disabled={reviewing}
                              className="flex-1 py-2 bg-red-500 text-white rounded-lg text-xs font-semibold hover:bg-red-600 transition-colors disabled:opacity-50"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => { setReviewingId(null); setReviewNotes(""); }}
                              className="px-3 py-2 border border-[#ECE3DF] text-[#5F7C84] rounded-lg text-xs font-semibold hover:bg-[#F8F6F4] transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="pt-2 border-t border-[#ECE3DF]">
                          <button
                            onClick={() => { setReviewingId(claim.id); setReviewNotes(""); }}
                            className="text-xs font-medium text-[#5F7C84] hover:text-[#223149] transition-colors"
                          >
                            Review →
                          </button>
                        </div>
                      )
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Claim Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-xl w-full md:max-w-md pb-safe">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#ECE3DF]">
              <h2 className="text-lg font-bold text-[#223149]">New Expense Claim</h2>
              <button
                onClick={() => { setShowModal(false); setSubmitError(""); }}
                className="p-2 rounded-xl hover:bg-[#F8F6F4] transition-colors"
              >
                <X className="w-5 h-5 text-[#5F7C84]" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-[#223149] mb-1.5">Date</label>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#223149] mb-1.5">Amount (AUD)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9BADB7] text-sm">$</span>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      value={form.amount}
                      onChange={e => setForm({ ...form, amount: e.target.value })}
                      placeholder="0.00"
                      className="w-full pl-7 pr-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#223149] mb-1.5">Category</label>
                <select
                  required
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors bg-white"
                >
                  <option value="">Select category…</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#223149] mb-1.5">Description</label>
                <textarea
                  required
                  rows={3}
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="What was this expense for?"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors resize-none"
                />
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
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50"
                >
                  {submitting ? "Submitting…" : "Submit Claim"}
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
