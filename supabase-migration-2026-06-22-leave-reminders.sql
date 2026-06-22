-- ============================================================
-- Migration: leave-request reminders (UP)
-- Run this in the Supabase SQL Editor.
--
-- Adds last_reminded_at so the app can rate-limit manual "Remind approver"
-- nudges and so the daily auto-reminder can avoid re-pinging the same request
-- too often.
--
-- IDEMPOTENT: safe to re-run.
-- ============================================================

alter table leave_requests add column if not exists last_reminded_at timestamptz;
