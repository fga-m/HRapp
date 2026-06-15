-- ============================================================
-- Migration: Expense Claims + Xero integration (DOWN / removal)
-- Run this in the Supabase SQL Editor to revert the matching UP migration
-- (supabase-migration-2026-06-10-expense-claims-xero.sql).
--
-- This drops all new columns, the canonical status CHECK, and reverts the
-- status backfill ('submitted' -> 'pending') so the table returns to its
-- pre-migration shape. It does NOT touch the "receipts" Storage bucket nor
-- the `role_permissions` table (both pre-exist / are managed elsewhere).
--
-- This migration is IDEMPOTENT: drops use `if exists` and the status revert
-- is a safe best-effort restore of the legacy value.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Drop the canonical status CHECK so 'pending' can be restored.
-- ------------------------------------------------------------
alter table expense_claims drop constraint if exists expense_claims_status_check;

-- Revert the backfill: 'submitted' -> 'pending' (legacy value).
-- NOTE: rows that genuinely reached 'submitted' under the new system are
-- mapped back to the single legacy 'pending' value the old code understood.
update expense_claims set status = 'pending' where status = 'submitted';

-- ------------------------------------------------------------
-- 2. Drop new expense_claims columns + indexes.
-- ------------------------------------------------------------
drop index if exists idx_expense_claims_status;
drop index if exists idx_expense_claims_staff_id;

alter table expense_claims drop column if exists xero_total;
alter table expense_claims drop column if exists xero_error;
alter table expense_claims drop column if exists xero_pushed_at;
alter table expense_claims drop column if exists xero_contact_id;
alter table expense_claims drop column if exists xero_invoice_id;
alter table expense_claims drop column if exists line_items;
alter table expense_claims drop column if exists receipt_mime;
alter table expense_claims drop column if exists receipt_path;
alter table expense_claims drop column if exists line_amount_type;
alter table expense_claims drop column if exists tax_rate_name;
alter table expense_claims drop column if exists tax_type;
alter table expense_claims drop column if exists account_name;
alter table expense_claims drop column if exists account_code;
alter table expense_claims drop column if exists spent_at;
alter table expense_claims drop column if exists currency;

-- ------------------------------------------------------------
-- 3. Drop new staff column.
-- ------------------------------------------------------------
alter table staff drop column if exists xero_contact_id;

-- NOTE: the original staff.role CHECK constraint (if any) is NOT re-created
-- here. The UP migration deliberately removed role constraints to avoid
-- migration aborts against the live role set; re-adding a guessed CHECK would
-- be just as risky. Re-create it manually only if you know the exact value set.
