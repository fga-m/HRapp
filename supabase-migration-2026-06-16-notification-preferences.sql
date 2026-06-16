-- ============================================================
-- Migration: Per-user notification preferences (UP)
-- Run this in the Supabase SQL Editor BEFORE deploying the matching code.
--
-- What this does:
--   Creates `notification_preferences`, one row per staff member recording
--   which notification *topics* they have muted. The app uses this to decide
--   whether to fire a Web Push for a given notification — the in-app
--   notification row is ALWAYS created regardless, so muting only stops the
--   device alert, never the record.
--
-- Model is opt-OUT: the ABSENCE of a row (or an empty array) means every topic
-- is on, which matches the behaviour every existing user has today. A topic is
-- muted by adding its key (e.g. 'expense', 'meeting') to `disabled_categories`.
-- Compliance-critical topics ('policy', 'contract', 'leave') are enforced
-- always-on in code and are never stored here.
--
-- This migration is IDEMPOTENT: safe to re-run.
-- ============================================================

create table if not exists notification_preferences (
  staff_id            uuid primary key references staff(id) on delete cascade,
  disabled_categories text[] not null default '{}',   -- muted topic keys
  updated_at          timestamptz not null default now()
);

-- The app uses the service-role key (bypasses RLS) for all access, and
-- authorises in code. RLS is enabled with no policies so that, even if the
-- anon/publishable key ever reached this table, it would be denied by default.
alter table notification_preferences enable row level security;
