-- ============================================================
-- Migration: App-owned Google connection for contract generation (DOWN)
-- Run this in the Supabase SQL Editor to revert the matching UP migration
-- (supabase-migration-2026-06-17-contracts-google-connection.sql).
--
-- Dropping the table disconnects contract generation from Google; the feature
-- then reports "not connected" until reconnected (or reverted to per-user).
--
-- IDEMPOTENT: the drop uses `if exists`.
-- ============================================================

drop table if exists contracts_google_connection;
