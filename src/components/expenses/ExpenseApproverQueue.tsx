"use client";

import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Paperclip, AlertTriangle, Loader2, CheckCircle2, Pencil, ChevronDown, ChevronUp } from "lucide-react";
import ExpenseEditModal from "@/components/expenses/ExpenseEditModal";

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
  spent_at?: string | null;
  status: "submitted" | "push_failed";
  xero_error?: string | null;
  receipt_signed_url?: string | null;
  receipt_mime?: string | null;
  staff?: { id: string; full_name: string; avatar_url?: string | null; position?: string | null } | null;
}

function initials(name?: string) {
  return (name ?? "?").split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
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
      load();
    } catch (err: any) {
      setActionError(`${claim.staff?.full_name ?? "Claim"}: ${err.message}`);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-[#5F7C84]" />
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
        <CheckCircle2 className="w-10 h-10 text-[#9BADB7]" />
        <p className="text-sm text-[#9BADB7]">No expense claims awaiting review.</p>
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
        const busy = busyId === claim.id;
        return (
          <div key={claim.id} className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
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
                  <p className="text-xs text-[#9BADB7]">
                    {format(parseISO(claim.date), "d MMM yyyy")}
                    {claim.spent_at ? ` · ${claim.spent_at}` : ""}
                  </p>
                </div>
              </div>
              <span className="text-lg font-bold text-[#223149] flex-shrink-0">${Number(claim.amount).toFixed(2)}</span>
            </div>

            <p className="text-sm text-[#223149]">{claim.description}</p>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#5F7C84]">
              {claim.account_name && <span><span className="text-[#9BADB7]">Account:</span> {claim.account_name}</span>}
              {claim.tax_rate_name && <span><span className="text-[#9BADB7]">Tax:</span> {claim.tax_rate_name}</span>}
              {claim.receipt_signed_url && (
                <button
                  type="button"
                  onClick={() => setExpandedId(expandedId === claim.id ? null : claim.id)}
                  className="inline-flex items-center gap-1 text-[#223149] hover:underline"
                >
                  <Paperclip className="w-3 h-3" />
                  {expandedId === claim.id ? "Hide receipt" : "View receipt"}
                  {expandedId === claim.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}
            </div>

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
                  <a href={claim.receipt_signed_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#5F7C84] hover:text-[#223149] hover:underline">
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

            {rejectingId === claim.id ? (
              <div className="space-y-2">
                <textarea
                  rows={2} value={note} onChange={(e) => setNote(e.target.value)}
                  placeholder="Reason for declining (optional)…"
                  className="w-full px-3 py-2 rounded-lg border border-[#ECE3DF] text-sm text-[#223149] placeholder:text-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 resize-none"
                />
                <div className="flex gap-2">
                  <button disabled={busy} onClick={() => decide(claim, "REJECT", note)}
                    className="flex-1 py-2 bg-red-500 text-white rounded-lg text-xs font-semibold hover:bg-red-600 transition-colors disabled:opacity-50">
                    {busy ? "Declining…" : "Confirm decline"}
                  </button>
                  <button onClick={() => { setRejectingId(null); setNote(""); }}
                    className="px-3 py-2 border border-[#ECE3DF] text-[#5F7C84] rounded-lg text-xs font-semibold hover:bg-[#F8F6F4] transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button disabled={busy} onClick={() => decide(claim, "APPROVE")}
                  className="flex-1 py-2 bg-[#223149] text-white rounded-lg text-xs font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50">
                  {busy ? "Working…" : failed ? "Retry sending to Xero" : "Approve & send to Xero"}
                </button>
                <button disabled={busy} onClick={() => setEditing(claim)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#ECE3DF] text-[#5F7C84] rounded-lg text-xs font-semibold hover:bg-[#F8F6F4] transition-colors disabled:opacity-50">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                {!failed && (
                  <button disabled={busy} onClick={() => { setRejectingId(claim.id); setNote(""); }}
                    className="px-3 py-2 border border-[#ECE3DF] text-[#5F7C84] rounded-lg text-xs font-semibold hover:bg-[#F8F6F4] transition-colors disabled:opacity-50">
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
