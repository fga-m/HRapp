-- ============================================================
-- Migration: New-staff account provisioning (DOWN / rollback)
-- Reverses supabase-migration-2026-06-22-staff-provisioning.sql.
-- Safe to re-run.
-- ============================================================

drop table if exists staff_provisioning_log;
drop table if exists google_workspace_connection;

alter table staff drop column if exists google_account_created_at;
alter table staff drop column if exists start_date;
alter table staff drop column if exists country;
alter table staff drop column if exists postcode;
alter table staff drop column if exists state;
alter table staff drop column if exists suburb;
alter table staff drop column if exists address_line2;
alter table staff drop column if exists address_line1;
alter table staff drop column if exists mobile_phone;
alter table staff drop column if exists recovery_email;
alter table staff drop column if exists last_name;
alter table staff drop column if exists first_name;

-- NOTE: staff.xero_employee_id is intentionally NOT dropped — it predates this
-- migration and is used elsewhere (Xero leave-request linking).
