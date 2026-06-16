-- ============================================================
-- Migration: Per-user notification preferences (DOWN / removal)
-- Run this in the Supabase SQL Editor to revert the matching UP migration
-- (supabase-migration-2026-06-16-notification-preferences.sql).
--
-- Dropping the table simply reverts the app to sending a push for every
-- notification (the pre-feature behaviour). No other tables are affected.
--
-- This migration is IDEMPOTENT: the drop uses `if exists`.
-- ============================================================

drop table if exists notification_preferences;
