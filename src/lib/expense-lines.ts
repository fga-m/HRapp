// Shared model + math for itemised expense claims. Server- and client-safe
// (no imports), so the create/edit forms, the approver view and the API routes
// all agree on how a claim's lines add up and what counts as valid.

export type ExpenseLine = {
  description: string;
  amount: number; // GST-inclusive line total
  account_code: string;
  account_name: string;
  tax_type: string;
  tax_rate_name: string;
  // Manual GST override for this line; null means "auto-calculate from the rate".
  tax_amount: number | null;
};

export type ExpenseTotals = { subtotal: number; gst: number; total: number };

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** GST component of a GST-inclusive amount at the given rate (e.g. 10 → amount/11). */
export function autoGstInclusive(amount: number, ratePercent: number): number {
  if (!(amount > 0) || !(ratePercent > 0)) return 0;
  return round2(amount - amount / (1 + ratePercent / 100));
}

/** The GST for a line: the manual override if set, else auto from the rate. */
export function lineGst(line: Pick<ExpenseLine, "amount" | "tax_amount">, ratePercent: number): number {
  if (line.tax_amount != null) return round2(line.tax_amount);
  return autoGstInclusive(line.amount || 0, ratePercent);
}

/** Sum a set of lines into subtotal / GST / total, given a rate lookup by tax type. */
export function lineTotals(
  lines: ExpenseLine[],
  rateFor: (taxType: string) => number
): ExpenseTotals {
  let total = 0;
  let gst = 0;
  for (const l of lines) {
    total += Number(l.amount) || 0;
    gst += lineGst(l, rateFor(l.tax_type));
  }
  total = round2(total);
  gst = round2(gst);
  return { subtotal: round2(total - gst), gst, total };
}

/** Validate an itemised claim's lines. Returns an error message, or null if ok. */
export function validateExpenseLines(lines: unknown): string | null {
  if (!Array.isArray(lines) || lines.length === 0) return "Add at least one line item.";
  for (const raw of lines) {
    const l = raw as Partial<ExpenseLine>;
    if (!l || typeof l !== "object") return "Line items are malformed.";
    if (!l.description || !String(l.description).trim()) return "Each line needs a description.";
    if (!(Number(l.amount) > 0)) return "Each line needs an amount greater than zero.";
    if (!l.account_code) return "Each line needs an account.";
    if (!l.tax_type) return "Each line needs a tax rate.";
    if (l.tax_amount != null) {
      const t = Number(l.tax_amount);
      if (isNaN(t) || t < 0) return "A GST override must be zero or more.";
      if (t > Number(l.amount)) return "A line's GST can't be more than its amount.";
    }
  }
  return null;
}

/** Normalise an arbitrary parsed line into a clean ExpenseLine for storage. */
export function normaliseLine(raw: Partial<ExpenseLine>): ExpenseLine {
  const taxAmount =
    raw.tax_amount === null || raw.tax_amount === undefined || raw.tax_amount === ("" as unknown)
      ? null
      : round2(Number(raw.tax_amount));
  return {
    description: String(raw.description ?? "").trim(),
    amount: round2(Number(raw.amount) || 0),
    account_code: String(raw.account_code ?? ""),
    account_name: String(raw.account_name ?? ""),
    tax_type: String(raw.tax_type ?? ""),
    tax_rate_name: String(raw.tax_rate_name ?? ""),
    tax_amount: taxAmount,
  };
}
