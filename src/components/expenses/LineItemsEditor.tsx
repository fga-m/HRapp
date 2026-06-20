"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import AccountSelect from "@/components/expenses/AccountSelect";
import { evaluateAmount, looksLikeExpression } from "@/lib/calc";
import {
  autoGstInclusive,
  lineTotals,
  round2,
  type ExpenseLine,
  type ExpenseTotals,
} from "@/lib/expense-lines";

interface XeroAccount { code: string; name: string; taxType: string }
interface XeroTaxRate { taxType: string; name: string; rate: number }

interface Props {
  accounts: XeroAccount[];
  taxRates: XeroTaxRate[];
  loading?: boolean;
  initialLines?: ExpenseLine[];
  defaultTaxType?: string;
  /** Emits the normalised lines + totals whenever anything changes. */
  onChange: (lines: ExpenseLine[], totals: ExpenseTotals) => void;
}

// Editor-local row: amount + GST are kept as raw text so the calculator works
// and the GST box can be left blank to mean "auto".
type Row = {
  key: string;
  description: string;
  amountText: string;
  account_code: string;
  tax_type: string;
  gstText: string;
};

let seq = 0;
const newKey = () => `l${seq++}`;

export default function LineItemsEditor({
  accounts,
  taxRates,
  loading,
  initialLines,
  defaultTaxType = "",
  onChange,
}: Props) {
  const [rows, setRows] = useState<Row[]>(() => {
    if (initialLines && initialLines.length > 0) {
      return initialLines.map((l) => ({
        key: newKey(),
        description: l.description,
        amountText: l.amount ? String(l.amount) : "",
        account_code: l.account_code,
        tax_type: l.tax_type,
        gstText: l.tax_amount != null ? String(l.tax_amount) : "",
      }));
    }
    return [{ key: newKey(), description: "", amountText: "", account_code: "", tax_type: defaultTaxType, gstText: "" }];
  });

  const rateFor = (taxType: string) => taxRates.find((t) => t.taxType === taxType)?.rate ?? 0;

  const toLines = (rs: Row[]): ExpenseLine[] =>
    rs.map((r) => {
      const acc = accounts.find((a) => a.code === r.account_code);
      const tax = taxRates.find((t) => t.taxType === r.tax_type);
      return {
        description: r.description.trim(),
        amount: round2(evaluateAmount(r.amountText) ?? 0),
        account_code: r.account_code,
        account_name: acc?.name ?? "",
        tax_type: r.tax_type,
        tax_rate_name: tax?.name ?? "",
        tax_amount: r.gstText.trim() === "" ? null : round2(Number(r.gstText)),
      };
    });

  // Commit new rows + bubble the result up in one go.
  const apply = (rs: Row[]) => {
    setRows(rs);
    const lines = toLines(rs);
    onChange(lines, lineTotals(lines, rateFor));
  };

  const update = (key: string, patch: Partial<Row>) =>
    apply(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const addRow = () =>
    apply([...rows, { key: newKey(), description: "", amountText: "", account_code: "", tax_type: defaultTaxType, gstText: "" }]);
  const removeRow = (key: string) => apply(rows.filter((r) => r.key !== key));

  const totals = lineTotals(toLines(rows), rateFor);

  return (
    <div className="space-y-3">
      {rows.map((r, i) => {
        const amt = round2(evaluateAmount(r.amountText) ?? 0);
        const auto = autoGstInclusive(amt, rateFor(r.tax_type));
        const overridden = r.gstText.trim() !== "";
        return (
          <div key={r.key} className="border border-[#ECE3DF] rounded-xl p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#50676E]">Item {i + 1}</span>
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(r.key)}
                  className="p-1.5 rounded-lg text-[#50676E] hover:bg-red-50 hover:text-red-500 transition-colors"
                  aria-label="Remove item"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Description */}
            <input
              type="text"
              value={r.description}
              onChange={(e) => update(r.key, { description: e.target.value })}
              placeholder="What's this item?"
              className="w-full px-3 py-2 rounded-lg border border-[#ECE3DF] text-sm text-[#223149] placeholder:text-[#6E8189] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
            />

            <div className="grid grid-cols-2 gap-2">
              {/* Amount (calculator) */}
              <div>
                <label htmlFor="amount-incl-gst" className="block text-xs font-medium text-[#50676E] mb-1">Amount (incl. GST)</label>
                <div className="flex items-stretch">
                  <span className="inline-flex items-center px-2 rounded-l-lg border border-r-0 border-[#ECE3DF] bg-[#F8F6F4] text-xs text-[#50676E]">$</span>
                  <input id="amount-incl-gst"
                    type="text"
                    inputMode="text"
                    value={r.amountText}
                    onChange={(e) => update(r.key, { amountText: e.target.value })}
                    placeholder="0.00"
                    className="flex-1 min-w-0 px-3 py-2 rounded-r-lg border border-[#ECE3DF] text-sm text-[#223149] text-right placeholder:text-[#6E8189] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
                  />
                </div>
                {looksLikeExpression(r.amountText) && (
                  <p className="text-[11px] text-[#50676E] mt-1 text-right">
                    {evaluateAmount(r.amountText) !== null ? `= $${amt.toFixed(2)}` : "Can't calculate that"}
                  </p>
                )}
              </div>

              {/* Tax rate */}
              <div>
                <label htmlFor="gst" className="block text-xs font-medium text-[#50676E] mb-1">GST</label>
                <select id="gst"
                  value={r.tax_type}
                  disabled={loading}
                  onChange={(e) => update(r.key, { tax_type: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#ECE3DF] text-sm text-[#223149] bg-white focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors disabled:opacity-50"
                >
                  <option value="">{loading ? "Loading…" : "Tax rate…"}</option>
                  {taxRates.map((t) => (
                    <option key={t.taxType} value={t.taxType}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Account */}
            <div>
              <label className="block text-xs font-medium text-[#50676E] mb-1">Account</label>
              <AccountSelect
                accounts={accounts}
                value={r.account_code}
                onChange={(code) => update(r.key, { account_code: code })}
                loading={loading}
              />
            </div>

            {/* GST amount: auto, with override */}
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="gst-amount" className="text-xs font-medium text-[#50676E]">GST amount</label>
              <div className="flex items-center gap-2">
                <div className="flex items-stretch">
                  <span className="inline-flex items-center px-2 rounded-l-lg border border-r-0 border-[#ECE3DF] bg-[#F8F6F4] text-xs text-[#50676E]">$</span>
                  <input id="gst-amount"
                    type="text"
                    inputMode="decimal"
                    value={r.gstText}
                    onChange={(e) => update(r.key, { gstText: e.target.value })}
                    placeholder={auto.toFixed(2)}
                    className="w-24 px-2 py-1.5 rounded-r-lg border border-[#ECE3DF] text-sm text-[#223149] text-right placeholder:text-[#6E8189] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
                  />
                </div>
                {overridden ? (
                  <button
                    type="button"
                    onClick={() => update(r.key, { gstText: "" })}
                    className="text-[11px] text-[#50676E] hover:text-[#223149] underline"
                  >
                    auto
                  </button>
                ) : (
                  <span className="text-[11px] text-[#50676E] w-8">auto</span>
                )}
              </div>
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-1.5 text-sm font-medium text-[#50676E] hover:text-[#223149] transition-colors"
      >
        <Plus className="w-4 h-4" /> Add item
      </button>

      {/* Totals */}
      <div className="space-y-1 text-sm border-t border-[#ECE3DF] pt-3">
        <div className="flex items-center justify-between text-[#50676E]">
          <span>Subtotal (excl. GST)</span>
          <span>AUD {totals.subtotal.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between text-[#50676E]">
          <span>GST</span>
          <span>AUD {totals.gst.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between font-bold text-[#223149] pt-1.5 border-t border-[#ECE3DF]">
          <span>Total (incl. GST)</span>
          <span>AUD {totals.total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
