-- ============================================================
-- FGA Melbourne HR App — Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- STAFF PROFILES
create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text not null,
  role text not null default 'staff' check (role in ('admin', 'staff')),
  position text,
  department text,
  google_calendar_id text,
  avatar_url text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- GOOGLE OAUTH TOKENS (kept separate from staff so directory queries can never expose them)
create table if not exists staff_google_tokens (
  staff_id uuid primary key references staff(id) on delete cascade,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  updated_at timestamptz default now()
);

-- GENERIC APP SETTINGS (key/value, e.g. toil_window_weeks)
create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz default now(),
  updated_by uuid references staff(id)
);
insert into app_settings (key, value) values ('toil_window_weeks', '4')
  on conflict (key) do nothing;

-- POLICIES
create table if not exists policies (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  content_drive_url text,
  version integer not null default 1,
  is_active boolean default true,
  requires_signoff boolean default true,
  created_by uuid references staff(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- POLICY SIGN-OFFS
create table if not exists policy_signoffs (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid references policies(id) on delete cascade,
  staff_id uuid references staff(id) on delete cascade,
  policy_version integer not null,
  signed_at timestamptz default now(),
  unique(policy_id, staff_id, policy_version)
);

-- MEETING NOTES
create table if not exists meeting_notes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  meeting_type text not null check (meeting_type in ('1on1', 'team', 'performance_review', 'projects_goals')),
  meeting_date date not null,
  attendees uuid[] default '{}',
  content text,
  drive_file_url text,
  drive_file_id text,
  is_shared_with_staff boolean default false,
  created_by uuid references staff(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- MEETING TEMPLATES
create table if not exists meeting_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  meeting_type text not null check (meeting_type in ('1on1', 'team', 'performance_review', 'projects_goals')),
  content text not null default '',
  created_by uuid references staff(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ONBOARDING CHECKLISTS (templates)
create table if not exists checklist_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'generic' check (category in ('generic', 'ministry')),
  ministry text,
  is_offboarding boolean default false,
  created_by uuid references staff(id),
  created_at timestamptz default now()
);

-- CHECKLIST ITEMS (within templates)
create table if not exists checklist_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references checklist_templates(id) on delete cascade,
  title text not null,
  description text,
  assigned_to text default 'admin' check (assigned_to in ('admin', 'staff', 'both')),
  order_index integer default 0,
  created_at timestamptz default now()
);

-- ASSIGNED CHECKLISTS (for a specific staff member)
create table if not exists staff_checklists (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid references staff(id) on delete cascade,
  template_id uuid references checklist_templates(id),
  title text not null,
  is_offboarding boolean default false,
  assigned_by uuid references staff(id),
  due_date date,
  created_at timestamptz default now()
);

-- CHECKLIST ITEM COMPLETIONS
create table if not exists checklist_completions (
  id uuid primary key default gen_random_uuid(),
  staff_checklist_id uuid references staff_checklists(id) on delete cascade,
  checklist_item_id uuid references checklist_items(id) on delete cascade,
  completed_by uuid references staff(id),
  completed_at timestamptz default now(),
  unique(staff_checklist_id, checklist_item_id)
);

-- STAFF HUB ITEMS
create table if not exists hub_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  drive_url text,
  category text not null default 'general',
  order_index integer default 0,
  created_by uuid references staff(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- NOTIFICATIONS
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid references staff(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null check (type in ('policy', 'meeting', 'checklist', 'general')),
  reference_id uuid,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- EXPENSE CLAIMS
-- ------------------------------------------------------------
-- Reimbursable staff expense claims, reviewed by approvers (designated via the
-- `role_permissions` "approve_expenses" feature flag; admins always allowed)
-- and pushed to Xero as ACCPAY bills payable to the staff member's own contact.
--
-- This table already exists in the live DB; the canonical column set below is
-- the result of supabase-migration-2026-06-10-expense-claims-xero.sql. The
-- legacy `category` column is kept NULLABLE (no longer required on submit).
--
-- status canonical set: 'submitted','approved','rejected','pushed','push_failed'
--   (legacy 'pending' is backfilled to 'submitted'; 'draft' is reserved/unused).
--
-- Receipts are stored in a PRIVATE Supabase Storage bucket named "receipts"
-- (created manually in the dashboard); `receipt_path` holds the object path
-- using the convention `${staff_id}/${timestamp}-${sanitisedName}`.
create table if not exists expense_claims (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid references staff(id) on delete cascade,
  date date not null,                       -- = spent_on
  amount numeric not null,
  category text,                            -- legacy, nullable
  description text,
  receipt_url text,                         -- legacy receipt link
  status text not null default 'submitted'
    check (status in ('submitted', 'approved', 'rejected', 'pushed', 'push_failed')),
  reviewed_by uuid references staff(id),
  reviewed_at timestamptz,
  reviewer_notes text,
  -- Xero / richer claim columns (added by the 2026-06-10 migration)
  currency text default 'AUD',
  spent_at text,                            -- location where the spend occurred
  account_code text,                        -- Xero expense account code
  account_name text,                        -- Xero expense account name (denormalised)
  tax_type text,                            -- Xero TaxType code
  tax_rate_name text,                       -- Xero tax rate display name (denormalised)
  line_amount_type text default 'Inclusive',-- 'Inclusive' | 'Exclusive' | 'NoTax'
  receipt_path text,                        -- Supabase Storage object path in "receipts"
  receipt_mime text,                        -- receipt content type
  line_items jsonb,                         -- reserved for future itemisation
  xero_invoice_id text,                     -- Xero ACCPAY InvoiceID once pushed
  xero_contact_id text,                     -- Xero ContactID the bill was raised against
  xero_pushed_at timestamptz,               -- when the bill was created in Xero
  xero_error text,                          -- last Xero push/attachment error message
  xero_total numeric,                       -- total returned by Xero (sanity-checked vs amount)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_expense_claims_status on expense_claims (status);
create index if not exists idx_expense_claims_staff_id on expense_claims (staff_id);

-- NOTE: staff.xero_contact_id (text) is also added by the 2026-06-10 migration.
-- It maps each staff member to their OWN Xero contact so approved expense
-- claims become ACCPAY bills payable to that contact. See the staff table
-- above (the live column is added via `alter table ... add column if not exists`).

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table staff enable row level security;
alter table policies enable row level security;
alter table policy_signoffs enable row level security;
alter table meeting_notes enable row level security;
alter table checklist_templates enable row level security;
alter table checklist_items enable row level security;
alter table staff_checklists enable row level security;
alter table checklist_completions enable row level security;
alter table hub_items enable row level security;
alter table notifications enable row level security;

-- Staff can read all staff profiles (for dropdowns etc)
create policy "staff can view all staff" on staff for select using (true);

-- Only admins can insert/update staff
create policy "admins can manage staff" on staff for all using (
  exists (select 1 from staff where email = current_user and role = 'admin')
);

-- Policies visible to all active staff
create policy "all staff can view policies" on policies for select using (true);

-- Only admins can manage policies
create policy "admins can manage policies" on policies for all using (
  exists (select 1 from staff where email = current_user and role = 'admin')
);

-- Staff can see their own sign-offs, admins see all
create policy "staff can view own signoffs" on policy_signoffs for select using (true);
create policy "staff can insert own signoffs" on policy_signoffs for insert with check (true);

-- Meeting notes: admins see all, staff see shared ones where they're an attendee
create policy "admins see all meeting notes" on meeting_notes for select using (true);

-- Hub items visible to all
create policy "all can view hub items" on hub_items for select using (true);

-- Notifications: staff see only their own
create policy "staff see own notifications" on notifications for select using (true);
create policy "staff can mark own notifications read" on notifications for update using (true);

-- ============================================================
-- SEED: Insert initial admin staff member
-- ============================================================

insert into staff (email, full_name, role, position, department)
values (
  'nicholas.teh@fgam.org.au',
  'Nick Teh',
  'admin',
  'Administrator',
  'Administration'
) on conflict (email) do nothing;
