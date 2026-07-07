# UI/UX Audit — FGAM HR Portal

**Date:** 7 July 2026 · **Focus:** staff (non-admin) experience, information architecture, grouping/ungrouping of features

Method: full code review of navigation, role gating, and page structure, plus a live walkthrough of every page in the deployed app (desktop, admin + "Preview as staff" mode).

---

## Executive summary

The app is feature-rich and visually consistent, but it is **organised around features, not around what a staff member is trying to do**. A staff member sees a flat sidebar of ~13 items where day-to-day tools (Leave, Expenses, Calendar) sit indistinguishably next to pages they might visit twice a year (Org Chart, My Position, Performance). Several pages carry admin framing even in their staff-facing versions, naming is inconsistent between nav, page titles, and routes, and the "Preview as staff" tool is misleading — it only changes the sidebar, not the pages, so it's very hard for you to see what staff actually see.

The good news: the structure underneath is sound (single source of truth for nav in `src/lib/nav.ts`, clean role/permission model, per-page staff/admin branching). Most fixes are re-grouping and re-labelling, not rebuilding.

---

## 1. What a staff member sees today

Sidebar (desktop), in order: Dashboard, Work Calendar, Leave Requests, Expenses, Meeting Notes, Performance, Policies, Contracts, Checklists*, Resources, Org Chart, My Position — plus Notifications tucked at the bottom. (*Checklists auto-hides when they have none — good pattern.)

Mobile: 4 tabs (Home, Calendar, Meetings, Resources) + a "More" sheet with the other 8+ items.

**Problems:**

- **No hierarchy of frequency.** Weekly tasks (leave, expenses, calendar) are visually equal to reference pages (org chart, position description). Thirteen flat items is above the comfortable scanning threshold; every visit is a re-scan.
- **The mobile tab choices don't match staff priorities.** Resources gets a permanent tab while Leave and Expenses — the two things staff most often *need* to do — are buried in "More". Meetings has a tab but was empty in the live app.
- **Notifications is orphaned** — hardcoded at the sidebar bottom, absent from the nav config and mobile More sheet (`EXTRA_TITLES` workaround in nav.ts betrays this).

## 2. Naming inconsistencies

| Nav label | Page title | Route | Issue |
|---|---|---|---|
| Expenses | Expense Claims | /dashboard/expenses | Two names for one thing |
| My Position | Position Descriptions ("Manage and maintain job descriptions for all staff") | /dashboard/position-descriptions | Nav promises "mine", page is the admin manage-all view |
| Checklists | Checklists ("Track checklist progress for staff joining or leaving") | /dashboard/onboarding | Route says onboarding, label says checklists, subtitle is admin-framed |
| Resources | Resources | /dashboard/hub | Dashboard quick action calls it "Staff Hub" — third name |
| Work Calendar | Work Calendar | /dashboard/calendar | Dashboard quick action calls it "View Calendars" |

Pick one name per concept and use it in nav, page title, dashboard quick actions, and notifications copy.

## 3. "Preview as staff" doesn't preview the staff experience

Verified in code (`src/app/dashboard/layout.tsx`): the preview cookie only affects the **layout shell** — sidebar, top bar, and the React context. But almost every page independently re-derives the caller's role, either server-side (`dashboard/page.tsx` does its own `caller.role === "admin"`) or by fetching it from an API (`/api/contracts`, `/api/policies`, …) — and none of those honor the preview cookie.

Result: in preview mode you still see the admin dashboard stats, "New Policy", "Upload Contract", "Assign Checklist", "Edit Chart", all 15 staff contracts, etc. The banner says "admin controls are hidden" — they aren't. **Real staff do see the correct restricted UI** (verified for contracts, policies, expenses, dashboard), so this is not a data leak — but it makes the preview tool worse than useless for QA: it actively misleads.

