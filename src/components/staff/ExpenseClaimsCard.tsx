"use client";

import { useEffect, useState } from "react";
import { Receipt, Plus, X, Trash2, Clock, CheckCircle, XCircle, Send, AlertTriangle, ChevronDown, ChevronUp, Paperclip } from "lucide-react";
import { format, parseISO } from "date-fns";

interface Claim {
  id: string;
  date: string;
  amount: number;
  description: string;
  account_name?: string | null;
  spent_at?: string | null;
  status: "submitted" | "approved" | "rejected" | "pushed" | "push_failed";
  reviewer_notes?: string | null;
  receipt_signed_url?: string | null;
  created_at: string;
}

interface Props {
  staffId: string;
  isOwnProfile: boolean;
  isManager: boolean;
}

interface XeroAccount { code: string; name: string; taxType: string }
interface XeroTaxRate { taxType: string; name: string; rate: number }

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
    submitted: { cls: "bg-amber-50 text-amber-600", icon: <Clock className="w-3 h-3" />, label: "Submitted" },
    approved: { cls: "bg-blue-50 text-blue-600", icon: <CheckCircle className="w-3 h-3" />, label: "Approved" },
    pushed: { cls: "bg-green-50 text-green-600", icon: <Send className="w-3 h-3" />, label: "Sent to Xero" },
    rejected: { cls: "bg-red-50 text-red-600", icon: <XCircle className="w-3 h-3" />, label: "Rejected" },
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

