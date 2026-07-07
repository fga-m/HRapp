"use client";

import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Paperclip, AlertTriangle, Loader2, CheckCircle2, Pencil, ChevronDown, ChevronUp } from "lucide-react";
import ExpenseEditModal from "@/components/expenses/ExpenseEditModal";
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
  tax_type?: string | null;
  tax_amount?: number | null;
  line_items?: ExpenseLine[] | null;
  spent_at?: string | null;
  // "approved" appears only for claims whose background Xero push stalled
  // (approved a while ago, still no Xero invoice) so they can be retried.
  status: "submitted" | "push_failed" | "approved";
  xero_error?: string | null;
  receipt_signed_url?: string | null;
  receipt_mime?: string | null;
  staff?: { id: string; full_name: string; avatar_url?: string | null; position?: string | null } | null;
}

function initials(name?: string) {
  return (name ?? "?").split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

// GST portion of a (tax-inclusive) claim. Uses the explicit tax_amount when set,
// otherwise infers it: GST-free → 0, else the 10% inclusive portion (amount/11).
// For itemised claims it sums the per-line GST the same way.
function round2(n: number) {
  return Math.round(n * 100) / 100;
}
function gstFor(claim: Claim): number {
  const lines = claim.line_items;
  if (Array.isArray(lines) && lines.length > 0) {
    return round2(
      lines.reduce((sum, l) => {
        if (l.tax_amount != null) return sum + Number(l.tax_amount);
        const free = /free/i.test(l.tax_rate_name ?? "");
        return sum + (free ? 0 : Number(l.amount) / 11);
      }, 0)
    );
  }
  if (claim.tax_amount != null) return Number(claim.tax_amount);
  const free = /free/i.test(claim.tax_rate_name ?? "");
  return free ? 0 : round2(Number(claim.amount) / 11);
}

export default function ExpenseApproverQueue() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [actionError, setActionError] = useState("");
  const [editing, setEditing] = useState<Claim | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/expenses?queue=1")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => setClaims(Array.isArray(d) ? d : []))
      .catch(() => setError("Couldn't load the expense queue."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Warm the browser cache for the first few receipt images so "View receipt"
  // opens instantly instead of downloading on click.
  useEffect(() => {
    claims
      .filter((c) => c.receipt_signed_url && c.receipt_mime?.startsWith("image/"))
      .slice(0, 6)
      .forEach((c) => {
        const img = new Image();
        img.src = c.receipt_signed_url!;
      });
  }, [claims]);

  const decide = async (claim: Claim, action: "APPROVE" | "REJECT", noteText?: string) => {
    setBusyId(claim.id);
    setActionError("");
    try {
      const res = await fetch(`/api/expenses/${claim.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: noteText }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "Action failed");
      setRejectingId(null);
      setNote("");
      // Optimistically drop the card rather than re-fetching (and re-signing
      // receipt URLs for) the entire queue after every decision.
      setClaims((prev) => prev.filter((c) => c.id !== claim.id));
    } catch (err: any) {
      setActionError(`${claim.staff?.full_name ?? "Claim"}: ${err.message}`);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-[#50676E]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
        <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (claims.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2">
        <CheckCircle2 className="w-10 h-10 text-[#50676E]" />
        <p className="text-sm text-[#50676E]">No expense claims awaiting review.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {actionError && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{actionError}</p>
        </div>
      )}

      {claims.map((claim) => {
        const failed = claim.status === "push_failed";
        const stalled = claim.status === "approved"; // push never completed
        const busy = busyId === claim.id;
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
              <div className="flex flex-col items-end flex-shrink-0 leading-tight">
                <span className="text-lg font-bold text-[#223149]">${Number(claim.amount).toFixed(2)}</span>
                <span className="text-[11px] text-[#50676E]">incl. GST ${gstFor(claim).toFixed(2)}</span>
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
                <button
                  type="button"
                  onClick={() => setExpandedId(expandedId === claim.id ? null : claim.id)}
                  className="inline-flex items-center gap-1 text-[#223149] hover:underline"
                >
                  <Paperclip className="w-3 h-3" />
                  {expandedId === claim.id ? "Hide receipt" : "View receipt"}
                  {expandedId === claim.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>
            )}

            {/* Inline receipt preview */}
            {expandedId === claim.id && claim.receipt_signed_url && (
              <div className="rounded-lg border border-[#ECE3DF] overflow-hidden">
                {claim.receipt_mime?.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={claim.receipt_signed_url} alt="Receipt" className="w-full max-h-[480px] object-contain bg-[#F8F6F4]" />
                ) : (
                  <iframe src={claim.receipt_signed_url} title="Receipt" className="w-full h-[60vh] md:h-[480px] bg-[#F8F6F4]" />
                )}
                <div className="px-3 py-2 text-right bg-white border-t border-[#ECE3DF]">
                  <a href={claim.receipt_signed_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#50676E] hover:text-[#223149] hover:underline">
                    Open in new tab
                  </a>
                </div>
              </div>
            )}

            {failed && claim.xero_error && (
              <div className="flex items-start gap-2 p-2.5 bg-red-50 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">Last push failed: {claim.xero_error}</p>
              </div>
            )}

            {stalled && (
              <div className="flex items-start gap-2 p-2.5 bg-amber-50 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">Approved, but it never reached Xero — retry sending.</p>
              </div>
            )}

            {rejectingId === claim.id ? (
              <div className="space-y-2">
                <textarea
                  rows={2} value={note} onChange={(e) => setNote(e.target.value)}
                  placeholder="Reason for declining (optional)…"
                  className="w-full px-3 py-2 rounded-lg border border-[#ECE3DF] text-sm text-[#223149] placeholder:text-[#6E8189] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 resize-none"
                />
                <div className="flex gap-2">
                  <button disabled={busy} onClick={() => decide(claim, "REJECT", note)}
                    className="flex-1 py-2 bg-red-500 text-white rounded-lg text-xs font-semibold hover:bg-red-600 transition-colors disabled:opacity-50">
                    {busy ? "Declining…" : "Confirm decline"}
                  </button>
                  <button onClick={() => { setRejectingId(null); setNote(""); }}
                    className="px-3 py-2 border border-[#ECE3DF] text-[#50676E] rounded-lg text-xs font-semibold hover:bg-[#F8F6F4] transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button disabled={busy} onClick={() => decide(claim, "APPROVE")}
                  className="flex-1 py-2 bg-[#223149] text-white rounded-lg text-xs font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50">
                  {busy ? "Working…" : failed || stalled ? "Retry sending to Xero" : "Approve & send to Xero"}
                </button>
                <button disabled={busy} onClick={() => setEditing(claim)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#ECE3DF] text-[#50676E] rounded-lg text-xs font-semibold hover:bg-[#F8F6F4] transition-colors disabled:opacity-50">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                {!failed && !stalled && (
                  <button disabled={busy} onClick={() => { setRejectingId(claim.id); setNote(""); }}
                    className="px-3 py-2 border border-[#ECE3DF] text-[#50676E] rounded-lg text-xs font-semibold hover:bg-[#F8F6F4] transition-colors disabled:opacity-50">
                    Decline
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {editing && (
        <ExpenseEditModal
          claim={editing}
          subtitle={`${editing.staff?.full_name ?? "Staff"}'s submission`}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}
