-- ============================================================
-- Migration: move Google OAuth tokens out of the staff table
-- Run this in the Supabase SQL Editor BEFORE deploying the matching code.
--
-- Why: every API route uses the service-role client (RLS bypassed), so a
-- single over-broad `select("*")` on the staff table could leak long-lived
-- Google access/refresh tokens. Isolating them in their own table means no
-- staff/directory query can ever return them.
-- ============================================================

-- 1. Dedicated table for the OAuth secrets (1:1 with staff, cascade on delete)
create table if not exists staff_google_tokens (
  staff_id uuid primary key references staff(id) on delete cascade,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  updated_at timestamptz default now()
);

-- 2. Backfill existing tokens from the staff table (no-op if columns already dropped)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'staff' and column_name = 'google_access_token'
  ) then
    insert into staff_google_tokens (staff_id, access_token, refresh_token, token_expires_at)
    select id, google_access_token, google_refresh_token, google_token_expires_at
    from staff
    where google_access_token is not null
       or google_refresh_token is not null
       or google_token_expires_at is not null
    on conflict (staff_id) do update set
      access_token     = excluded.access_token,
      refresh_token    = excluded.refresh_token,
      token_expires_at = excluded.token_expires_at;
  end if;
end $$;

-- 3. Drop the secret columns from the staff table
alter table staff drop column if exists google_access_token;
alter table staff drop column if exists google_refresh_token;
alter table staff drop column if exists google_token_expires_at;
