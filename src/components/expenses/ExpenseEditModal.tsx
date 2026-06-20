"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import AccountSelect from "@/components/expenses/AccountSelect";
import LineItemsEditor from "@/components/expenses/LineItemsEditor";
import { evaluateAmount, looksLikeExpression } from "@/lib/calc";
import {
  autoGstInclusive,
  round2,
  validateExpenseLines,
  type ExpenseLine,
  type ExpenseTotals,
} from "@/lib/expense-lines";

export interface EditableClaim {
  id: string;
  amount: number;
  description: string;
  spent_at?: string | null;
  date: string;
  account_code?: string | null;
  tax_type?: string | null;
  tax_rate_name?: string | null;
  tax_amount?: number | null;
  line_items?: ExpenseLine[] | null;
  staff?: { full_name: string } | null;
}

interface XeroAccount { code: string; name: string; taxType: string }
interface XeroTaxRate { taxType: string; name: string; rate: number }

interface Props {
  claim: EditableClaim;
  /** Label under the title, e.g. the submitter's name (omitted for own claims). */
  subtitle?: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function ExpenseEditModal({ claim, subtitle, onClose, onSaved }: Props) {
  const startItemised = Array.isArray(claim.line_items) && claim.line_items.length > 0;
  const [itemise, setItemise] = useState(startItemised);
  const [form, setForm] = useState({
    amount: claim.amount != null ? String(claim.amount) : "",
    description: claim.description ?? "",
    spent_at: claim.spent_at ?? "",
    spent_on: claim.date ?? "",
    account_code: claim.account_code ?? "",
    tax_type: claim.tax_type ?? "",
    gstOverride: claim.tax_amount != null ? String(claim.tax_amount) : "",
  });
  const [lines, setLines] = useState<ExpenseLine[]>(startItemised ? (claim.line_items as ExpenseLine[]) : []);
  // Seed the total from the claim so Save isn't disabled before the editor emits.
  const initialItemTotal = startItemised
    ? (claim.line_items as ExpenseLine[]).reduce((s, l) => s + (Number(l.amount) || 0), 0)
    : 0;
  const [lineTotalsState, setLineTotalsState] = useState<ExpenseTotals>({ subtotal: 0, gst: 0, total: initialItemTotal });
  const [accounts, setAccounts] = useState<XeroAccount[]>([]);
  const [taxRates, setTaxRates] = useState<XeroTaxRate[]>([]);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setMetaLoading(true);
    setMetaError("");
    Promise.all([
      fetch("/api/xero/accounts").then((r) => (r.ok ? r.json() : Promise.reject(r))),
      fetch("/api/xero/tax-rates").then((r) => (r.ok ? r.json() : Promise.reject(r))),
    ])
      .then(([accs, taxes]) => {
        setAccounts(Array.isArray(accs) ? accs : accs?.accounts ?? []);
        const taxList: XeroTaxRate[] = Array.isArray(taxes) ? taxes : taxes?.taxRates ?? [];
        setTaxRates(taxList);
        // If the claim's current tax rate isn't one of the allowed ones, default to "GST on Expenses".
        setForm((f) => {
          if (taxList.some((t) => t.taxType === f.tax_type)) return f;
          const def = taxList.find((t) => /gst on expenses/i.test(t.name));
          return def ? { ...f, tax_type: def.taxType } : f;
        });
      })
      .catch(async (r) => {
        const body = r?.json ? await r.json().catch(() => ({})) : {};
        setMetaError(body.error || "Couldn't load accounts from Xero.");
      })
      .finally(() => setMetaLoading(false));
  }, []);

  const defaultTaxType = taxRates.find((t) => /gst on expenses/i.test(t.name))?.taxType ?? "";
  const amt = round2(evaluateAmount(form.amount) ?? 0);
  const selectedTax = taxRates.find((t) => t.taxType === form.tax_type);
  const autoGst = autoGstInclusive(amt, selectedTax?.rate ?? 0);
  const gstOverridden = form.gstOverride.trim() !== "";

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const fields: Record<string, unknown> = {
      spent_at: form.spent_at,
      spent_on: form.spent_on,
    };

    if (itemise) {
      const err = validateExpenseLines(lines);
      if (err) { setError(err); return; }
      fields.line_items = lines;
    } else {
      if (!form.account_code) { setError("Please select an account."); return; }
      const computed = evaluateAmount(form.amount);
      if (computed === null || computed <= 0) {
        setError("Enter a valid amount — you can type a sum like 12.50 + 8.30.");
        return;
      }
      const account = accounts.find((a) => a.code === form.account_code);
      const tax = taxRates.find((t) => t.taxType === form.tax_type);
      fields.line_items = null; // ensure we drop any previous itemisation
      fields.amount = computed.toFixed(2);
      fields.description = form.description;
      fields.account_code = form.account_code;
      fields.account_name = account?.name ?? "";
      fields.tax_type = form.tax_type;
      fields.tax_rate_name = tax?.name ?? "";
      fields.tax_amount = form.gstOverride.trim() === "" ? null : round2(Number(form.gstOverride) || 0);
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/expenses/${claim.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "UPDATE", fields }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "Failed to save changes");
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-xl w-full md:max-w-md max-h-[90vh] overflow-y-auto pb-safe">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#ECE3DF] sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-lg font-bold text-[#223149]">Edit claim</h2>
            {subtitle && <p className="text-xs text-[#50676E]">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-[#F8F6F4] transition-colors" aria-label="Close">
            <X className="w-5 h-5 text-[#50676E]" />
          </button>
        </div>
        <form onSubmit={save} className="p-6 space-y-4">
          {/* Whole-receipt fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-[#223149] mb-1.5">Spent on</label>
              <input type="date" required value={form.spent_on}
                onChange={(e) => setForm({ ...form, spent_on: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#223149] mb-1.5">Spent at <span className="text-[#50676E] font-normal">(optional)</span></label>
              <input type="text" value={form.spent_at}
                onChange={(e) => setForm({ ...form, spent_at: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors" />
            </div>
          </div>

          {/* Itemise toggle */}
          <div className="flex items-center justify-between border-t border-[#ECE3DF] pt-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#223149]">Itemise this claim</p>
              <p className="text-xs text-[#50676E] mt-0.5">Split into lines, each with its own account.</p>
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
            <LineItemsEditor
              accounts={accounts}
              taxRates={taxRates}
              loading={metaLoading}
              defaultTaxType={defaultTaxType}
              initialLines={startItemised ? (claim.line_items as ExpenseLine[]) : undefined}
              onChange={(ls, t) => { setLines(ls); setLineTotalsState(t); }}
            />
          ) : (
            <>
              <div>
                <label className="block text-sm font-semibold text-[#223149] mb-1.5">Amount (AUD)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#50676E] text-sm">$</span>
                  <input type="text" inputMode="text" required value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="0.00  or  12.50 + 8.30"
                    className="w-full pl-7 pr-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#6E8189] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors" />
                </div>
                {looksLikeExpression(form.amount) && (
                  evaluateAmount(form.amount) !== null ? (
                    <p className="text-xs text-[#50676E] mt-1 font-medium">= ${evaluateAmount(form.amount)!.toFixed(2)}</p>
                  ) : (
                    <p className="text-xs text-amber-600 mt-1">Can&apos;t calculate that</p>
                  )
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#223149] mb-1.5">Description</label>
                <textarea required rows={2} value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors resize-none" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#223149] mb-1.5">Account</label>
                <AccountSelect accounts={accounts} value={form.account_code} onChange={(code) => setForm({ ...form, account_code: code })} loading={metaLoading} />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#223149] mb-1.5">Tax rate</label>
                <select required value={form.tax_type} disabled={metaLoading}
                  onChange={(e) => setForm({ ...form, tax_type: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors bg-white disabled:opacity-50">
                  <option value="">{metaLoading ? "Loading…" : "Select tax rate…"}</option>
                  {taxRates.map((t) => <option key={t.taxType} value={t.taxType}>{t.name}</option>)}
                </select>
              </div>

              {/* GST (auto, editable override) */}
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-[#50676E]">GST{selectedTax ? ` (${Math.round((selectedTax.rate ?? 0) * 100) / 100}%)` : ""}</span>
                <div className="flex items-center gap-2">
                  <div className="flex items-stretch">
                    <span className="inline-flex items-center px-2 rounded-l-lg border border-r-0 border-[#ECE3DF] bg-[#F8F6F4] text-xs">$</span>
                    <input type="text" inputMode="decimal" value={form.gstOverride}
                      onChange={(e) => setForm({ ...form, gstOverride: e.target.value })} placeholder={autoGst.toFixed(2)}
                      className="w-24 px-2 py-1.5 rounded-r-lg border border-[#ECE3DF] text-[#223149] text-right placeholder:text-[#6E8189] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors" />
                  </div>
                  {gstOverridden ? (
                    <button type="button" onClick={() => setForm({ ...form, gstOverride: "" })} className="text-[11px] text-[#50676E] hover:text-[#223149] underline">auto</button>
                  ) : (
                    <span className="text-[11px] text-[#50676E] w-8">auto</span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between text-sm font-bold text-[#223149]">
                <span>Total (incl. GST)</span>
                <span>AUD {amt.toFixed(2)}</span>
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving || metaLoading || !!metaError || (itemise && lineTotalsState.total <= 0)}
              className="flex-1 px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50">
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 border border-[#ECE3DF] text-[#50676E] rounded-xl text-sm font-semibold hover:bg-[#F8F6F4] transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
