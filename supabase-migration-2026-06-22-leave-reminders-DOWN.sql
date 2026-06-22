-- Rollback for supabase-migration-2026-06-22-leave-reminders.sql
alter table leave_requests drop column if exists last_reminded_at;
