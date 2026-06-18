-- ============================================================
-- Migration: Persistent "roster" rows for contract generation (UP)
-- Run this in the Supabase SQL Editor BEFORE deploying the matching code.
--
-- What this does:
--   Adds `contract_draft_rows` — one row per employee on the Generate page,
--   per template. Previously the generate grid was throwaway client state;
--   this table makes it a persistent master roster that survives reloads and
--   accumulates everyone + their details.
--
--   Each row holds the editable recipient name + merge `values` (raw, so the
--   grid can re-edit them — e.g. dates as yyyy-mm-dd). When the row is
--   generated it links to the resulting `generated_contracts` row via
--   `generated_contract_id` and stamps `generated_at`. The displayed status is
--   DERIVED in code, not stored:
--     - no generated_contract_id          -> "draft"
--     - generated, in sync                 -> "generated" / "sent"
--     - updated_at > generated_at          -> "...changed" (edited since it was
--                                             generated — needs regenerating)
--   so we never have to keep a status column in sync by hand.
--
-- This migration is IDEMPOTENT: safe to re-run.
-- ============================================================

create table if not exists contract_draft_rows (
  id                    uuid primary key default gen_random_uuid(),
  template_id           uuid not null references contract_templates(id) on delete cascade,
  staff_id              uuid references staff(id) on delete set null,
  recipient_name        text not null default '',
  values                jsonb not null default '{}',     -- field -> raw value
  -- Generation linkage. Points at the latest filled copy for this row.
  generated_contract_id uuid references generated_contracts(id) on delete set null,
  generated_at          timestamptz,                     -- when last generated
  created_by            uuid references staff(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now() -- bumped on every edit
);

create index if not exists contract_draft_rows_template_id_idx
  on contract_draft_rows (template_id);

-- The app uses the service-role key (bypasses RLS) for all access, and
-- authorises in code. RLS is enabled with no policies so that, even if the
-- anon/publishable key ever reached this table, it would be denied by default.
alter table contract_draft_rows enable row level security;
