-- ============================================================
-- Migration: App-owned Google connection for contract generation (UP)
-- Run this in the Supabase SQL Editor BEFORE deploying the matching code.
--
-- Stores a SINGLE org-level Google connection used for all contract-template
-- operations (reading the template, copying/filling it, exporting PDFs). This
-- mirrors `xero_connection`: one dedicated account (e.g. hr@fgam.org.au)
-- authorises once, and every admin generates through it — so the template
-- doesn't have to be shared with individual people, and app-admin role (not
-- Google sharing) governs who can generate.
--
-- Only one row is ever kept (the connect callback replaces it). The app reads
-- it with the service-role key; RLS is on with no policies so the anon key is
-- denied by default.
--
-- This migration is IDEMPOTENT: safe to re-run.
-- ============================================================

create table if not exists contracts_google_connection (
  id              uuid primary key default gen_random_uuid(),
  access_token    text not null,
  refresh_token   text not null,
  expires_at      timestamptz not null,
  connected_email text,
  connected_by    uuid references staff(id),
  connected_at    timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table contracts_google_connection enable row level security;
