"use client";

import { useEffect, useRef, useState } from "react";
import { Receipt, Plus, X, Trash2, Clock, CheckCircle, XCircle, Send, AlertTriangle, ChevronDown, ChevronUp, Paperclip, Upload, Pencil } from "lucide-react";
import { format, parseISO } from "date-fns";
import ExpenseEditModal from "@/components/expenses/ExpenseEditModal";
import AccountSelect from "@/components/expenses/AccountSelect";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { evaluateAmount, looksLikeExpression } from "@/lib/calc";
import LineItemsEditor from "@/components/expenses/LineItemsEditor";
import { autoGstInclusive, round2, validateExpenseLines, type ExpenseLine, type ExpenseTotals } from "@/lib/expense-lines";

interface Claim {
  id: string;
  date: string;
  amount: number;
  description: string;
  account_name?: string | null;
  account_code?: string | null;
  tax_type?: string | null;
  tax_rate_name?: string | null;
  tax_amount?: number | null;
  line_items?: ExpenseLine[] | null;
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

export default function ExpenseClaimsCard({ staffId, isOwnProfile, isManager }: Props) {
  const confirm = useConfirm();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingClaim, setEditingClaim] = useState<Claim | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // form fields
  const [amount, setAmount] = useState("");
  const [spentOn, setSpentOn] = useState("");
  const [description, setDescription] = useState("");
  const [spentAt, setSpentAt] = useState("");
  const [accountCode, setAccountCode] = useState("");
  const [taxType, setTaxType] = useState("");
  const [gstOverride, setGstOverride] = useState(""); // normal-mode GST override (blank = auto)
  const [itemise, setItemise] = useState(false);
  const [lines, setLines] = useState<ExpenseLine[]>([]);
  const [lineTotalsState, setLineTotalsState] = useState<ExpenseTotals>({ subtotal: 0, gst: 0, total: 0 });
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        // The routes return { accounts: [...] } / { taxRates: [...] }. Guard
        // against any shape so we never set a non-array (which would crash .map).
        setAccounts(Array.isArray(accs) ? accs : accs?.accounts ?? []);
        const taxList: XeroTaxRate[] = Array.isArray(taxes) ? taxes : taxes?.taxRates ?? [];
        setTaxRates(taxList);
        // Default the tax rate to "GST on Expenses".
        const def = taxList.find((t) => /gst on expenses/i.test(t.name));
        if (def) setTaxType((prev) => prev || def.taxType);
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
    setAccountCode(""); setTaxType(""); setGstOverride(""); setFile(null); setSubmitError("");
    setItemise(false); setLines([]); setLineTotalsState({ subtotal: 0, gst: 0, total: 0 });
    setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
  };

  // Set the receipt file and an object-URL preview (images and PDFs both render).
  const selectFile = (f: File | null) => {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return f ? URL.createObjectURL(f) : null;
    });
    setFile(f);
  };

  const closeModal = () => { resetForm(); setShowModal(false); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { setSubmitError("Please attach a receipt."); return; }
    if (!spentOn) { setSubmitError("Please choose the date."); return; }

    const fd = new FormData();
    fd.append("spent_on", spentOn);
    fd.append("spent_at", spentAt);
    fd.append("line_amount_type", "Inclusive");
    fd.append("file", file);

    if (itemise) {
      const err = validateExpenseLines(lines);
      if (err) { setSubmitError(err); return; }
      fd.append("line_items", JSON.stringify(lines));
    } else {
      const computed = evaluateAmount(amount);
      if (computed === null || computed <= 0) {
        setSubmitError("Enter a valid amount — you can type a sum like 12.50 + 8.30.");
        return;
      }
      if (!accountCode) { setSubmitError("Please select an account."); return; }
      const account = accounts.find((a) => a.code === accountCode);
      const tax = taxRates.find((t) => t.taxType === taxType);
      fd.append("amount", computed.toFixed(2));
      fd.append("description", description);
      fd.append("account_code", accountCode);
      fd.append("account_name", account?.name ?? "");
      fd.append("tax_type", taxType);
      fd.append("tax_rate_name", tax?.name ?? "");
      if (gstOverride.trim() !== "") fd.append("tax_amount", String(round2(Number(gstOverride) || 0)));
    }

    setSubmitting(true);
    setSubmitError("");
    try {
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
    if (!(await confirm({ title: "Delete this expense claim?", danger: true }))) return;
    await fetch(`/api/expenses/${claimId}`, { method: "DELETE" });
    fetchClaims();
  };

  const visible = showAll ? claims : claims.slice(0, 3);

  // GST breakdown for the NORMAL (single-line) form — the amount is treated as
  // tax-inclusive, so auto GST = amount × rate / (100 + rate) (e.g. 10% → ÷ 11).
  // A blank override means "use auto"; any value overrides it.
  const computedAmount = evaluateAmount(amount);
  const amt = computedAmount ?? 0;
  const selectedTax = taxRates.find((t) => t.taxType === taxType);
  const taxRate = selectedTax?.rate ?? 0;
  const autoGst = autoGstInclusive(amt, taxRate);
  const gstOverridden = gstOverride.trim() !== "";
  const gst = gstOverridden ? round2(Number(gstOverride) || 0) : autoGst;
  const subtotal = round2(amt - gst);
  const defaultTaxType = taxRates.find((t) => /gst on expenses/i.test(t.name))?.taxType ?? "";

  // The receipt is compulsory (web + mobile); Submit stays disabled until one is
  // attached and the rest of the claim is valid.
  const canSubmit =
    !submitting && !metaLoading && !metaError && !!file && !!spentOn &&
    (itemise
      ? lineTotalsState.total > 0
      : computedAmount !== null && computedAmount > 0 && !!accountCode && !!taxType && !!description.trim());

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[#50676E]" />
            <span className="font-semibold text-[#223149]">Expense Claims</span>
            {claims.length > 0 && isManager && (
              <span className="text-xs text-[#50676E]">{claims.length}</span>
            )}
          </div>
          {isOwnProfile && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-[#50676E] hover:text-[#223149] transition-colors"
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
          <p className="text-sm text-[#50676E] text-center py-4">
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
                      {claim.account_name && <span className="text-xs text-[#50676E]">{claim.account_name}</span>}
                    </div>
                    <p className="text-sm text-[#50676E] mt-0.5 truncate">{claim.description}</p>
                    <p className="text-xs text-[#50676E] mt-0.5">
                      {format(parseISO(claim.date), "d MMM yyyy")}
                      {claim.spent_at ? ` · ${claim.spent_at}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge status={claim.status} />
                    {isOwnProfile && claim.status === "submitted" && (
                      <button
                        onClick={() => setEditingClaim(claim)}
                        className="p-2 rounded-lg hover:bg-[#F8F6F4] text-[#50676E] hover:text-[#223149] transition-colors"
                        title="Edit claim"
                        aria-label="Edit claim"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {isOwnProfile && claim.status === "submitted" && (
                      <button
                        onClick={() => handleDelete(claim.id)}
                        className="p-2 rounded-lg hover:bg-red-50 text-[#50676E] hover:text-red-400 transition-colors"
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
                    className="inline-flex items-center gap-1 text-xs text-[#50676E] hover:text-[#223149] transition-colors"
                  >
                    <Paperclip className="w-3 h-3" /> View receipt
                  </a>
                )}

                {claim.reviewer_notes && (
                  <p className="text-xs text-[#50676E] italic bg-[#F8F6F4] px-3 py-2 rounded-lg">
                    {claim.reviewer_notes}
                  </p>
                )}
              </div>
            ))}

            {claims.length > 3 && (
              <button
                onClick={() => setShowAll((v) => !v)}
                className="flex items-center gap-1 text-xs text-[#50676E] hover:text-[#223149] transition-colors"
              >
                {showAll ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {showAll ? "Show less" : `Show all ${claims.length} claims`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* New Claim — full-screen two-panel form */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          {/* Top bar */}
          <header className="flex items-center justify-between gap-3 h-14 px-4 border-b border-[#ECE3DF] flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={closeModal} className="p-2 rounded-xl hover:bg-[#F8F6F4] transition-colors" aria-label="Close">
                <X className="w-5 h-5 text-[#50676E]" />
              </button>
              <h2 className="text-base md:text-lg font-bold text-[#223149] truncate">New expense claim</h2>
            </div>
            <button
              type="submit" form="expense-claim-form"
              disabled={!canSubmit}
              title={!file ? "Attach a receipt to submit" : undefined}
              className="px-5 py-2 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Submitting…" : "Submit"}
            </button>
          </header>

          {/* Body: receipt upload (left) + form (right) */}
          <div className="flex-1 min-h-0 overflow-y-auto md:overflow-hidden flex flex-col md:flex-row">
            {/* LEFT — receipt upload / preview */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); selectFile(e.dataTransfer.files?.[0] ?? null); }}
              className="order-2 md:order-1 md:w-1/2 md:h-full md:overflow-hidden border-t md:border-t-0 md:border-r border-[#ECE3DF] bg-[#F8F6F4] flex flex-col p-4 md:p-6 min-h-[50vh] md:min-h-0"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,application/pdf"
                className="hidden"
                onChange={(e) => selectFile(e.target.files?.[0] ?? null)}
              />
              {file && previewUrl ? (
                <div className="flex-1 min-h-0 flex flex-col gap-2">
                  {file.type.startsWith("image/") ? (
                    <div className="flex-1 min-h-0 flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={previewUrl} alt="Receipt preview" className="max-h-full max-w-full rounded-lg shadow-sm object-contain" />
                    </div>
                  ) : (
                    <iframe src={previewUrl} title="Receipt preview" className="flex-1 min-h-0 w-full rounded-lg shadow-sm bg-white" />
                  )}
                  <div className="flex-shrink-0 flex items-center justify-between gap-3">
                    <p className="text-xs text-[#50676E] truncate">{file.name}</p>
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="text-sm font-medium text-[#50676E] hover:text-[#223149] flex-shrink-0">Replace receipt</button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-14 h-14 mx-auto rounded-xl bg-white border border-[#ECE3DF] flex items-center justify-center mb-3">
                      <Receipt className="w-7 h-7 text-[#50676E]" />
                    </div>
                    <p className="font-semibold text-[#223149]">Upload a receipt</p>
                    <p className="text-sm text-[#50676E] mt-1">Drag &amp; drop here, or select your file manually</p>
                    <button
                      type="button" onClick={() => fileInputRef.current?.click()}
                      className="mt-4 inline-flex items-center gap-2 px-4 py-2 border border-[#ECE3DF] bg-white text-[#223149] rounded-lg text-sm font-semibold hover:bg-white/60 transition-colors"
                    >
                      <Upload className="w-4 h-4" /> Upload
                    </button>
                    <p className="text-xs text-[#50676E] mt-3">PNG, JPG or PDF · required</p>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT — form fields */}
            <form id="expense-claim-form" onSubmit={handleSubmit} className="order-1 md:order-2 md:w-1/2 md:h-full md:overflow-y-auto p-6 space-y-5">
              {/* Spent on + Spent at — apply to the whole receipt */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="spent-on" className="block text-sm font-semibold text-[#223149] mb-1.5">Spent on</label>
                  <input id="spent-on"
                    type="date" required value={spentOn}
                    onChange={(e) => setSpentOn(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
                  />
                </div>
                <div>
                  <label htmlFor="spent-at" className="block text-sm font-semibold text-[#223149] mb-1.5">Spent at <span className="text-[#50676E] font-normal">(optional)</span></label>
                  <input id="spent-at"
                    type="text" value={spentAt}
                    onChange={(e) => setSpentAt(e.target.value)} placeholder="Where?"
                    className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#6E8189] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
                  />
                </div>
              </div>

              {/* Itemise toggle */}
              <div className="flex items-center justify-between border-t border-[#ECE3DF] pt-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#223149]">Itemise this claim</p>
                  <p className="text-xs text-[#50676E] mt-0.5">Split the receipt into lines, each with its own account.</p>
                </div>
                <button
                  type="button" role="switch" aria-checked={itemise}
                  onClick={() => setItemise((v) => !v)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${itemise ? "bg-[#223149]" : "bg-[#ECE3DF]"}`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${itemise ? "translate-x-[22px]" : "translate-x-0.5"}`} />
                </button>
              </div>

              {metaError ? (
                <p className="text-sm text-red-500">{metaError}</p>
              ) : itemise ? (
                /* Itemised: one line per claimed item */
                <LineItemsEditor
                  accounts={accounts}
                  taxRates={taxRates}
                  loading={metaLoading}
                  defaultTaxType={defaultTaxType}
                  onChange={(ls, t) => { setLines(ls); setLineTotalsState(t); }}
                />
              ) : (
                /* Normal: single amount / description / account / tax */
                <>
                  {/* Purchase amount */}
                  <div>
                    <label htmlFor="purchase-amount" className="block text-sm font-semibold text-[#223149] mb-1.5">Purchase amount</label>
                    <div className="flex items-stretch">
                      <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-[#ECE3DF] bg-[#F8F6F4] text-sm text-[#50676E] font-medium">AUD</span>
                      <input id="purchase-amount"
                        type="text" inputMode="text" required value={amount}
                        onChange={(e) => setAmount(e.target.value)} placeholder="0.00  or  12.50 + 8.30"
                        className="flex-1 min-w-0 px-4 py-2.5 rounded-r-xl border border-[#ECE3DF] text-[#223149] text-right placeholder:text-[#6E8189] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
                      />
                    </div>
                    {looksLikeExpression(amount) ? (
                      computedAmount !== null ? (
                        <p className="text-xs text-[#50676E] mt-1.5 text-right font-medium">= AUD {computedAmount.toFixed(2)}</p>
                      ) : (
                        <p className="text-xs text-amber-600 mt-1.5 text-right">Can&apos;t calculate that — use numbers with + - * / and ( )</p>
                      )
                    ) : (
                      <p className="text-xs text-[#50676E] mt-1.5">Tip: type a sum like 12.50 + 8.30 — it adds up for you.</p>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <label htmlFor="description" className="block text-sm font-semibold text-[#223149] mb-1.5">Description</label>
                    <textarea id="description"
                      required rows={2} value={description}
                      onChange={(e) => setDescription(e.target.value)} placeholder="What was it for?"
                      className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#6E8189] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors resize-none"
                    />
                  </div>

                  {/* Account */}
                  <div>
                    <label className="block text-sm font-semibold text-[#223149] mb-1.5">Account</label>
                    <AccountSelect accounts={accounts} value={accountCode} onChange={setAccountCode} loading={metaLoading} />
                  </div>

                  {/* Tax rate + GST (auto, editable override) */}
                  <div className="border-t border-[#ECE3DF] pt-4 space-y-3">
                    <div>
                      <label htmlFor="tax-rate" className="block text-sm font-semibold text-[#223149] mb-1.5">Tax rate</label>
                      <select id="tax-rate"
                        required value={taxType} disabled={metaLoading}
                        onChange={(e) => setTaxType(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors bg-white disabled:opacity-50"
                      >
                        <option value="">{metaLoading ? "Loading…" : "Select tax rate…"}</option>
                        {taxRates.map((t) => <option key={t.taxType} value={t.taxType}>{t.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex items-center justify-between text-[#50676E]">
                        <span>Subtotal (excl. GST)</span>
                        <span>AUD {subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-[#50676E]">
                        <span>{selectedTax ? `${selectedTax.name} (${Math.round(taxRate * 100) / 100}%)` : "GST"}</span>
                        <div className="flex items-center gap-2">
                          <div className="flex items-stretch">
                            <span className="inline-flex items-center px-2 rounded-l-lg border border-r-0 border-[#ECE3DF] bg-[#F8F6F4] text-xs">$</span>
                            <input
                              type="text" inputMode="decimal" value={gstOverride}
                              onChange={(e) => setGstOverride(e.target.value)} placeholder={autoGst.toFixed(2)}
                              className="w-24 px-2 py-1.5 rounded-r-lg border border-[#ECE3DF] text-[#223149] text-right placeholder:text-[#6E8189] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
                            />
                          </div>
                          {gstOverridden ? (
                            <button type="button" onClick={() => setGstOverride("")} className="text-[11px] text-[#50676E] hover:text-[#223149] underline">auto</button>
                          ) : (
                            <span className="text-[11px] text-[#50676E] w-8">auto</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between font-bold text-[#223149] pt-1.5 border-t border-[#ECE3DF]">
                        <span>Total (incl. GST)</span>
                        <span>AUD {amt.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {submitError && <p className="text-sm text-red-500">{submitError}</p>}
            </form>
          </div>
        </div>
      )}

      {/* Edit own submitted claim */}
      {editingClaim && (
        <ExpenseEditModal
          claim={editingClaim}
          onClose={() => setEditingClaim(null)}
          onSaved={() => { setEditingClaim(null); fetchClaims(); }}
        />
      )}
    </>
  );
}
