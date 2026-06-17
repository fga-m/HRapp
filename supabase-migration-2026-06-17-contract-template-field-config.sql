-- ============================================================
-- Migration: Contract template field config (UP)
-- Run this in the Supabase SQL Editor BEFORE deploying the matching code.
--
-- Adds `field_config` to `contract_templates` (the base tables were created by
-- supabase-migration-2026-06-16-contract-templates.sql). It stores per-field UI
-- metadata so the generate grid can render the right input for each detected
-- {{merge field}}:
--   { "<fieldKey>": { "label": "Hours / week",
--                     "type": "text" | "date" | "select",
--                     "options": ["Full-time", "Part-time", "Casual"] } }
-- An empty object means every field defaults to a plain text box.
--
-- This migration is IDEMPOTENT: safe to re-run.
-- ============================================================

alter table contract_templates
  add column if not exists field_config jsonb not null default '{}'::jsonb;
