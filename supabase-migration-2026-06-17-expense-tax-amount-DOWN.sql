-- ============================================================
-- Migration: Expense claim GST override (DOWN / removal)
-- Run this in the Supabase SQL Editor to revert the matching UP migration
-- (supabase-migration-2026-06-17-expense-tax-amount.sql).
--
-- Drops the normal-mode GST override column. Does NOT touch `line_items`
-- (it pre-existed and is used by itemised claims).
--
-- This migration is IDEMPOTENT: the drop uses `if exists`.
-- ============================================================

alter table expense_claims drop column if exists tax_amount;
