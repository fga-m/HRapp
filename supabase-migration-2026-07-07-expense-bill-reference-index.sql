-- Speeds up the per-year bill number allocation on expense approval, which
-- runs: SELECT bill_reference FROM expense_claims WHERE bill_reference LIKE
-- 'Expense Claims #YYYY-%'. text_pattern_ops makes the index usable for
-- LIKE prefix matches regardless of collation.
create index if not exists idx_expense_claims_bill_reference
  on expense_claims (bill_reference text_pattern_ops);
