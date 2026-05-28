"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Receipt, Clock, CheckCircle, XCircle, RefreshCw, AlertCircle,
  ChevronDown, ChevronUp, DollarSign, Plus, Trash2, X,
} from "lucide-react";
import { format, parseISO } from "date-fns";

// ─── Types ───────────────────────────────────────────────────────────────────

interface LineItem {
  description: string;
  quantity: number;
  unitAmount: number;
  accountCode: string;
}

interface XeroReceipt {
  id: string;
  date: string | null;
  reference: string;
  total: number;
  lineItems: LineItem[];
}

interface XeroClaim {
  id: string;
  status: string;
  total: number;
  amountDue: number;
  amountPaid: number;
  reportingDate: string | null;
  user: { userId: string; email: string; firstName: string; lastName: string };
  receipts: XeroReceipt[];
}

interface XeroAccount {
  code: string;
  name: string;
  taxType: string;
}

interface Props {
  isReviewer: boolean;
}

type FilterTab = "all" | "SUBMITTED" | "AUTHORISED" | "PAID";

// ─── Xero AU tax type codes → human labels ───────────────────────────────────

const TAX_OPTIONS = [
  { label: "GST on Expenses (10%)", value: "INPUT2" },
  { label: "GST Free Expenses",     value: "EXEMPTEXPENSES" },
  { label: "BAS Excluded",          value: "BASEXCLUDED" },
];

// Map Xero account TaxType codes to our dropdown values
function inferTaxType(xeroTaxType: string): string {
  if (xeroTaxType === "INPUT2") return "INPUT2";
  if (xeroTaxType === "BASEXCLUDED") return "BASEXCLUDED";
  if (xeroTaxType === "EXEMPTEXPENSES" || xeroTaxType === "NONE") return "EXEMPTEXPENSES";
  return "INPUT2"; // sensible default
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatAUD(amount: number) {
  return amount.toLocaleString("en-AU", { style: "currency", currency: "AUD" });
}

function today() {
  return new Date().toISOString().split("T")[0];
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === "SUBMITTED") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-600 border border-amber-100">
      <Clock className="w-3 h-3" /> Pending
    </span>
  );
  if (status === "AUTHORISED") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600 border border-blue-100">
      <CheckCircle className="w-3 h-3" /> Authorised
    </span>
  );
  if (status === "PAID") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-600 border border-green-100">
      <DollarSign className="w-3 h-3" /> Paid
    </span>
  );
  return <span className="text-xs text-[#9BADB7]">{status}</span>;
}

// ─── ClaimCard ───────────────────────────────────────────────────────────────

