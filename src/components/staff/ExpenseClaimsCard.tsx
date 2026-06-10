"use client";

import { useEffect, useState } from "react";
import { Receipt, Plus, X, Trash2, Clock, CheckCircle, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { format, parseISO } from "date-fns";

interface Claim {
  id: string;
  date: string;
  amount: number;
  category: string;
  description: string;
  status: "pending" | "approved" | "rejected";
  reviewer_notes?: string;
  created_at: string;
}

interface Props {
  staffId: string;
  isOwnProfile: boolean;
  isManager: boolean;
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

function StatusBadge({ status }: { status: string }) {
  if (status === "pending") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-600">
      <Clock className="w-3 h-3" /> Pending
    </span>
  );
  if (status === "approved") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-600">
      <CheckCircle className="w-3 h-3" /> Approved
    </span>
  );
  if (status === "rejected") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">
      <XCircle className="w-3 h-3" /> Rejected
    </span>
  );
  return null;
}

export default function ExpenseClaimsCard({ staffId, isOwnProfile, isManager }: Props) {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ date: "", amount: "", category: "", description: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");

  const canView = isOwnProfile || isManager;

  const fetchClaims = () => {
    // Fetch only this staff member's claims — we filter client-side if admin viewing someone else's profile
    fetch(`/api/expenses?staffId=${staffId}`)
      .then(r => r.json())
      .then(d => {
        const list = Array.isArray(d) ? d.filter((c: any) => c.staff_id === staffId) : [];
        setClaims(list);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchClaims(); }, [staffId]);

  if (!canView) return null;

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
      fetchClaims();
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async (claimId: string, status: "approved" | "rejected") => {
    await fetch(`/api/expenses/${claimId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, reviewer_notes: reviewNotes }),
    });
    setReviewingId(null);
    setReviewNotes("");
    fetchClaims();
  };

  const handleDelete = async (claimId: string) => {
    if (!confirm("Delete this expense claim?")) return;
    await fetch(`/api/expenses/${claimId}`, { method: "DELETE" });
    fetchClaims();
  };

  const visible = showAll ? claims : claims.slice(0, 3);

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[#9BADB7]" />
            <span className="font-semibold text-[#223149]">Expense Claims</span>
            {claims.length > 0 && isManager && (
              <span className="text-xs text-[#9BADB7]">{claims.length}</span>
            )}
          </div>
          {isOwnProfile && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-[#5F7C84] hover:text-[#223149] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New claim
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-4">
            <div className="w-5 h-5 border-2 border-[#223149] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : claims.length === 0 ? (
          <p className="text-sm text-[#9BADB7] text-center py-4">
            {isOwnProfile ? "No expense claims yet. Use the New claim button to submit one." : "No expense claims."}
          </p>
        ) : (
          <div className="space-y-2">
            {visible.map(claim => (
              <div key={claim.id} className="border border-[#ECE3DF] rounded-xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-[#223149]">
                        ${claim.amount.toFixed(2)}
                      </span>
                      <span className="text-xs text-[#9BADB7]">{claim.category}</span>
                    </div>
                    <p className="text-sm text-[#5F7C84] mt-0.5 truncate">{claim.description}</p>
                    <p className="text-xs text-[#9BADB7] mt-0.5">
                      {format(parseISO(claim.date), "d MMM yyyy")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge status={claim.status} />
                    {(isOwnProfile && claim.status === "pending") && (
                      <button
                        onClick={() => handleDelete(claim.id)}
                        className="p-1 rounded-lg hover:bg-red-50 text-[#9BADB7] hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {claim.reviewer_notes && (
                  <p className="text-xs text-[#5F7C84] italic bg-[#F8F6F4] px-3 py-2 rounded-lg">
                    {claim.reviewer_notes}
                  </p>
                )}

                {/* Manager review actions */}
                {isManager && claim.status === "pending" && (
                  reviewingId === claim.id ? (
                    <div className="space-y-2 pt-1">
                      <textarea
                        rows={2}
                        value={reviewNotes}
                        onChange={e => setReviewNotes(e.target.value)}
                        placeholder="Optional notes for the staff member…"
                        className="w-full px-3 py-2 rounded-lg border border-[#ECE3DF] text-sm text-[#223149] placeholder:text-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 resize-none"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => handleReview(claim.id, "approved")}
                          className="flex-1 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition-colors">
                          Approve
                        </button>
                        <button onClick={() => handleReview(claim.id, "rejected")}
                          className="flex-1 py-1.5 bg-red-500 text-white rounded-lg text-xs font-semibold hover:bg-red-600 transition-colors">
                          Reject
                        </button>
                        <button onClick={() => { setReviewingId(null); setReviewNotes(""); }}
                          className="px-3 py-1.5 border border-[#ECE3DF] text-[#5F7C84] rounded-lg text-xs font-semibold hover:bg-[#F8F6F4] transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setReviewingId(claim.id)}
                      className="text-xs font-medium text-[#5F7C84] hover:text-[#223149] transition-colors"
                    >
                      Review
                    </button>
                  )
                )}
              </div>
            ))}

            {claims.length > 3 && (
              <button
                onClick={() => setShowAll(v => !v)}
                className="flex items-center gap-1 text-xs text-[#5F7C84] hover:text-[#223149] transition-colors"
              >
                {showAll ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {showAll ? "Show less" : `Show all ${claims.length} claims`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* New Claim Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-xl w-full md:max-w-md pb-safe">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#ECE3DF]">
              <h2 className="text-lg font-bold text-[#223149]">New Expense Claim</h2>
              <button onClick={() => { setShowModal(false); setSubmitError(""); }}
                className="p-2 rounded-xl hover:bg-[#F8F6F4] transition-colors">
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

              {submitError && <p className="text-sm text-red-500">{submitError}</p>}

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50"
                >
                  {submitting ? "Submitting…" : "Submit Claim"}
                </button>
                <button type="button" onClick={() => { setShowModal(false); setSubmitError(""); }}
                  className="px-4 py-2.5 border border-[#ECE3DF] text-[#5F7C84] rounded-xl text-sm font-semibold hover:bg-[#F8F6F4] transition-colors">
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
