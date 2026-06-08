-- ============================================================
-- Migration: generic app_settings key/value table
-- Run this in the Supabase SQL Editor before deploying the matching code.
--
-- First use: stores the TOIL rolling-window length (in weeks) so admins can
-- change it from the Team Schedule page without a redeploy.
-- ============================================================

create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz default now(),
  updated_by uuid references staff(id)
);

-- Seed the TOIL window with the current hardcoded default (4 weeks).
insert into app_settings (key, value)
values ('toil_window_weeks', '4')
on conflict (key) do nothing;
