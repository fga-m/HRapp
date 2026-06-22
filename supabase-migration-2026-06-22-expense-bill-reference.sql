-- ============================================================
-- Migration: store the human-readable Xero bill reference on expense claims
-- Run this in the Supabase SQL Editor.
--
-- bill_reference holds the clean per-year number we send to Xero as the bill's
-- InvoiceNumber / Reference, e.g. "Expense Claims #2026-0001". Stored so it's
-- stable (never recomputed) and can be shown in the claims history for lookup.
--
-- IDEMPOTENT: safe to re-run.
-- ============================================================

alter table expense_claims add column if not exists bill_reference text;
