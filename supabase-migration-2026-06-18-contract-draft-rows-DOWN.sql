-- ============================================================
-- Migration: Persistent "roster" rows for contract generation (DOWN / removal)
-- Run this in the Supabase SQL Editor to revert the matching UP migration
-- (supabase-migration-2026-06-18-contract-draft-rows.sql).
--
-- Drops the roster table only. This does NOT touch `generated_contracts` /
-- `contracts` — anything already generated or pushed to the e-sign flow
-- remains (those rows are independent once created).
--
-- This migration is IDEMPOTENT: drop uses `if exists`.
-- ============================================================

drop table if exists contract_draft_rows;
