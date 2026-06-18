-- ============================================================
-- Migration: One roster row per staff member per template (DOWN / removal)
-- Run this in the Supabase SQL Editor to revert the matching UP migration
-- (supabase-migration-2026-06-18-contract-draft-rows-unique-staff.sql).
--
-- Drops the uniqueness constraint only. Rows are left untouched (the dedupe
-- the UP migration performed is not reversible).
--
-- IDEMPOTENT: drop uses `if exists`.
-- ============================================================

drop index if exists contract_draft_rows_template_staff_uq;