Fix options (both worthwhile):
1. Quick: make `dashboard/page.tsx` honor the cookie (server-side, trivial) and soften the banner copy until the rest is fixed.
2. Proper: introduce one shared `getCaller()` helper (session → staff row → roles → *minus preview*) and migrate the role-deriving APIs to it. This also fixes the legacy-role inconsistencies below.

## 4. Staff pages with admin framing

- **My Position** is the worst offender: staff click "My Position" and get "Position Descriptions — Manage and maintain job descriptions for all staff" with a "New Position Description" empty state.
- **Checklists** subtitle ("Track checklist progress for staff joining or leaving the organisation") describes the admin job, not the staff one ("Complete your onboarding tasks").
- **Performance** subtitle ("Track performance conversations and review notes for staff") — same pattern.
- Empty states say "Create the first review" / "Create one to get started" even where the viewer may not be allowed to create anything.

Rule of thumb: every page that branches staff/admin should also branch its **title, subtitle, and empty state**.

## 5. Tech-debt consistency risks (not urgent, worth scheduling)

- `dashboard/page.tsx`, hub API, and org API check the **legacy single `role === "admin"`** instead of `rolesAreAdmin(resolveRoles(...))`. Anyone made admin via the newer multi-role system (roles array / custom roles) would get the staff dashboard and 403s on hub/org edits. One helper, used everywhere, removes the class of bug.
- Org chart data typo: "1830 **Deartment** Head" (edit in the org chart UI).

---

## Recommended information architecture

Group the sidebar into labelled sections (nav.ts already supports this cleanly — add a `section` field):

**MY WORK** *(daily/weekly — also the 4 mobile tabs + Home)*
- Dashboard · Work Calendar · Leave · Expense Claims · Meeting Notes

**MY EMPLOYMENT** *(occasional, personal)*
- My Position · Contracts · Policies · Performance · Checklists (auto-hide as today)

**ORGANISATION** *(reference)*
- Resources · Org Chart (+ People directory later)

**ADMIN** *(gated, visually separated)*
- Staff · Hours & TOIL · Roles & Permissions · Settings

Same groups drive the mobile "More" sheet. Suggested mobile tabs: **Home · Calendar · Leave · Expenses** (Meetings and Resources move to More — swap back if usage says otherwise).

### Bolder consolidations (phase 2, optional)

- **"Action items" card on the staff dashboard**: one list combining policies awaiting signature, contracts awaiting signature, and open checklist items. These three pages are all "go sign/complete something" — staff shouldn't need three nav items to find their obligations. The pages remain as archives.
- **People** = Org Chart + staff directory in one page (staff see people; admins get edit).
- **Documents & sign-offs** = Policies + Contracts as two tabs of one page — halves the "My Employment" section.
- **My Position → merge into the staff profile**, which is already the "everything about me" hub (documents, leave balances, expenses, schedule).

---

## Prioritised plan

**Quick wins (small, safe, high visibility)**
1. Sidebar sections per the grouping above (nav.ts + Sidebar + mobile More sheet).
2. Naming pass: one name per concept (Expense Claims, Resources, Work Calendar…); staff-framed titles/subtitles/empty states on My Position, Checklists, Performance.
3. Dashboard honors preview cookie + uses `rolesAreAdmin` (fixes both the preview lie on the home page and the multi-role admin bug).
4. Notifications added to nav config (and mobile More).
5. Mobile tab swap: Leave + Expenses in, Meetings + Resources out.
6. Preview banner copy: "Previewing staff navigation — page contents may still show admin data" (until item 7 ships).

**Medium**
7. Shared `getCaller()` helper honoring the preview cookie; migrate role-deriving APIs → preview mode becomes trustworthy end-to-end; legacy `role === "admin"` checks replaced.
8. Staff dashboard "Action items" card (sign-offs, contracts, checklist items).

**Phase 2 / discuss first**
9. People (org chart + directory) and Documents (policies + contracts) consolidations.
10. My Position folded into profile.
