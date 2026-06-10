-- ============================================================
-- Migration: Expense Claims + Xero integration (UP)
-- Run this in the Supabase SQL Editor BEFORE deploying the matching code.
--
-- What this does:
--   1. Extends the existing `expense_claims` table with Xero-related and
--      richer claim columns (currency, location, account/tax metadata,
--      Supabase Storage receipt path, line items, Xero bill linkage).
--   2. Backfills the legacy status 'pending' -> 'submitted', then adds a
--      CHECK constraint pinning status to the 5 canonical values.
--   3. Adds `staff.xero_contact_id` so each staff member maps to their own
--      Xero contact (bills are payable to the staff member's own contact).
--
-- This migration is IDEMPOTENT: every column is added via
-- `add column if not exists`, constraints are dropped before being
-- (re)created, and the backfill is a no-op once it has run.
--
-- NOTE on Storage: receipts live in a PRIVATE Supabase Storage bucket named
-- "receipts" that must be created MANUALLY in the dashboard. The application
-- code handles a missing bucket with a clear error; nothing here creates it.
--
-- NOTE on the `role_permissions` table: the "approve_expenses" approver
-- feature flag uses the existing `role_permissions` table (role, feature,
-- enabled) which already exists in the live DB. No DDL for it is needed here.
-- ============================================================

-- ------------------------------------------------------------
-- 1. expense_claims: new columns (all nullable / defaulted; safe to re-run)
-- ------------------------------------------------------------
alter table expense_claims add column if not exists currency text default 'AUD';
alter table expense_claims add column if not exists spent_at text;              -- location where the spend occurred
alter table expense_claims add column if not exists account_code text;          -- Xero expense account code
alter table expense_claims add column if not exists account_name text;          -- Xero expense account name (denormalised)
alter table expense_claims add column if not exists tax_type text;              -- Xero TaxType code (e.g. INPUT)
alter table expense_claims add column if not exists tax_rate_name text;         -- Xero tax rate display name (denormalised)
alter table expense_claims add column if not exists line_amount_type text default 'Inclusive'; -- 'Inclusive' | 'Exclusive' | 'NoTax'
alter table expense_claims add column if not exists receipt_path text;          -- Supabase Storage object path in the "receipts" bucket
alter table expense_claims add column if not exists receipt_mime text;          -- receipt content type
alter table expense_claims add column if not exists line_items jsonb;           -- reserved for future itemisation (single line item in v1)
alter table expense_claims add column if not exists xero_invoice_id text;       -- Xero ACCPAY InvoiceID once pushed
alter table expense_claims add column if not exists xero_contact_id text;       -- Xero ContactID the bill was raised against
alter table expense_claims add column if not exists xero_pushed_at timestamptz; -- when the bill was successfully created in Xero
alter table expense_claims add column if not exists xero_error text;            -- last Xero push/attachment error message
alter table expense_claims add column if not exists xero_total numeric;         -- total returned by Xero (sanity-checked against amount)

-- The legacy `category` column stays NULLABLE (no longer required on submit).
-- Defensively drop NOT NULL if a prior schema applied one.
alter table expense_claims alter column category drop not null;

-- ------------------------------------------------------------
-- 2. status backfill + canonical CHECK
--    Canonical set: 'submitted','approved','rejected','pushed','push_failed'
--    ('pending' is the legacy value; 'draft' is reserved/unused in v1)
-- ------------------------------------------------------------

-- Drop any pre-existing status CHECK so the legacy values don't block the
-- backfill and re-running this migration is safe. We discover the constraint
-- name dynamically because it may have been auto-generated.
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where rel.relname = 'expense_claims'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%status%'
  loop
    execute format('alter table expense_claims drop constraint %I', c.conname);
  end loop;
end $$;

-- Backfill legacy 'pending' -> 'submitted' BEFORE adding the new CHECK.
update expense_claims set status = 'submitted' where status = 'pending';

-- Add the canonical 5-value CHECK (named so the DOWN migration can drop it).
alter table expense_claims
  add constraint expense_claims_status_check
  check (status in ('submitted', 'approved', 'rejected', 'pushed', 'push_failed'));

-- ------------------------------------------------------------
-- 3. staff.xero_contact_id
-- ------------------------------------------------------------
alter table staff add column if not exists xero_contact_id text; -- staff member's own Xero contact

-- ------------------------------------------------------------
-- 4. staff.role CHECK: do NOT constrain.
--    We intentionally do NOT assume the live role set (admin/manager/staff/
--    finance all appear in application code, and approver designation is via
--    the `role_permissions` feature flag, not staff.role). Adding a CHECK here
--    risks aborting the migration if a live row holds a role not in our list.
--    So we DROP any existing staff role CHECK and add NONE.
-- ------------------------------------------------------------
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where rel.relname = 'staff'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%role%'
  loop
    execute format('alter table staff drop constraint %I', c.conname);
  end loop;
end $$;

-- ------------------------------------------------------------
-- 5. Helpful indexes (idempotent)
-- ------------------------------------------------------------
create index if not exists idx_expense_claims_status on expense_claims (status);
create index if not exists idx_expense_claims_staff_id on expense_claims (staff_id);
