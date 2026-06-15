"use client";

import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Paperclip, AlertTriangle, Loader2, CheckCircle2, Pencil, X } from "lucide-react";

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
  staff?: { id: string; full_name: string; avatar_url?: string | null; position?: string | null } | null;
}

interface XeroAccount { code: string; name: string; taxType: string }
interface XeroTaxRate { taxType: string; name: string; rate: number }

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

  // Edit modal state
  const [editing, setEditing] = useState<Claim | null>(null);
  const [edit, setEdit] = useState({ amount: "", description: "", spent_at: "", spent_on: "", account_code: "", tax_type: "" });
  const [accounts, setAccounts] = useState<XeroAccount[]>([]);
  const [taxRates, setTaxRates] = useState<XeroTaxRate[]>([]);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  const load = () => {
    setLoading(true);
    fetch("/api/expenses?queue=1")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => setClaims(Array.isArray(d) ? d : []))
      .catch(() => setError("Couldn't load the expense queue."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Load the Xero account + tax-rate dropdowns when the edit modal opens.
  useEffect(() => {
    if (!editing || accounts.length > 0) return;
    setMetaLoading(true);
    setMetaError("");
    Promise.all([
      fetch("/api/xero/accounts").then((r) => (r.ok ? r.json() : Promise.reject(r))),
      fetch("/api/xero/tax-rates").then((r) => (r.ok ? r.json() : Promise.reject(r))),
    ])
      .then(([accs, taxes]) => {
        setAccounts(Array.isArray(accs) ? accs : accs?.accounts ?? []);
        setTaxRates(Array.isArray(taxes) ? taxes : taxes?.taxRates ?? []);
      })
      .catch(async (r) => {
        const body = r?.json ? await r.json().catch(() => ({})) : {};
        setMetaError(body.error || "Couldn't load accounts from Xero.");
      })
      .finally(() => setMetaLoading(false));
  }, [editing, accounts.length]);

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

  const openEdit = (c: Claim) => {
    setEditError("");
    setEdit({
      amount: c.amount != null ? String(c.amount) : "",
      description: c.description ?? "",
      spent_at: c.spent_at ?? "",
      spent_on: c.date ?? "",
      account_code: c.account_code ?? "",
      tax_type: c.tax_type ?? "",
    });
    setEditing(c);
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSavingEdit(true);
    setEditError("");
    try {
      const account = accounts.find((a) => a.code === edit.account_code);
      const tax = taxRates.find((t) => t.taxType === edit.tax_type);
      const res = await fetch(`/api/expenses/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE",
          fields: {
            amount: edit.amount,
            description: edit.description,
            spent_at: edit.spent_at,
            spent_on: edit.spent_on,
            account_code: edit.account_code,
            account_name: account?.name ?? "",
            tax_type: edit.tax_type,
            tax_rate_name: tax?.name ?? "",
          },
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "Failed to save changes");
      setEditing(null);
      load();
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setSavingEdit(false);
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
                <a href={claim.receipt_signed_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#223149] hover:underline">
                  <Paperclip className="w-3 h-3" /> View receipt
                </a>
              )}
            </div>

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
              <div className="flex gap-2 pt-1">
                <button disabled={busy} onClick={() => decide(claim, "APPROVE")}
                  className="flex-1 py-2 bg-[#223149] text-white rounded-lg text-xs font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50">
                  {busy ? "Working…" : failed ? "Retry sending to Xero" : "Approve & send to Xero"}
                </button>
                <button disabled={busy} onClick={() => openEdit(claim)}
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

      {/* Edit modal — approver corrects a submission before approving */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-xl w-full md:max-w-md max-h-[90vh] overflow-y-auto pb-safe">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#ECE3DF] sticky top-0 bg-white">
              <div>
                <h2 className="text-lg font-bold text-[#223149]">Edit claim</h2>
                <p className="text-xs text-[#9BADB7]">{editing.staff?.full_name}&rsquo;s submission</p>
              </div>
              <button onClick={() => setEditing(null)} className="p-2 rounded-xl hover:bg-[#F8F6F4] transition-colors" aria-label="Close">
                <X className="w-5 h-5 text-[#5F7C84]" />
              </button>
            </div>
            <form onSubmit={saveEdit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-[#223149] mb-1.5">Spent on</label>
                  <input type="date" required value={edit.spent_on}
                    onChange={(e) => setEdit({ ...edit, spent_on: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#223149] mb-1.5">Amount (AUD)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9BADB7] text-sm">$</span>
                    <input type="number" required min="0.01" step="0.01" value={edit.amount}
                      onChange={(e) => setEdit({ ...edit, amount: e.target.value })}
                      className="w-full pl-7 pr-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#223149] mb-1.5">Description</label>
                <textarea required rows={2} value={edit.description}
                  onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors resize-none" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#223149] mb-1.5">Spent at <span className="text-[#9BADB7] font-normal">(optional)</span></label>
                <input type="text" value={edit.spent_at}
                  onChange={(e) => setEdit({ ...edit, spent_at: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors" />
              </div>

              {metaError ? (
                <p className="text-sm text-red-500">{metaError}</p>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-[#223149] mb-1.5">Account</label>
                    <select required value={edit.account_code} disabled={metaLoading}
                      onChange={(e) => setEdit({ ...edit, account_code: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors bg-white disabled:opacity-50">
                      <option value="">{metaLoading ? "Loading…" : "Select account…"}</option>
                      {accounts.map((a) => <option key={a.code} value={a.code}>{a.code ? `${a.code} · ${a.name}` : a.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#223149] mb-1.5">Tax rate</label>
                    <select required value={edit.tax_type} disabled={metaLoading}
                      onChange={(e) => setEdit({ ...edit, tax_type: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors bg-white disabled:opacity-50">
                      <option value="">{metaLoading ? "Loading…" : "Select tax rate…"}</option>
                      {taxRates.map((t) => <option key={t.taxType} value={t.taxType}>{t.name}</option>)}
                    </select>
                  </div>
                </>
              )}

              {editError && <p className="text-sm text-red-500">{editError}</p>}

              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={savingEdit || metaLoading || !!metaError}
                  className="flex-1 px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50">
                  {savingEdit ? "Saving…" : "Save changes"}
                </button>
                <button type="button" onClick={() => setEditing(null)}
                  className="px-4 py-2.5 border border-[#ECE3DF] text-[#5F7C84] rounded-xl text-sm font-semibold hover:bg-[#F8F6F4] transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