export default function ExpenseClaimsCard({ staffId, isOwnProfile, isManager }: Props) {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // form fields
  const [amount, setAmount] = useState("");
  const [spentOn, setSpentOn] = useState("");
  const [description, setDescription] = useState("");
  const [spentAt, setSpentAt] = useState("");
  const [accountCode, setAccountCode] = useState("");
  const [taxType, setTaxType] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // Xero dropdown data
  const [accounts, setAccounts] = useState<XeroAccount[]>([]);
  const [taxRates, setTaxRates] = useState<XeroTaxRate[]>([]);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState("");

  const canView = isOwnProfile || isManager;

  const fetchClaims = () => {
    fetch(`/api/expenses?staffId=${staffId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        setClaims(Array.isArray(d) ? d.filter((c: any) => c.staff_id === staffId) : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchClaims(); }, [staffId]);

  // Load the Xero account + tax-rate dropdowns when the form opens.
  useEffect(() => {
    if (!showModal || accounts.length > 0) return;
    setMetaLoading(true);
    setMetaError("");
    Promise.all([
      fetch("/api/xero/accounts").then((r) => (r.ok ? r.json() : Promise.reject(r))),
      fetch("/api/xero/tax-rates").then((r) => (r.ok ? r.json() : Promise.reject(r))),
    ])
      .then(([accs, taxes]) => {
        setAccounts(accs);
        setTaxRates(taxes);
      })
      .catch(async (r) => {
        const body = r?.json ? await r.json().catch(() => ({})) : {};
        setMetaError(body.error || "Couldn't load accounts from Xero. Is Xero connected?");
      })
      .finally(() => setMetaLoading(false));
  }, [showModal, accounts.length]);

  if (!canView) return null;

  const resetForm = () => {
    setAmount(""); setSpentOn(""); setDescription(""); setSpentAt("");
    setAccountCode(""); setTaxType(""); setFile(null); setSubmitError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { setSubmitError("Please attach a receipt."); return; }
    setSubmitting(true);
    setSubmitError("");
    try {
      const account = accounts.find((a) => a.code === accountCode);
      const tax = taxRates.find((t) => t.taxType === taxType);
      const fd = new FormData();
      fd.append("amount", amount);
      fd.append("spent_on", spentOn);
      fd.append("description", description);
      fd.append("spent_at", spentAt);
      fd.append("account_code", accountCode);
      fd.append("account_name", account?.name ?? "");
      fd.append("tax_type", taxType);
      fd.append("tax_rate_name", tax?.name ?? "");
      fd.append("line_amount_type", "Inclusive");
      fd.append("file", file);

      const res = await fetch("/api/expenses", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed to submit");
      setShowModal(false);
      resetForm();
      fetchClaims();
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
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
            {visible.map((claim) => (
              <div key={claim.id} className="border border-[#ECE3DF] rounded-xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-[#223149]">
                        ${Number(claim.amount).toFixed(2)}
                      </span>
                      {claim.account_name && <span className="text-xs text-[#9BADB7]">{claim.account_name}</span>}
                    </div>
                    <p className="text-sm text-[#5F7C84] mt-0.5 truncate">{claim.description}</p>
                    <p className="text-xs text-[#9BADB7] mt-0.5">
                      {format(parseISO(claim.date), "d MMM yyyy")}
                      {claim.spent_at ? ` · ${claim.spent_at}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge status={claim.status} />
                    {isOwnProfile && claim.status === "submitted" && (
                      <button
                        onClick={() => handleDelete(claim.id)}
                        className="p-1 rounded-lg hover:bg-red-50 text-[#9BADB7] hover:text-red-400 transition-colors"
                        title="Delete claim"
                        aria-label="Delete claim"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {claim.receipt_signed_url && (
                  <a
                    href={claim.receipt_signed_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-[#5F7C84] hover:text-[#223149] transition-colors"
                  >
                    <Paperclip className="w-3 h-3" /> View receipt
                  </a>
                )}

                {claim.reviewer_notes && (
                  <p className="text-xs text-[#5F7C84] italic bg-[#F8F6F4] px-3 py-2 rounded-lg">
                    {claim.reviewer_notes}
                  </p>
                )}
              </div>
            ))}

            {claims.length > 3 && (
              <button
                onClick={() => setShowAll((v) => !v)}
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
          <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-xl w-full md:max-w-md max-h-[90vh] overflow-y-auto pb-safe">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#ECE3DF] sticky top-0 bg-white">
              <h2 className="text-lg font-bold text-[#223149]">New Expense Claim</h2>
              <button onClick={() => { setShowModal(false); setSubmitError(""); }}
                className="p-2 rounded-xl hover:bg-[#F8F6F4] transition-colors">
                <X className="w-5 h-5 text-[#5F7C84]" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Receipt (required) */}
              <div>
                <label className="block text-sm font-semibold text-[#223149] mb-1.5">Receipt <span className="text-red-500">*</span></label>
                <input
                  type="file"
                  required
                  accept="image/png,image/jpeg,application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-[#5F7C84] file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#223149] file:text-white hover:file:bg-[#1a2638]"
                />
                <p className="text-xs text-[#9BADB7] mt-1">A photo or PDF of the receipt (PNG, JPG or PDF).</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-[#223149] mb-1.5">Spent on</label>
                  <input
                    type="date" required value={spentOn}
                    onChange={(e) => setSpentOn(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#223149] mb-1.5">Amount (AUD)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9BADB7] text-sm">$</span>
                    <input
                      type="number" required min="0.01" step="0.01" value={amount}
                      onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                      className="w-full pl-7 pr-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#223149] mb-1.5">Description</label>
                <textarea
                  required rows={2} value={description}
                  onChange={(e) => setDescription(e.target.value)} placeholder="What was it for?"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#223149] mb-1.5">Spent at <span className="text-[#9BADB7] font-normal">(optional)</span></label>
                <input
                  type="text" value={spentAt}
                  onChange={(e) => setSpentAt(e.target.value)} placeholder="Where was the money spent?"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
                />
              </div>

              {metaError ? (
                <p className="text-sm text-red-500">{metaError}</p>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-[#223149] mb-1.5">Account</label>
                    <select
                      required value={accountCode} disabled={metaLoading}
                      onChange={(e) => setAccountCode(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors bg-white disabled:opacity-50"
                    >
                      <option value="">{metaLoading ? "Loading…" : "Select account…"}</option>
                      {accounts.map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#223149] mb-1.5">Tax rate</label>
                    <select
                      required value={taxType} disabled={metaLoading}
                      onChange={(e) => setTaxType(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors bg-white disabled:opacity-50"
                    >
                      <option value="">{metaLoading ? "Loading…" : "Select tax rate…"}</option>
                      {taxRates.map((t) => <option key={t.taxType} value={t.taxType}>{t.name}</option>)}
                    </select>
                    <p className="text-xs text-[#9BADB7] mt-1">Amount is treated as tax-inclusive.</p>
                  </div>
                </>
              )}

              {submitError && <p className="text-sm text-red-500">{submitError}</p>}

              <div className="flex gap-3 pt-1">
                <button
                  type="submit" disabled={submitting || metaLoading || !!metaError}
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
