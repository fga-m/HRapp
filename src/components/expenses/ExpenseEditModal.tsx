"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

export interface EditableClaim {
  id: string;
  amount: number;
  description: string;
  spent_at?: string | null;
  date: string;
  account_code?: string | null;
  tax_type?: string | null;
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
  const [form, setForm] = useState({
    amount: claim.amount != null ? String(claim.amount) : "",
    description: claim.description ?? "",
    spent_at: claim.spent_at ?? "",
    spent_on: claim.date ?? "",
    account_code: claim.account_code ?? "",
    tax_type: claim.tax_type ?? "",
  });
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
        setTaxRates(Array.isArray(taxes) ? taxes : taxes?.taxRates ?? []);
      })
      .catch(async (r) => {
        const body = r?.json ? await r.json().catch(() => ({})) : {};
        setMetaError(body.error || "Couldn't load accounts from Xero.");
      })
      .finally(() => setMetaLoading(false));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const account = accounts.find((a) => a.code === form.account_code);
      const tax = taxRates.find((t) => t.taxType === form.tax_type);
      const res = await fetch(`/api/expenses/${claim.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE",
          fields: {
            amount: form.amount,
            description: form.description,
            spent_at: form.spent_at,
            spent_on: form.spent_on,
            account_code: form.account_code,
            account_name: account?.name ?? "",
            tax_type: form.tax_type,
            tax_rate_name: tax?.name ?? "",
          },
        }),
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#ECE3DF] sticky top-0 bg-white">
          <div>
            <h2 className="text-lg font-bold text-[#223149]">Edit claim</h2>
            {subtitle && <p className="text-xs text-[#9BADB7]">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-[#F8F6F4] transition-colors" aria-label="Close">
            <X className="w-5 h-5 text-[#5F7C84]" />
          </button>
        </div>
        <form onSubmit={save} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-[#223149] mb-1.5">Spent on</label>
              <input type="date" required value={form.spent_on}
                onChange={(e) => setForm({ ...form, spent_on: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#223149] mb-1.5">Amount (AUD)</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9BADB7] text-sm">$</span>
                <input type="number" required min="0.01" step="0.01" value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full pl-7 pr-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#223149] mb-1.5">Description</label>
            <textarea required rows={2} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors resize-none" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#223149] mb-1.5">Spent at <span className="text-[#9BADB7] font-normal">(optional)</span></label>
            <input type="text" value={form.spent_at}
              onChange={(e) => setForm({ ...form, spent_at: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors" />
          </div>

          {metaError ? (
            <p className="text-sm text-red-500">{metaError}</p>
          ) : (
            <>
              <div>
                <label className="block text-sm font-semibold text-[#223149] mb-1.5">Account</label>
                <select required value={form.account_code} disabled={metaLoading}
                  onChange={(e) => setForm({ ...form, account_code: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors bg-white disabled:opacity-50">
                  <option value="">{metaLoading ? "Loading…" : "Select account…"}</option>
                  {accounts.map((a) => <option key={a.code} value={a.code}>{a.code ? `${a.code} · ${a.name}` : a.name}</option>)}
                </select>
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
            </>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving || metaLoading || !!metaError}
              className="flex-1 px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50">
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 border border-[#ECE3DF] text-[#5F7C84] rounded-xl text-sm font-semibold hover:bg-[#F8F6F4] transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
