-- ============================================================
-- Migration: New-staff account provisioning (UP)
-- Run this in the Supabase SQL Editor BEFORE deploying the matching code.
--
-- Adds the canonical staff fields the HR app needs to be the single source of
-- truth when provisioning a new starter's Google Workspace account and Xero
-- payroll employee (and to fill contracts) — so a name/address is only ever
-- typed once. Also adds:
--   * google_workspace_connection — a SINGLE org-level Google connection used
--     to create Workspace accounts via the Admin SDK Directory API. Mirrors
--     contracts_google_connection / xero_connection: one dedicated SUPER-ADMIN
--     account authorises once, every app-admin provisions through it.
--   * staff_provisioning_log — an audit trail of every provisioning attempt.
--
-- Notes
--   * staff.xero_employee_id already exists (used to link a staff member to
--     their Xero Payroll record) — provisioning simply populates it with the
--     newly created employee, so nothing to add there.
--   * This migration is IDEMPOTENT: safe to re-run.
-- ============================================================

-- 1. Canonical staff fields ----------------------------------------------------
alter table staff add column if not exists first_name      text;
alter table staff add column if not exists last_name       text;
alter table staff add column if not exists recovery_email  text;   -- personal email (Google recovery + welcome delivery)
alter table staff add column if not exists mobile_phone    text;
alter table staff add column if not exists address_line1   text;
alter table staff add column if not exists address_line2   text;
alter table staff add column if not exists suburb          text;   -- City / suburb
alter table staff add column if not exists state           text;   -- AU state/region (e.g. VIC)
alter table staff add column if not exists postcode        text;
alter table staff add column if not exists country         text default 'AU';
alter table staff add column if not exists start_date      date;

-- Provisioning bookkeeping (xero_employee_id already exists).
alter table staff add column if not exists google_account_created_at timestamptz; -- set when the Workspace account is created via this app

-- Best-effort backfill of first/last name from the existing full_name so
-- existing rows aren't blank. Splits on the FIRST space: first token ->
-- first_name, the remainder -> last_name. Admins can correct any edge cases
-- (e.g. multi-part given names) in the staff editor. Only touches rows where
-- the new columns are still null.
update staff
   set first_name = coalesce(first_name, nullif(split_part(full_name, ' ', 1), '')),
       last_name  = coalesce(
                      last_name,
                      nullif(trim(substring(full_name from position(' ' in full_name) + 1)), '')
                    )
 where full_name is not null
   and (first_name is null or last_name is null);

-- 2. Google Workspace (Admin SDK) connection ----------------------------------
-- Single org-level connection, separate from contracts_google_connection
-- because creating accounts needs the admin.directory.user scope and a
-- super-admin account (the contracts account only has Drive/Docs scopes).
create table if not exists google_workspace_connection (
  id              uuid primary key default gen_random_uuid(),
  access_token    text not null,
  refresh_token   text not null,
  expires_at      timestamptz not null,
  connected_email text,
  connected_by    uuid references staff(id),
  connected_at    timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table google_workspace_connection enable row level security;
-- RLS on with no policies: the anon/publishable key is denied by default; the
-- app reads this table only with the service-role key. (Mirrors the other
-- connection tables.)

-- 3. Provisioning audit log ----------------------------------------------------
create table if not exists staff_provisioning_log (
  id          uuid primary key default gen_random_uuid(),
  staff_id    uuid references staff(id) on delete cascade,
  service     text not null check (service in ('google', 'xero')),
  status      text not null check (status in ('success', 'skipped', 'error')),
  detail      text,                       -- human-readable message / error
  external_id text,                       -- Google primaryEmail or Xero EmployeeID
  created_by  uuid references staff(id),
  created_at  timestamptz not null default now()
);
create index if not exists idx_staff_provisioning_log_staff_id on staff_provisioning_log (staff_id);

alter table staff_provisioning_log enable row level security;