function ClaimCard({ claim, isReviewer }: { claim: XeroClaim; isReviewer: boolean }) {
  const [expanded, setExpanded] = useState(false);

  const displayDate = claim.reportingDate ?? claim.receipts[0]?.date;
  const description = claim.receipts
    .flatMap(r => r.lineItems.map(l => l.description))
    .filter(Boolean)
    .slice(0, 2)
    .join(", ");

  return (
    <div className="border border-[#ECE3DF] rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-start justify-between gap-3 p-4 text-left hover:bg-[#F8F6F4] transition-colors"
      >
        <div className="min-w-0 flex-1">
          {isReviewer && (
            <p className="text-xs font-semibold text-[#223149] mb-0.5">
              {claim.user.firstName} {claim.user.lastName}
            </p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-bold text-[#223149]">{formatAUD(claim.total)}</span>
            {claim.receipts.length > 0 && (
              <span className="text-xs text-[#9BADB7]">
                {claim.receipts.length} {claim.receipts.length === 1 ? "receipt" : "receipts"}
              </span>
            )}
          </div>
          {description && (
            <p className="text-sm text-[#5F7C84] mt-0.5 truncate">{description}</p>
          )}
          {displayDate && (
            <p className="text-xs text-[#9BADB7] mt-0.5">
              {format(parseISO(displayDate), "d MMMM yyyy")}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusBadge status={claim.status} />
          {expanded
            ? <ChevronUp className="w-4 h-4 text-[#9BADB7]" />
            : <ChevronDown className="w-4 h-4 text-[#9BADB7]" />}
        </div>
      </button>

      {expanded && claim.receipts.length > 0 && (
        <div className="border-t border-[#ECE3DF] bg-[#F8F6F4] divide-y divide-[#ECE3DF]">
          {claim.receipts.map(receipt => (
            <div key={receipt.id} className="px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#223149]">
                  {receipt.date ? format(parseISO(receipt.date), "d MMM yyyy") : "—"}
                  {receipt.reference && ` · ${receipt.reference}`}
                </span>
                <span className="text-xs font-bold text-[#223149]">{formatAUD(receipt.total)}</span>
              </div>
              {receipt.lineItems.map((item, i) => (
                <div key={i} className="flex items-start justify-between gap-2 text-xs text-[#5F7C84]">
                  <span className="flex-1">{item.description || "—"}</span>
                  <span className="flex-shrink-0 tabular-nums">{formatAUD(item.unitAmount * item.quantity)}</span>
                </div>
              ))}
            </div>
          ))}

          {claim.status !== "SUBMITTED" && (
            <div className="px-4 py-3 flex items-center justify-between text-xs">
              <span className="text-[#9BADB7]">Amount paid</span>
              <span className="font-semibold text-[#223149]">{formatAUD(claim.amountPaid)}</span>
            </div>
          )}
          {claim.amountDue > 0 && (
            <div className="px-4 py-3 flex items-center justify-between text-xs">
              <span className="text-[#9BADB7]">Amount due</span>
              <span className="font-semibold text-amber-600">{formatAUD(claim.amountDue)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── New Claim Form ───────────────────────────────────────────────────────────

interface FormLineItem {
  description: string;
  accountCode: string;
  amount: string;
  taxType: string;
}

const emptyLineItem = (): FormLineItem => ({
  description: "",
  accountCode: "",
  amount: "",
  taxType: "INPUT2",
});

function NewClaimModal({
  onClose,
  onSubmitted,
}: {
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [date, setDate] = useState(today());
  const [merchant, setMerchant] = useState("");
  const [reference, setReference] = useState("");
  const [lineItems, setLineItems] = useState<FormLineItem[]>([emptyLineItem()]);
  const [accounts, setAccounts] = useState<XeroAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Fetch accounts on mount
  useEffect(() => {
    fetch("/api/xero/accounts")
      .then(r => r.json())
      .then(d => {
        if (d.accounts) setAccounts(d.accounts);
      })
      .finally(() => setAccountsLoading(false));
  }, []);

  const updateLineItem = (index: number, field: keyof FormLineItem, value: string) => {
    setLineItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };

      // Auto-set tax type when account changes
      if (field === "accountCode") {
        const account = accounts.find(a => a.code === value);
        if (account) {
          next[index].taxType = inferTaxType(account.taxType);
        }
      }
      return next;
    });
  };

  const addLineItem = () => setLineItems(prev => [...prev, emptyLineItem()]);

  const removeLineItem = (index: number) => {
    setLineItems(prev => prev.filter((_, i) => i !== index));
  };

  const claimTotal = lineItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

  const handleSubmit = async () => {
    setError("");

    if (!merchant.trim()) { setError("Please enter a merchant name."); return; }
    for (const item of lineItems) {
      if (!item.description.trim()) { setError("Please enter a description for each line item."); return; }
      if (!item.accountCode) { setError("Please select an account for each line item."); return; }
      const amt = parseFloat(item.amount);
      if (!amt || amt <= 0) { setError("Please enter a valid amount for each line item."); return; }
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/xero/expense-claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          merchant: merchant.trim(),
          reference: reference.trim() || undefined,
          lineItems: lineItems.map(item => ({
            description: item.description.trim(),
            accountCode: item.accountCode,
            amount: parseFloat(item.amount),
            taxType: item.taxType,
          })),
        }),
      });

      const d = await res.json();
      if (!res.ok || d.error) {
        setError(d.error ?? "Failed to submit claim. Please try again.");
        return;
      }

      onSubmitted();
    } catch {
      setError("Failed to submit claim. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="w-full sm:max-w-2xl bg-white sm:rounded-2xl shadow-2xl flex flex-col max-h-[95dvh]">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#ECE3DF] flex-shrink-0">
            <div>
              <h2 className="text-lg font-bold text-[#223149]">New Expense Claim</h2>
              <p className="text-xs text-[#9BADB7] mt-0.5">Submitted directly to Xero</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-[#F8F6F4] transition-colors">
              <X className="w-5 h-5 text-[#5F7C84]" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

            {/* Date + Merchant */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#223149] mb-1.5">Date <span className="text-red-400">*</span></label>
                <input
                  type="date"
                  value={date}
                  max={today()}
                  onChange={e => setDate(e.target.value)}
                  className="w-full border border-[#ECE3DF] rounded-xl px-3 py-2.5 text-sm text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#223149] mb-1.5">Merchant / Paid to <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={merchant}
                  onChange={e => setMerchant(e.target.value)}
                  placeholder="e.g. Woolworths"
                  className="w-full border border-[#ECE3DF] rounded-xl px-3 py-2.5 text-sm text-[#223149] placeholder:text-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149]"
                />
              </div>
            </div>

            {/* Reference */}
            <div>
              <label className="block text-xs font-semibold text-[#223149] mb-1.5">Reference <span className="text-[#9BADB7] font-normal">(optional)</span></label>
              <input
                type="text"
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="e.g. Receipt #1234"
                className="w-full border border-[#ECE3DF] rounded-xl px-3 py-2.5 text-sm text-[#223149] placeholder:text-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149]"
              />
            </div>

            {/* Line items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-[#223149]">Line Items <span className="text-red-400">*</span></label>
                {accountsLoading && (
                  <span className="text-xs text-[#9BADB7]">Loading accounts…</span>
                )}
              </div>

              <div className="space-y-3">
                {lineItems.map((item, index) => (
                  <div key={index} className="border border-[#ECE3DF] rounded-xl p-4 space-y-3 bg-[#F8F6F4]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#223149]">Item {index + 1}</span>
                      {lineItems.length > 1 && (
                        <button
                          onClick={() => removeLineItem(index)}
                          className="p-1 rounded-lg hover:bg-red-50 text-[#9BADB7] hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-xs text-[#5F7C84] mb-1">Description</label>
                      <input
                        type="text"
                        value={item.description}
                        onChange={e => updateLineItem(index, "description", e.target.value)}
                        placeholder="What was this expense for?"
                        className="w-full border border-[#ECE3DF] rounded-lg px-3 py-2 text-sm text-[#223149] placeholder:text-[#9BADB7] bg-white focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149]"
                      />
                    </div>

                    {/* Account + Amount row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-[#5F7C84] mb-1">Account</label>
                        <select
                          value={item.accountCode}
                          onChange={e => updateLineItem(index, "accountCode", e.target.value)}
                          disabled={accountsLoading}
                          className="w-full border border-[#ECE3DF] rounded-lg px-3 py-2 text-sm text-[#223149] bg-white focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] disabled:opacity-50"
                        >
                          <option value="">Select account…</option>
                          {accounts.map(a => (
                            <option key={a.code} value={a.code}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-[#5F7C84] mb-1">Amount (AUD incl. GST)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#9BADB7]">$</span>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={item.amount}
                            onChange={e => updateLineItem(index, "amount", e.target.value)}
                            placeholder="0.00"
                            className="w-full border border-[#ECE3DF] rounded-lg pl-7 pr-3 py-2 text-sm text-[#223149] placeholder:text-[#9BADB7] bg-white focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149]"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Tax type */}
                    <div>
                      <label className="block text-xs text-[#5F7C84] mb-1">Tax Type</label>
                      <select
                        value={item.taxType}
                        onChange={e => updateLineItem(index, "taxType", e.target.value)}
                        className="w-full border border-[#ECE3DF] rounded-lg px-3 py-2 text-sm text-[#223149] bg-white focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149]"
                      >
                        {TAX_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={addLineItem}
                className="mt-3 flex items-center gap-2 text-sm text-[#5F7C84] hover:text-[#223149] transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add another item
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p className="text-sm">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-[#ECE3DF] flex-shrink-0 bg-white">
            <div className="text-sm">
              <span className="text-[#9BADB7]">Total: </span>
              <span className="font-bold text-[#223149]">{formatAUD(claimTotal)}</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-[#5F7C84] hover:text-[#223149] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2 bg-[#223149] text-white text-sm font-semibold rounded-xl hover:bg-[#1a2638] transition-colors disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Submitting…
                  </>
                ) : (
                  <>
                    <Receipt className="w-4 h-4" />
                    Submit Claim
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ExpensesPageClient({ isReviewer }: Props) {
  const [claims, setClaims] = useState<XeroClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [xeroDown, setXeroDown] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [showNewClaim, setShowNewClaim] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const fetchClaims = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/xero/expense-claims");
      const d = await res.json();
      if (d.xeroDown) { setXeroDown(true); return; }
      if (d.error) { setError(d.error); return; }
      setClaims(d.claims ?? []);
    } catch {
      setError("Failed to load expense claims");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchClaims(); }, [fetchClaims]);

  const handleSubmitted = () => {
    setShowNewClaim(false);
    setSuccessMsg("Your claim has been submitted to Xero.");
    fetchClaims(true);
    setTimeout(() => setSuccessMsg(""), 5000);
  };

  const filtered = claims.filter(c => filter === "all" || c.status === filter);

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all",        label: "All" },
    { key: "SUBMITTED",  label: "Pending" },
    { key: "AUTHORISED", label: "Authorised" },
    { key: "PAID",       label: "Paid" },
  ];

  const pendingTotal = claims.filter(c => c.status === "SUBMITTED").reduce((s, c) => s + c.total, 0);
  const pendingCount = claims.filter(c => c.status === "SUBMITTED").length;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#223149]">Expense Claims</h1>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="flex items-center px-1.5 py-0.5 rounded-md bg-[#13B5EA]/10 text-[#13B5EA] text-[10px] font-semibold">
              Xero
            </span>
            <span className="text-sm text-[#9BADB7]">
              {isReviewer ? "All staff expense claims from Xero." : "Your expense claims from Xero."}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchClaims(true)}
            disabled={refreshing}
            className="p-2 rounded-xl hover:bg-[#ECE3DF] transition-colors text-[#9BADB7] hover:text-[#223149]"
            title="Refresh from Xero"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          {!xeroDown && (
            <button
              onClick={() => setShowNewClaim(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#223149] text-white text-sm font-semibold rounded-xl hover:bg-[#1a2638] transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Claim
            </button>
          )}
        </div>
      </div>

      {/* Success message */}
      {successMsg && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-100 rounded-xl text-green-700">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{successMsg}</p>
        </div>
      )}

      {/* Xero not connected */}
      {xeroDown && (
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center space-y-3">
          <Receipt className="w-8 h-8 text-[#9BADB7] mx-auto" />
          <p className="font-semibold text-[#223149]">Xero not connected</p>
          <p className="text-sm text-[#9BADB7]">
            An admin needs to reconnect Xero in Settings to view expense claims.
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Could not load expense claims</p>
            <p className="text-xs mt-0.5 opacity-75">{error}</p>
          </div>
        </div>
      )}

      {/* Summary cards — reviewer only */}
      {isReviewer && !loading && pendingCount > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <p className="text-xs text-[#9BADB7] font-medium">Pending Review</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{pendingCount}</p>
            <p className="text-xs text-[#9BADB7] mt-0.5">{pendingCount === 1 ? "claim" : "claims"} awaiting authorisation</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <p className="text-xs text-[#9BADB7] font-medium">Total Pending</p>
            <p className="text-2xl font-bold text-[#223149] mt-1">{formatAUD(pendingTotal)}</p>
            <p className="text-xs text-[#9BADB7] mt-0.5">awaiting authorisation</p>
          </div>
        </div>
      )}

      {/* Claims list */}
      {!xeroDown && !error && (
        <div className="bg-white rounded-2xl shadow-sm">
          {/* Filter tabs */}
          <div className="flex border-b border-[#ECE3DF] px-2 pt-2">
            {tabs.map(tab => {
              const count = tab.key === "all" ? claims.length : claims.filter(c => c.status === tab.key).length;
              return (
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
                  {count > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                      filter === tab.key ? "bg-[#223149] text-white" : "bg-[#F8F6F4] text-[#9BADB7]"
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
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
                  {filter === "all"
                    ? "No expense claims found."
                    : `No ${tabs.find(t => t.key === filter)?.label.toLowerCase()} claims.`}
                </p>
                {filter === "all" && !isReviewer && (
                  <button
                    onClick={() => setShowNewClaim(true)}
                    className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-[#223149] text-white text-sm font-semibold rounded-xl hover:bg-[#1a2638] transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Submit your first claim
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(claim => (
                  <ClaimCard key={claim.id} claim={claim} isReviewer={isReviewer} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {!xeroDown && !error && !loading && (
        <p className="text-xs text-center text-[#9BADB7]">
          Claims submitted here go directly to Xero. Authorisation happens in Xero.
        </p>
      )}

      {/* New claim modal */}
      {showNewClaim && (
        <NewClaimModal
          onClose={() => setShowNewClaim(false)}
          onSubmitted={handleSubmitted}
        />
      )}
    </div>
  );
}
