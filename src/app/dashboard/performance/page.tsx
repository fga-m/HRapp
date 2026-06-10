"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  TrendingUp,
  ChevronRight,
  CheckCircle,
  Clock,
  Eye,
  EyeOff,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import Image from "next/image";
import PageSubtitle from "@/components/PageSubtitle";

type Review = {
  id: string;
  staff_id: string;
  period_label: string;
  year: number;
  period_type: string;
  self_submitted_at: string | null;
  manager_submitted_at: string | null;
  is_visible_to_staff: boolean;
  created_at: string;
  staff: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    position: string | null;
  } | null;
};

type StaffMember = {
  id: string;
  full_name: string;
  position: string | null;
};

function StaffAvatar({ name, src }: { name: string; src?: string | null }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={40}
        height={40}
        className="w-10 h-10 rounded-full object-cover ring-2 ring-[#ECE3DF]"
      />
    );
  }
  return (
    <div className="w-10 h-10 rounded-full bg-[#223149] flex items-center justify-center ring-2 ring-[#ECE3DF] flex-shrink-0">
      <span className="text-white text-xs font-bold">{initials}</span>
    </div>
  );
}

export default function PerformancePage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [role, setRole] = useState("staff");
  const [callerId, setCallerId] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [formStaffId, setFormStaffId] = useState("");
  const [formYear, setFormYear] = useState(new Date().getFullYear());
  const [formPeriod, setFormPeriod] = useState<"mid_year" | "end_of_year">("mid_year");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchReviews = () => {
    setLoading(true);
    fetch("/api/performance")
      .then((r) => r.json())
      .then((d) => {
        setReviews(d.reviews || []);
        setRole(d.role || "staff");
        setCallerId(d.callerId || "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const openModal = async () => {
    setFormError("");
    setFormStaffId("");
    setFormYear(new Date().getFullYear());
    setFormPeriod("mid_year");
    setShowModal(true);
    if (staffList.length === 0) {
      const res = await fetch("/api/staff?active=true");
      const d = await res.json();
      setStaffList(d.staff || []);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formStaffId) { setFormError("Please select a staff member"); return; }
    setSubmitting(true);
    setFormError("");
    try {
      const res = await fetch("/api/performance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staff_id: formStaffId, year: formYear, period_type: formPeriod }),
      });
      const d = await res.json();
      if (!res.ok) { setFormError(d.error || "Failed to create review"); setSubmitting(false); return; }
      setShowModal(false);
      fetchReviews();
    } catch {
      setFormError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const isManagerOrAdmin = role === "admin" || role === "manager";
  const currentYear = new Date().getFullYear();
  const pendingSelfEval = reviews.filter(
    (r) => r.staff_id === callerId && !r.self_submitted_at
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#223149] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-[#223149]">Performance Reviews</h1>
          <PageSubtitle pageKey="performance" defaultDescription="Track performance conversations and review notes for staff." />
        </div>
        {isManagerOrAdmin && (
          <button
            onClick={openModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Review
          </button>
        )}
      </div>

      {/* Staff: pending self-eval prompt */}
      {!isManagerOrAdmin && pendingSelfEval.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Self-evaluation pending</p>
            <p className="text-sm text-amber-700 mt-0.5">
              You have {pendingSelfEval.length} review{pendingSelfEval.length > 1 ? "s" : ""} awaiting your self-evaluation.
            </p>
          </div>
        </div>
      )}

      {/* Reviews list */}
      {reviews.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 shadow-sm text-center">
          <TrendingUp className="w-10 h-10 text-[#9BADB7] mx-auto mb-3" />
          <p className="text-[#5F7C84] font-medium">No performance reviews yet</p>
          {isManagerOrAdmin && (
            <button
              onClick={openModal}
              className="text-sm text-[#223149] underline mt-1 inline-block"
            >
              Create the first review
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-[#ECE3DF]">
          {reviews.map((review) => (
            <Link
              key={review.id}
              href={`/dashboard/performance/${review.id}`}
              className="flex items-center gap-4 px-6 py-4 hover:bg-[#F8F6F4] transition-colors group"
            >
              {/* Avatar (admin/manager view) */}
              {isManagerOrAdmin && review.staff && (
                <div className="flex-shrink-0">
                  <StaffAvatar
                    name={review.staff.full_name}
                    src={review.staff.avatar_url}
                  />
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {isManagerOrAdmin && review.staff && (
                    <p className="font-semibold text-[#223149]">{review.staff.full_name}</p>
                  )}
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#223149]/10 text-[#223149]">
                    {review.period_label}
                  </span>
                </div>
                {isManagerOrAdmin && review.staff?.position && (
                  <p className="text-xs text-[#9BADB7] mt-0.5">{review.staff.position}</p>
                )}
                <p className="text-xs text-[#9BADB7] mt-0.5">
                  Created {format(new Date(review.created_at), "d MMM yyyy")}
                </p>
              </div>

              {/* Status badges */}
              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                {/* Self eval */}
                {review.self_submitted_at ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-lg">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Self submitted
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
                    <Clock className="w-3.5 h-3.5" />
                    Self pending
                  </span>
                )}

                {/* Manager eval (only shown to manager/admin) */}
                {isManagerOrAdmin && (
                  review.manager_submitted_at ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-lg">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Manager complete
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
                      <Clock className="w-3.5 h-3.5" />
                      Manager pending
                    </span>
                  )
                )}

                {/* Visibility badge (admin/manager) */}
                {isManagerOrAdmin && (
                  review.is_visible_to_staff ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-[#5F7C84] bg-[#ECE3DF] px-2 py-1 rounded-lg">
                      <Eye className="w-3.5 h-3.5" />
                      Visible
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-medium text-[#9BADB7] bg-[#F8F6F4] px-2 py-1 rounded-lg">
                      <EyeOff className="w-3.5 h-3.5" />
                      Hidden
                    </span>
                  )
                )}

                <ChevronRight className="w-4 h-4 text-[#9BADB7] group-hover:text-[#223149] transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* New Review Modal */}
      {showModal && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setShowModal(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <h2 className="text-xl font-bold text-[#223149] mb-5">New Performance Review</h2>
              <form onSubmit={handleCreate} className="space-y-4">
                {/* Staff select */}
                <div>
                  <label className="block text-sm font-semibold text-[#223149] mb-1.5">
                    Staff Member
                  </label>
                  <select
                    value={formStaffId}
                    onChange={(e) => setFormStaffId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#ECE3DF] text-sm text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors bg-white"
                  >
                    <option value="">Select staff member…</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name}{s.position ? ` — ${s.position}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Year */}
                <div>
                  <label className="block text-sm font-semibold text-[#223149] mb-1.5">
                    Year
                  </label>
                  <select
                    value={formYear}
                    onChange={(e) => setFormYear(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#ECE3DF] text-sm text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors bg-white"
                  >
                    <option value={currentYear - 1}>{currentYear - 1}</option>
                    <option value={currentYear}>{currentYear}</option>
                    <option value={currentYear + 1}>{currentYear + 1}</option>
                  </select>
                </div>

                {/* Period */}
                <div>
                  <label className="block text-sm font-semibold text-[#223149] mb-1.5">
                    Period
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["mid_year", "end_of_year"] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setFormPeriod(p)}
                        className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                          formPeriod === p
                            ? "bg-[#223149] text-white border-[#223149]"
                            : "bg-white text-[#5F7C84] border-[#ECE3DF] hover:bg-[#F8F6F4]"
                        }`}
                      >
                        {p === "mid_year" ? "Mid-Year" : "End-of-Year"}
                      </button>
                    ))}
                  </div>
                </div>

                {formError && (
                  <p className="text-sm text-red-600">{formError}</p>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2.5 border border-[#ECE3DF] text-[#5F7C84] rounded-xl text-sm font-semibold hover:bg-[#F8F6F4] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50"
                  >
                    {submitting ? "Creating…" : "Create Review"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
