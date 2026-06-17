-- ============================================================
-- Migration: Contract generation from Google Docs templates (UP)
-- Run this in the Supabase SQL Editor BEFORE deploying the matching code.
--
-- What this does:
--   Adds two tables that power "mail merge" contract generation:
--
--   `contract_templates`  — a registered Google Doc that contains
--     {{placeholder}} merge fields. Admins register one per contract type
--     (e.g. full-time, casual). `fields` caches the placeholder names detected
--     in the Doc so the generate UI can build its grid without re-reading the
--     Doc every time.
--
--   `generated_contracts` — one row per employee in a generation batch. Each
--     row points at the filled Google Doc copy (kept in Drive so admins can
--     tweak wording) and the values that were merged in. When a row is pushed
--     into the e-sign flow, `contract_id` links to the resulting `contracts`
--     row.
--
-- This migration is IDEMPOTENT: safe to re-run.
-- ============================================================

create table if not exists contract_templates (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  google_doc_id  text not null,
  google_doc_url text,
  fields         text[] not null default '{}',   -- cached {{placeholder}} names
  created_by     uuid references staff(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists generated_contracts (
  id             uuid primary key default gen_random_uuid(),
  template_id    uuid references contract_templates(id) on delete set null,
  batch_id       uuid not null,                  -- groups one "generate" run
  batch_label    text,
  staff_id       uuid references staff(id) on delete set null,
  recipient_name text not null,
  google_doc_id  text not null,                  -- the filled copy
  google_doc_url text,
  values         jsonb not null default '{}',    -- field -> merged value
  contract_id    uuid references contracts(id) on delete set null, -- set once sent to e-sign
  created_by     uuid references staff(id),
  created_at     timestamptz not null default now()
);

create index if not exists generated_contracts_batch_id_idx
  on generated_contracts (batch_id);
create index if not exists generated_contracts_template_id_idx
  on generated_contracts (template_id);

-- The app uses the service-role key (bypasses RLS) for all access, and
-- authorises in code. RLS is enabled with no policies so that, even if the
-- anon/publishable key ever reached these tables, it would be denied by default.
alter table contract_templates enable row level security;
alter table generated_contracts enable row level security;
