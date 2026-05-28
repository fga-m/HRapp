"use client";

import { useEffect, useState } from "react";
import { Receipt, Clock, CheckCircle, XCircle, RefreshCw, AlertCircle, ChevronDown, ChevronUp, DollarSign } from "lucide-react";
import { format, parseISO } from "date-fns";

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

interface Props {
  isReviewer: boolean;
}

type FilterTab = "all" | "SUBMITTED" | "AUTHORISED" | "PAID";

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

function formatAUD(amount: number) {
  return amount.toLocaleString("en-AU", { style: "currency", currency: "AUD" });
}

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
      {/* Main row */}
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
            : <ChevronDown className="w-4 h-4 text-[#9BADB7]" />
          }
        </div>
      </button>

      {/* Expanded receipts */}
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

          {/* Payment summary */}
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

export default function ExpensesPageClient({ isReviewer }: Props) {
  const [claims, setClaims] = useState<XeroClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [xeroDown, setXeroDown] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterTab>("all");

  const fetchClaims = async (silent = false) => {
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
  };

  useEffect(() => { fetchClaims(); }, []);

  const filtered = claims.filter(c => filter === "all" || c.status === filter);

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "SUBMITTED", label: "Pending" },
    { key: "AUTHORISED", label: "Authorised" },
    { key: "PAID", label: "Paid" },
  ];

  // Summary totals
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
        <button
          onClick={() => fetchClaims(true)}
          disabled={refreshing}
          className="p-2 rounded-xl hover:bg-[#ECE3DF] transition-colors text-[#9BADB7] hover:text-[#223149]"
          title="Refresh from Xero"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

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
            <p className="text-xs text-[#9BADB7] mt-0.5">{pendingCount === 1 ? "claim" : "claims"} submitted in Xero</p>
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
                  {filter === "all" ? "No expense claims found in Xero." : `No ${tabs.find(t => t.key === filter)?.label.toLowerCase()} claims.`}
                </p>
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
          Expense claims are submitted and approved in Xero. This page reflects the latest data from Xero.
        </p>
      )}
    </div>
  );
}
