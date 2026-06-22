# New-staff account provisioning — setup & usage

Create a staff member in the HR app once, then create their **Google Workspace
account** and **Xero payroll employee** from that single record. The staff
record is the source of truth — name, email, DOB and address flow out to Google,
Xero and contracts, so nothing is typed twice.

## What was added

- **DB migration** `supabase-migration-2026-06-22-staff-provisioning.sql`
  (+ `-DOWN`): canonical staff fields (`first_name`, `last_name`,
  `recovery_email`, `mobile_phone`, address block, `start_date`,
  `google_account_created_at`), a `google_workspace_connection` table, and a
  `staff_provisioning_log` audit table. Backfills first/last name from
  `full_name`.
- **Google Workspace integration** (`src/lib/google-workspace.ts` +
  `/api/google-workspace/{connect,callback,status,disconnect}`): a dedicated
  super-admin connection that creates accounts via the Admin SDK Directory API.
- **Xero payroll** (`src/lib/xero.ts`): `createPayrollEmployee` /
  `findOrCreatePayrollEmployee` against the AU Payroll API. Uses the existing
  Xero connection — `payroll.employees` is already in its scopes.
- **Provisioning API** `/api/staff/[id]/provision` (GET status + POST run).
  Runs each service independently, is idempotent, and writes results back.
- **UI**: a Google Workspace card in Settings; provisioning checkboxes on the
  Add-Staff form; a "Account Provisioning" panel on each staff profile; the new
  canonical fields added to the Add/Edit staff forms.

## Activation steps

1. **Run the migration** — paste
   `supabase-migration-2026-06-22-staff-provisioning.sql` into the Supabase SQL
   editor and run it.

2. **Google Cloud / Workspace (one-time, required for Google account creation):**
   - In the Google Cloud project behind `GOOGLE_CLIENT_ID`, enable the
     **Admin SDK API**.
   - Add the scope `https://www.googleapis.com/auth/admin.directory.user` to the
     OAuth consent screen.
   - Add the redirect URI `<NEXTAUTH_URL>/api/google-workspace/callback` to the
     OAuth client.
   - In the app: **Settings → Google Workspace → Connect**, and sign in with a
     Workspace **super-admin** account. (A normal account returns 403.)

3. **Xero** — already works if Xero is connected in Settings. If it was
   connected before the `payroll.employees` scope existed, Disconnect then
   Connect once to re-grant.

## How to use it

- **At creation:** Add-Staff form → fill name/email/DOB/address → tick
  "Create Google account" / "Add to Xero payroll" → Add & Provision. The result
  screen shows per-service success and the Google temp password **once**.
- **Later / retry:** open a staff profile → **Account Provisioning** panel →
  tick services, fill any missing fields, Provision.

## Field mapping (source of truth → systems)

| Staff field | Google | Xero payroll | Contract |
|---|---|---|---|
| first_name / last_name | givenName / familyName | FirstName / LastName | name |
| email | primaryEmail | Email | email |
| recovery_email | recoveryEmail | — | — |
| birthdate | — | DateOfBirth (required) | — |
| address block | — | HomeAddress (required) | address |
| mobile_phone | recoveryPhone (if E.164) | Mobile | — |
| position | org title | Title | — |
| start_date | — | StartDate | start date |

## Notes

- **Idempotent**: before creating, Google is checked by primary email and Xero
  by email/name. An existing account is **linked, not duplicated** — so this
  coexists with the existing "import from Google" tool (used for staff who
  already have accounts).
- **Not synced**: TFN, bank, super and salary stay in Xero only (sensitive;
  entered there for pay runs). The app creates the employee record; payroll
  detail is finished in Xero.
- The Google temp password is shown once and never stored; the new starter is
  forced to change it at first sign-in.
- `next build` couldn't be run in the assistant's Linux sandbox (it lacks the
  Linux SWC binary and offline npm), but `tsc --noEmit` passes clean. Build on
  your Mac / Vercel as usual.
