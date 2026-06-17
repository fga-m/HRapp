-- ============================================================
-- Migration: Contract generation from Google Docs templates (DOWN / removal)
-- Run this in the Supabase SQL Editor to revert the matching UP migration
-- (supabase-migration-2026-06-16-contract-templates.sql).
--
-- Drops the two generation tables. This does NOT touch `contracts` /
-- `contract_assignments` — contracts that were already pushed to the e-sign
-- flow remain (they're independent rows once created).
--
-- This migration is IDEMPOTENT: drops use `if exists`.
-- ============================================================

drop table if exists generated_contracts;
drop table if exists contract_templates;
