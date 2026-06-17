-- ============================================================
-- Migration: Contract template field config (DOWN / removal)
-- Run this in the Supabase SQL Editor to revert the matching UP migration
-- (supabase-migration-2026-06-17-contract-template-field-config.sql).
--
-- Drops the per-field UI metadata. The grid then falls back to plain text
-- boxes for every field. Does NOT touch the base contract_templates table.
--
-- This migration is IDEMPOTENT: the drop uses `if exists`.
-- ============================================================

alter table contract_templates drop column if exists field_config;
