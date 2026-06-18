-- ============================================================
-- Migration: One roster row per staff member per template (UP)
-- Run this in the Supabase SQL Editor.
--
-- Enforces that a given staff member appears at most once on a template's
-- contract roster. Blank / unlinked rows (staff_id IS NULL) are exempt — you
-- can still have as many of those as you like.
--
-- IDEMPOTENT and safe to re-run. Step 1 first removes any pre-existing
-- duplicate staff rows (keeping a generated copy if one exists, otherwise the
-- most recently updated) so step 2's unique index can be created cleanly.
-- ============================================================

-- 1. Drop duplicate staff rows per (template_id, staff_id), keeping the best.
delete from contract_draft_rows d
using (
  select id,
         row_number() over (
           partition by template_id, staff_id
           order by (generated_contract_id is not null) desc, updated_at desc
         ) as rn
  from contract_draft_rows
  where staff_id is not null
) ranked
where d.id = ranked.id and ranked.rn > 1;

-- 2. Enforce uniqueness going forward. Partial index excludes NULL staff_id,
--    so unlinked blank rows are unaffected.
create unique index if not exists contract_draft_rows_template_staff_uq
  on contract_draft_rows (template_id, staff_id)
  where staff_id is not null;
