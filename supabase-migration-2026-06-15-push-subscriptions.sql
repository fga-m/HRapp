-- ============================================================
-- Migration: Web Push subscriptions (UP)
-- Run this in the Supabase SQL Editor BEFORE deploying the matching code.
--
-- What this does:
--   Creates `push_subscriptions`, one row per device/browser a staff member
--   has opted in to receive mobile/desktop push notifications on. The app
--   sends a Web Push to every subscription belonging to a staff member
--   whenever an in-app notification is created for them.
--
-- Each browser/device produces a unique `endpoint` URL (the push service's
-- address) plus a `p256dh` public key and `auth` secret used to encrypt the
-- payload. A single staff member can have many subscriptions (phone, laptop,
-- etc.). Subscriptions are removed automatically by the app when the push
-- service reports them as gone (HTTP 404/410), or when the user disables
-- notifications on that device.
--
-- This migration is IDEMPOTENT: safe to re-run.
-- ============================================================

create table if not exists push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  staff_id    uuid not null references staff(id) on delete cascade,
  endpoint    text not null unique,        -- push service URL (unique per device/browser)
  p256dh      text not null,               -- client public key (base64url)
  auth        text not null,               -- client auth secret (base64url)
  user_agent  text,                        -- best-effort device label for the user
  created_at  timestamptz not null default now()
);

-- Fast lookup of all of a staff member's devices when sending a push.
create index if not exists push_subscriptions_staff_id_idx
  on push_subscriptions (staff_id);

-- The app uses the service-role key (bypasses RLS) for all access, and
-- authorises in code. RLS is enabled with no policies so that, even if the
-- anon/publishable key ever reached this table, it would be denied by default.
alter table push_subscriptions enable row level security;
