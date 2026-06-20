"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  TrendingUp,
  CheckCircle,
  Clock,
  Eye,
  EyeOff,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { CRITERIA, SCORE_LABELS, type EvaluationData } from "@/lib/performance";
import { useConfirm } from "@/components/ui/ConfirmDialog";

// ─── Score colour helpers ──────────────────────────────────────────────────

// 3 = "Meeting Expectations" is the target, so it (and above) reads positive.
function scoreBadgeClass(score: number) {
  if (score <= 1) return "bg-red-100 text-red-700";
  if (score === 2) return "bg-amber-100 text-amber-700";
  return "bg-green-100 text-green-700"; // 3+ meets or exceeds expectations
}

function scoreButtonClass(score: number, selected: boolean) {
  if (!selected) return "bg-[#ECE3DF] text-[#50676E]";
  const map: Record<number, string> = {
    1: "bg-red-600/10 text-red-600 ring-1 ring-red-600",
    2: "bg-amber-500/10 text-amber-600 ring-1 ring-amber-500",
    3: "bg-green-600/10 text-green-600 ring-1 ring-green-600",
    4: "bg-green-600/10 text-green-700 ring-1 ring-green-600",
    5: "bg-emerald-600/10 text-emerald-700 ring-1 ring-emerald-600",
  };
  return map[score] ?? "bg-[#223149] text-white";
}

function diffClass(diff: number) {
  if (diff === 0) return "text-[#50676E]";
  if (diff > 0) return "text-green-600";
  return "text-amber-600";
}

// ─── Evaluation form ───────────────────────────────────────────────────────

function EvalForm({
  initialData,
  onSave,
  onSubmit,
  saving,
  submitting,
}: {
  initialData: EvaluationData | null;
  onSave: (data: EvaluationData) => void;
  onSubmit: (data: EvaluationData) => void;
  saving: boolean;
  submitting: boolean;
}) {
  const confirm = useConfirm();
  const empty: EvaluationData = {
    scores: {},
    comments: {},
    overall: "",
    goals: "",
  };
  const [data, setData] = useState<EvaluationData>(initialData ?? empty);

  const setScore = (key: string, score: number) =>
    setData((d) => ({ ...d, scores: { ...d.scores, [key]: score } }));

  const setComment = (key: string, val: string) =>
    setData((d) => ({ ...d, comments: { ...d.comments, [key]: val } }));

  const handleSubmit = async () => {
    if (!(await confirm({ title: "Submit self-evaluation?", message: "Once submitted you cannot edit it.", confirmLabel: "Submit" }))) return;
    onSubmit(data);
  };

  return (
    <div className="space-y-6">
      <p className="text-xs text-[#50676E] bg-[#F8F6F4] border border-[#ECE3DF] rounded-xl px-3 py-2">
        Rate each area from 1 ({SCORE_LABELS[1]}) to 5 ({SCORE_LABELS[5]}). 3 ({SCORE_LABELS[3]}) is the expected standard.
      </p>
      {CRITERIA.map((criterion) => {
        const selected = data.scores[criterion.key] ?? 0;
        return (
          <div key={criterion.key} className="space-y-2">
            <p className="text-sm font-semibold text-[#223149]">{criterion.label}</p>
            {/* Score buttons */}
            <div className="flex gap-1.5 flex-wrap">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setScore(criterion.key, n)}
                  className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${scoreButtonClass(n, selected === n)}`}
                >
                  {n}
                </button>
              ))}
            </div>
            {selected > 0 && (
              <p className="text-xs text-[#50676E]">{SCORE_LABELS[selected]}</p>
            )}
            <textarea
              rows={2}
              value={data.comments[criterion.key] ?? ""}
              onChange={(e) => setComment(criterion.key, e.target.value)}
              placeholder="Comments…"
              className="w-full px-3 py-2.5 rounded-xl border border-[#ECE3DF] text-sm text-[#223149] placeholder:text-[#6E8189] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors resize-none"
            />
          </div>
        );
      })}

      {/* Overall */}
      <div>
        <label htmlFor="overall-comments" className="block text-sm font-semibold text-[#223149] mb-1.5">
          Overall comments
        </label>
        <textarea id="overall-comments"
          rows={3}
          value={data.overall}
          onChange={(e) => setData((d) => ({ ...d, overall: e.target.value }))}
          placeholder="Overall comments…"
          className="w-full px-3 py-2.5 rounded-xl border border-[#ECE3DF] text-sm text-[#223149] placeholder:text-[#6E8189] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors resize-none"
        />
      </div>

      {/* Goals */}
      <div>
        <label htmlFor="goals-for-next-period" className="block text-sm font-semibold text-[#223149] mb-1.5">
          Goals for next period
        </label>
        <textarea id="goals-for-next-period"
          rows={3}
          value={data.goals}
          onChange={(e) => setData((d) => ({ ...d, goals: e.target.value }))}
          placeholder="Goals for next period…"
          className="w-full px-3 py-2.5 rounded-xl border border-[#ECE3DF] text-sm text-[#223149] placeholder:text-[#6E8189] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors resize-none"
        />
      </div>

      <div className="pt-2">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onSave(data)}
            disabled={saving}
            className="px-4 py-2.5 border border-[#ECE3DF] text-[#50676E] rounded-xl text-sm font-semibold hover:bg-[#F8F6F4] transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save draft"}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit"}
          </button>
        </div>
        <p className="text-xs text-[#50676E] mt-2">
          Submitting locks your self-evaluation — you won&apos;t be able to edit it.
        </p>
      </div>
    </div>
  );
}

// ─── Read-only eval display ────────────────────────────────────────────────

function EvalReadOnly({ data }: { data: EvaluationData }) {
  return (
    <div className="space-y-5">
      {CRITERIA.map((criterion) => {
        const score = data.scores?.[criterion.key];
        const comment = data.comments?.[criterion.key];
        return (
          <div key={criterion.key}>
            <p className="text-xs font-semibold text-[#50676E] uppercase tracking-wide mb-1">
              {criterion.label}
            </p>
            {score ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-bold ${scoreBadgeClass(score)}`}
                >
                  {score}
                </span>
                <span className="text-sm text-[#50676E]">{SCORE_LABELS[score]}</span>
              </div>
            ) : (
              <span className="text-sm text-[#50676E] italic">No score</span>
            )}
            {comment && (
              <p className="text-sm text-[#50676E] mt-1 whitespace-pre-wrap">{comment}</p>
            )}
          </div>
        );
      })}

      {data.overall && (
        <div>
          <p className="text-xs font-semibold text-[#50676E] uppercase tracking-wide mb-1">
            Overall Comments
          </p>
          <p className="text-sm text-[#50676E] whitespace-pre-wrap">{data.overall}</p>
        </div>
      )}
      {data.goals && (
        <div>
          <p className="text-xs font-semibold text-[#50676E] uppercase tracking-wide mb-1">
            Goals for Next Period
          </p>
          <p className="text-sm text-[#50676E] whitespace-pre-wrap">{data.goals}</p>
        </div>
      )}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────

