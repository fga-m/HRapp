"use client";

import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Paperclip, AlertTriangle, Loader2, ChevronDown, ChevronUp, Clock, CheckCircle, XCircle, Send } from "lucide-react";
import type { ExpenseLine } from "@/lib/expense-lines";

interface Claim {
  id: string;
  staff_id: string;
  date: string;
  amount: number;
  description: string;
  account_name?: string | null;
  account_code?: string | null;
  tax_rate_name?: string | null;
  line_items?: ExpenseLine[] | null;
  spent_at?: string | null;
  status: "submitted" | "approved" | "rejected" | "pushed" | "push_failed";
  reviewer_notes?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  receipt_signed_url?: string | null;
  receipt_mime?: string | null;
  staff?: { id: string; full_name: string; avatar_url?: string | null } | null;
  reviewer?: { id: string; full_name: string } | null;
}

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function initials(name?: string) {
  return (name ?? "?").split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
    submitted: { cls: "bg-amber-50 text-amber-600", icon: <Clock className="w-3 h-3" />, label: "Submitted" },
    approved: { cls: "bg-blue-50 text-blue-600", icon: <CheckCircle className="w-3 h-3" />, label: "Approved" },
    pushed: { cls: "bg-green-50 text-green-600", icon: <Send className="w-3 h-3" />, label: "Sent to Xero" },
    rejected: { cls: "bg-red-50 text-red-600", icon: <XCircle className="w-3 h-3" />, label: "Declined" },
    push_failed: { cls: "bg-red-50 text-red-600", icon: <AlertTriangle className="w-3 h-3" />, label: "Push failed" },
  };
  const m = map[status];
  if (!m) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${m.cls}`}>
      {m.icon} {m.label}
    </span>
  );
}

function fmtTs(ts?: string | null) {
  if (!ts) return "";
  try { return format(parseISO(ts), "d MMM yyyy, h:mm a"); } catch { return ""; }
}

export default function ExpenseHistory() {
  const today = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(today.getDate() - 7);

  const [from, setFrom] = useState(toYMD(weekAgo));
  const [to, setTo] = useState(toYMD(today));
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`/api/expenses?all=1&from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => setClaims(Array.isArray(d) ? d : []))
      .catch(() => setError("Couldn't load the claim history."))
      .finally(() => setLoading(false));
  }, [from, to]);

  return (
    <div className="space-y-4">
      {/* Date range filter */}
      <div className="flex flex-wrap items-end gap-3 bg-white rounded-2xl border border-[#ECE3DF] shadow-sm p-4">
        <div>
          <label htmlFor="from" className="block text-xs font-semibold text-[#50676E] mb-1">From</label>
          <input id="from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-2 rounded-xl border border-[#ECE3DF] text-sm text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20" />
        </div>
        <div>
          <label htmlFor="to" className="block text-xs font-semibold text-[#50676E] mb-1">To</label>
          <input id="to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)}
            className="px-3 py-2 rounded-xl border border-[#ECE3DF] text-sm text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20" />
        </div>
        <div className="flex gap-1.5">
          {[
            { label: "7 days", days: 7 },
            { label: "30 days", days: 30 },
            { label: "90 days", days: 90 },
          ].map((p) => (
            <button
              key={p.days}
              onClick={() => { const t = new Date(); const f = new Date(); f.setDate(t.getDate() - p.days); setFrom(toYMD(f)); setTo(toYMD(t)); }}
              className="px-3 py-2 rounded-xl border border-[#ECE3DF] text-xs font-medium text-[#50676E] hover:bg-[#F8F6F4] transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-[#50676E] ml-auto self-center">by date submitted</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#50676E]" /></div>
      ) : error ? (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      ) : claims.length === 0 ? (
        <p className="text-sm text-[#50676E] text-center py-12">No claims in this date range.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-[#50676E]">{claims.length} claim{claims.length === 1 ? "" : "s"}</p>
          {claims.map((claim) => {
            const reviewed = !!claim.reviewed_at;
            const declined = claim.status === "rejected";
            return (
              <div key={claim.id} className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {claim.staff?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={claim.staff.avatar_url} alt={claim.staff.full_name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-[#223149] flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">{initials(claim.staff?.full_name)}</span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#223149] truncate">{claim.staff?.full_name ?? "Unknown"}</p>
                      <p className="text-xs text-[#50676E]">
                        {format(parseISO(claim.date), "d MMM yyyy")}
                        {claim.spent_at ? ` · ${claim.spent_at}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-lg font-bold text-[#223149]">${Number(claim.amount).toFixed(2)}</span>
                    <StatusBadge status={claim.status} />
                  </div>
                </div>

                <p className="text-sm text-[#223149]">{claim.description}</p>

                {Array.isArray(claim.line_items) && claim.line_items.length > 0 ? (
                  <div className="rounded-lg border border-[#ECE3DF] divide-y divide-[#ECE3DF]">
                    {claim.line_items.map((l, i) => (
                      <div key={i} className="flex items-start justify-between gap-3 px-3 py-2 text-xs">
                        <div className="min-w-0">
                          <p className="text-[#223149] truncate">{l.description}</p>
                          <p className="text-[#50676E]">
                            {l.account_name || l.account_code}
                            {l.tax_rate_name ? ` · ${l.tax_rate_name}` : ""}
                            {l.tax_amount != null ? ` · GST $${Number(l.tax_amount).toFixed(2)}` : ""}
                          </p>
                        </div>
                        <span className="text-[#223149] font-medium flex-shrink-0">${Number(l.amount).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  (claim.account_name || claim.tax_rate_name) && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#50676E]">
                      {claim.account_name && <span><span className="text-[#50676E]">Account:</span> {claim.account_name}</span>}
                      {claim.tax_rate_name && <span><span className="text-[#50676E]">Tax:</span> {claim.tax_rate_name}</span>}
                    </div>
                  )
                )}

                {claim.receipt_signed_url && (
                  <div className="text-xs">
                    <button type="button" onClick={() => setExpandedId(expandedId === claim.id ? null : claim.id)}
                      className="inline-flex items-center gap-1 text-[#223149] hover:underline">
                      <Paperclip className="w-3 h-3" />
                      {expandedId === claim.id ? "Hide receipt" : "View receipt"}
                      {expandedId === claim.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>
                )}

                {expandedId === claim.id && claim.receipt_signed_url && (
                  <div className="rounded-lg border border-[#ECE3DF] overflow-hidden">
                    {claim.receipt_mime?.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={claim.receipt_signed_url} alt="Receipt" className="w-full max-h-[480px] object-contain bg-[#F8F6F4]" />
                    ) : (
                      <iframe src={claim.receipt_signed_url} title="Receipt" className="w-full h-[60vh] md:h-[480px] bg-[#F8F6F4]" />
                    )}
                  </div>
                )}

                {/* Audit trail: submitted + reviewed */}
                <div className="border-t border-[#ECE3DF] pt-2 space-y-0.5 text-xs text-[#50676E]">
                  <p>Submitted by {claim.staff?.full_name ?? "Unknown"} · {fmtTs(claim.created_at)}</p>
                  {reviewed && (
                    <p>
                      {declined ? "Declined" : "Approved"} by {claim.reviewer?.full_name ?? "an approver"} · {fmtTs(claim.reviewed_at)}
                    </p>
                  )}
                  {claim.reviewer_notes && <p className="text-[#50676E] italic">Note: {claim.reviewer_notes}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
