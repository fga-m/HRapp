-- ============================================================
-- Migration: Expense claim GST override (UP)
-- Run this in the Supabase SQL Editor BEFORE deploying the matching code.
--
-- Adds a claim-level `tax_amount` column used by the NORMAL (single-line) form
-- to override the auto-calculated GST. NULL means "auto-calculate" (the
-- existing behaviour). Itemised claims store their per-line GST overrides
-- inside the existing `line_items` jsonb column, so they don't use this.
--
-- This migration is IDEMPOTENT: safe to re-run.
-- ============================================================

alter table expense_claims add column if not exists tax_amount numeric;  -- normal-mode GST override; null = auto
