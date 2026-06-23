-- 2026-06-23 — Custom roles + multiple roles per staff member
-- ============================================================
-- 1. A `roles` table so admins can add/rename/remove roles.
-- 2. staff.roles text[] so a person can hold more than one role.
-- 3. Seed the `approve_leave` permission so leave approval becomes a toggle
--    (previously hardcoded to the leave_approver role).
--
-- Safe / idempotent — can be re-run.

-- ── 0. Remove restrictive CHECK constraints on role_permissions ──
-- The table had a CHECK that only allowed a fixed set of role names (and
-- rejected 'finance' / custom roles). That constraint blocked the Finance
-- toggle AND aborted this migration. Drop it so any role key is allowed.
alter table role_permissions drop constraint if exists role_permissions_role_check;
alter table role_permissions drop constraint if exists role_permissions_feature_check;

-- ── 1. roles table ──────────────────────────────────────────
create table if not exists roles (
  key         text primary key,
  label       text not null,
  sort_order  int  not null default 100,
  is_system   boolean not null default false,  -- protected from rename/delete
  is_admin    boolean not null default false,  -- full access, all features on
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Standard roles. Admin & Staff are system (protected). Others editable.
insert into roles (key, label, sort_order, is_system, is_admin) values
  ('admin',          'Admin',          10, true,  true),
  ('manager',        'Manager',        20, false, false),
  ('finance',        'Finance',        30, false, false),
  ('leave_approver', 'Leave Approver', 40, false, false),
  ('staff',          'Staff',          90, true,  false)
on conflict (key) do nothing;

-- Pick up any other role values already present on staff so nothing is orphaned.
insert into roles (key, label, sort_order, is_system, is_admin)
select distinct s.role, initcap(replace(s.role, '_', ' ')), 100, false, false
from staff s
where s.role is not null
  and s.role <> ''
  and s.role not in (select key from roles)
on conflict (key) do nothing;

-- ── 2. staff.roles array ────────────────────────────────────
alter table staff add column if not exists roles text[];

update staff
set roles = array[role]
where (roles is null or array_length(roles, 1) is null)
  and role is not null
  and role <> '';

-- ── 3. approve_leave permission rows ────────────────────────
-- Preserve current behaviour: leave_approver could approve leave; admins always
-- can (admins aren't stored in role_permissions). Everyone else defaults off.
insert into role_permissions (role, feature, enabled, updated_at)
select r.key, 'approve_leave', (r.key = 'leave_approver'), now()
from roles r
where r.key <> 'admin'
  and not exists (
    select 1 from role_permissions rp
    where rp.role = r.key and rp.feature = 'approve_leave'
  );