export default function PerformanceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [togglingVisibility, setTogglingVisibility] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [success, setSuccess] = useState("");

  // Year-on-year data
  const [yoyReviews, setYoyReviews] = useState<any[]>([]);

  const fetchReview = useCallback(() => {
    setLoading(true);
    setLoadError("");
    fetch(`/api/performance/${id}`)
      .then((r) => { if (!r.ok) throw new Error("Failed to load"); return r.json(); })
      .then((d) => {
        setData(d);
        setLoading(false);
        // Fetch year-on-year data once we know the staff_id
        if (d?.review?.staff_id) {
          fetch(`/api/performance/staff/${d.review.staff_id}`)
            .then((r) => { if (!r.ok) throw new Error("Failed to load YoY"); return r.json(); })
            .then((yoy) => setYoyReviews(yoy.reviews || []))
            .catch(() => setYoyReviews([]));
        }
      })
      .catch(() => { setLoadError("Could not load this review. Please try again."); setLoading(false); });
  }, [id]);

  useEffect(() => { fetchReview(); }, [fetchReview]);

  const patchReview = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/performance/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || "Failed");
    return d;
  };

  const handleSaveSelf = async (evalData: EvaluationData) => {
    setSaving(true);
    setError("");
    try {
      await patchReview({ self_evaluation: evalData });
      setSuccess("Draft saved.");
      fetchReview();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitSelf = async (evalData: EvaluationData) => {
    setSubmitting(true);
    setError("");
    try {
      await patchReview({ self_evaluation: evalData, submit: true });
      setSuccess("Self-evaluation submitted.");
      fetchReview();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveManager = async (evalData: EvaluationData) => {
    setSaving(true);
    setError("");
    try {
      await patchReview({ manager_evaluation: evalData });
      setSuccess("Draft saved.");
      fetchReview();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitManager = async (evalData: EvaluationData) => {
    setSubmitting(true);
    setError("");
    try {
      await patchReview({ manager_evaluation: evalData, submit: true });
      setSuccess("Manager evaluation submitted.");
      fetchReview();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleVisibility = async () => {
    const current = data?.review?.is_visible_to_staff ?? false;
    setTogglingVisibility(true);
    setError("");
    try {
      await patchReview({ is_visible_to_staff: !current });
      setSuccess(!current ? "Manager evaluation is now visible to the staff member." : "Manager evaluation is now hidden.");
      fetchReview();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTogglingVisibility(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#223149] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{loadError}</p>
        </div>
        <button
          onClick={fetchReview}
          className="px-4 py-2 border border-[#ECE3DF] text-[#50676E] rounded-xl text-sm font-semibold hover:bg-[#F8F6F4] transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data?.review) {
    return <div className="text-[#50676E]">Review not found.</div>;
  }

  const { review, role, callerId } = data;
  const isManagerOrAdmin = role === "admin" || role === "manager";
  const isOwnReview = review.staff_id === callerId;

  const selfEval: EvaluationData | null = review.self_evaluation;
  const managerEval: EvaluationData | null = review.manager_evaluation;
  const selfSubmitted = !!review.self_submitted_at;
  const managerSubmitted = !!review.manager_submitted_at;

  const canEditSelf = isOwnReview && !selfSubmitted;
  const canEditManager = isManagerOrAdmin && !managerSubmitted;
  const showManagerCard =
    isManagerOrAdmin || (isOwnReview && review.is_visible_to_staff);

  // Year-on-year table: multiple reviews
  const hasMultiplePeriods = yoyReviews.length > 1;

  // Side-by-side comparison
  const showSideBySide = isManagerOrAdmin && selfEval && managerEval;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <Link
          href="/dashboard/performance"
          className="p-2 rounded-xl hover:bg-[#ECE3DF] transition-colors flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5 text-[#223149]" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-[#223149]">{review.period_label}</h1>
            {selfSubmitted ? (
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
          </div>
          {isManagerOrAdmin && review.staff && (
            <p className="text-[#50676E] mt-0.5 text-sm">
              {review.staff.full_name}
              {review.staff.position && ` · ${review.staff.position}`}
            </p>
          )}
        </div>
      </div>

      {/* Alerts */}
      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
          {success}
        </div>
      )}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Two-column evaluation section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Self Evaluation */}
        <div className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="w-4 h-4 text-[#50676E]" />
            <h2 className="text-base font-bold text-[#223149]">Self Evaluation</h2>
            {selfSubmitted && (
              <span className="ml-auto text-xs text-[#50676E]">
                {format(new Date(review.self_submitted_at), "d MMM yyyy")}
              </span>
            )}
          </div>

          {canEditSelf ? (
            <EvalForm
              initialData={selfEval}
              onSave={handleSaveSelf}
              onSubmit={handleSubmitSelf}
              saving={saving}
              submitting={submitting}
            />
          ) : selfEval ? (
            <EvalReadOnly data={selfEval} />
          ) : (
            <div className="flex items-center gap-2 text-sm text-[#50676E] py-4">
              <AlertCircle className="w-4 h-4" />
              Not yet submitted
            </div>
          )}
        </div>

        {/* Manager Evaluation */}
        {showManagerCard && (
          <div className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp className="w-4 h-4 text-[#50676E]" />
              <h2 className="text-base font-bold text-[#223149]">Manager Evaluation</h2>
              {managerSubmitted && (
                <span className="ml-auto text-xs text-[#50676E]">
                  {format(new Date(review.manager_submitted_at), "d MMM yyyy")}
                </span>
              )}
            </div>

            {canEditManager ? (
              <EvalForm
                initialData={managerEval}
                onSave={handleSaveManager}
                onSubmit={handleSubmitManager}
                saving={saving}
                submitting={submitting}
              />
            ) : managerEval ? (
              <EvalReadOnly data={managerEval} />
            ) : (
              <div className="flex items-center gap-2 text-sm text-[#50676E] py-4">
                <AlertCircle className="w-4 h-4" />
                {isManagerOrAdmin ? "Not yet submitted" : "Manager evaluation not yet available"}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Manager controls */}
      {isManagerOrAdmin && (
        <div className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm p-6 space-y-4">
          <h2 className="text-base font-bold text-[#223149]">Manager Controls</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#223149]">Share with staff member</p>
              <p className="text-xs text-[#50676E] mt-0.5">
                {review.is_visible_to_staff
                  ? "Staff can currently see the manager evaluation."
                  : "Staff cannot currently see the manager evaluation."}
              </p>
            </div>
            <button
              onClick={handleToggleVisibility}
              disabled={togglingVisibility}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
                review.is_visible_to_staff
                  ? "bg-[#5F7C84]/10 text-[#50676E] hover:bg-[#5F7C84]/20"
                  : "bg-[#223149] text-white hover:bg-[#1a2638]"
              }`}
            >
              {review.is_visible_to_staff ? (
                <><EyeOff className="w-4 h-4" />{togglingVisibility ? "Updating…" : "Hide"}</>
              ) : (
                <><Eye className="w-4 h-4" />{togglingVisibility ? "Updating…" : "Share"}</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Side-by-side comparison */}
      {showSideBySide && (
        <div className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm p-6">
          <h2 className="text-base font-bold text-[#223149] mb-5">Side-by-Side Comparison</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#ECE3DF]">
                  <th className="sticky left-0 bg-white z-10 text-left py-3 pr-4 font-semibold text-[#50676E] text-xs uppercase tracking-wide">
                    Criterion
                  </th>
                  <th className="text-center py-3 px-3 font-semibold text-[#50676E] text-xs uppercase tracking-wide">
                    Self
                  </th>
                  <th className="text-center py-3 px-3 font-semibold text-[#50676E] text-xs uppercase tracking-wide">
                    Manager
                  </th>
                  <th className="text-center py-3 pl-3 font-semibold text-[#50676E] text-xs uppercase tracking-wide">
                    Manager − Self
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECE3DF]">
                {CRITERIA.map((criterion) => {
                  const selfScore = selfEval?.scores?.[criterion.key] ?? 0;
                  const managerScore = managerEval?.scores?.[criterion.key] ?? 0;
                  const diff = managerScore - selfScore;
                  return (
                    <tr key={criterion.key}>
                      <td className="sticky left-0 bg-white z-10 py-3 pr-4 font-medium text-[#223149]">{criterion.label}</td>
                      <td className="py-3 px-3 text-center">
                        {selfScore > 0 ? (
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-sm font-bold ${scoreBadgeClass(selfScore)}`}>
                            {selfScore}
                          </span>
                        ) : (
                          <span className="text-[#50676E]">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {managerScore > 0 ? (
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-sm font-bold ${scoreBadgeClass(managerScore)}`}>
                            {managerScore}
                          </span>
                        ) : (
                          <span className="text-[#50676E]">—</span>
                        )}
                      </td>
                      <td className={`py-3 pl-3 text-center font-semibold ${diffClass(diff)}`}>
                        {selfScore && managerScore ? (
                          diff > 0 ? `+${diff}` : diff === 0 ? "0" : `${diff}`
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-[#50676E] mt-3">
            &ldquo;Manager − Self&rdquo; is the difference between the manager&apos;s and your score.
          </p>

          {/* Overall & goals comparison */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-[#50676E] uppercase tracking-wide mb-2">
                Overall — Self
              </p>
              <p className="text-sm text-[#50676E] whitespace-pre-wrap">
                {selfEval?.overall || <span className="italic text-[#50676E]">None</span>}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-[#50676E] uppercase tracking-wide mb-2">
                Overall — Manager
              </p>
              <p className="text-sm text-[#50676E] whitespace-pre-wrap">
                {managerEval?.overall || <span className="italic text-[#50676E]">None</span>}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Year-on-year comparison */}
      {hasMultiplePeriods && (
        <div className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm p-6">
          <h2 className="text-base font-bold text-[#223149] mb-1">Year-on-Year Comparison</h2>
          <p className="text-xs text-[#50676E] mb-5">
            Large number is the self-evaluation score.
            {(isManagerOrAdmin || review.is_visible_to_staff) ? " M = Manager score." : ""}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#ECE3DF]">
                  <th className="sticky left-0 bg-white z-10 text-left py-3 pr-4 font-semibold text-[#50676E] text-xs uppercase tracking-wide">
                    Criterion
                  </th>
                  {yoyReviews.map((r) => (
                    <th
                      key={r.id}
                      className={`text-center py-3 px-3 text-xs uppercase tracking-wide font-semibold ${r.id === review.id ? "text-[#223149]" : "text-[#50676E]"}`}
                    >
                      <Link
                        href={`/dashboard/performance/${r.id}`}
                        className="hover:underline"
                      >
                        {r.period_label}
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECE3DF]">
                {CRITERIA.map((criterion) => (
                  <tr key={criterion.key}>
                    <td className="py-3 pr-4 font-medium text-[#223149]">{criterion.label}</td>
                    {yoyReviews.map((r) => {
                      const selfScore = r.self_evaluation?.scores?.[criterion.key];
                      const mgScore = r.manager_evaluation?.scores?.[criterion.key];
                      const showMgr = isManagerOrAdmin || r.is_visible_to_staff;
                      return (
                        <td key={r.id} className="py-3 px-3 text-center">
                          {selfScore ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <span
                                className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-sm font-bold ${scoreBadgeClass(selfScore)}`}
                              >
                                {selfScore}
                              </span>
                              {showMgr && mgScore && (
                                <span className={`text-xs font-medium ${scoreBadgeClass(mgScore)} px-1.5 py-0.5 rounded`}>
                                  M:{mgScore}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[#50676E]">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-[#50676E] mt-3">
            Tap a period heading to open that review.
          </p>
        </div>
      )}
    </div>
  );
}
