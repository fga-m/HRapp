-- ============================================================
-- Migration: app-owned Gmail-send connection (UP)
-- Run this in the Supabase SQL Editor.
--
-- Stores a SINGLE org-level Google connection used to SEND transactional email
-- (e.g. leave-decline notifications) via the Gmail API, from a dedicated
-- @fgam.org.au account (e.g. hrapp@fgam.org.au). Mirrors
-- google_workspace_connection / contracts_google_connection: one account
-- authorises once with the gmail.send scope, and the app sends through it.
--
-- IDEMPOTENT: safe to re-run.
-- ============================================================

create table if not exists google_mail_connection (
  id              uuid primary key default gen_random_uuid(),
  access_token    text not null,
  refresh_token   text not null,
  expires_at      timestamptz not null,
  connected_email text,
  connected_by    uuid references staff(id),
  connected_at    timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table google_mail_connection enable row level security;
-- RLS on with no policies: anon/publishable key denied by default; the app
-- reads this table only with the service-role key. (Mirrors the other
-- connection tables.)
