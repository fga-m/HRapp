import {
  Calendar,
  CalendarDays,
  FileText,
  Shield,
  CheckSquare,
  BookOpen,
  Users,
  LayoutDashboard,
  Briefcase,
  Network,
  ShieldCheck,
  FileSignature,
  TrendingUp,
  Settings,
  Palmtree,
  Receipt,
  Bell,
  type LucideIcon,
} from "lucide-react";
import type { FeatureKey } from "@/lib/permissions";

/**
 * Single source of truth for navigation. The desktop sidebar, the mobile bottom
 * tab bar, the mobile "More" sheet, and the mobile top-bar title are all derived
 * from this list — so adding/renaming/re-gating a page only happens here.
 *
 * Items are grouped into sections, ordered by how often staff need them:
 * My Work (daily/weekly) → My Employment (occasional, personal) →
 * Organisation (reference) → Admin (gated).
 */

export const NAV_SECTIONS = ["My Work", "My Employment", "Organisation", "Admin"] as const;
export type NavSection = (typeof NAV_SECTIONS)[number];

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  section: NavSection;
  adminOnly?: boolean;            // only admin can see (not configurable)
  permission?: FeatureKey;        // visible if admin OR the user has this permission
  hideWhenNoChecklists?: boolean; // hide for regular staff when no active checklists
  mobile?: "tab" | "more";        // where it appears in the mobile nav (omitted = neither)
  tabLabel?: string;              // short label for the bottom tab bar (defaults to label)
  title?: string;                 // mobile top-bar title (defaults to label)
  exact?: boolean;                // active state requires an exact path match
  desktopHidden?: boolean;        // excluded from the desktop sidebar (rendered elsewhere)
}

export const NAV_ITEMS: NavItem[] = [
  // ── My Work — the daily/weekly essentials (these are also the mobile tabs)
  { label: "Dashboard",           href: "/dashboard",                       icon: LayoutDashboard, section: "My Work",       mobile: "tab",  tabLabel: "Home", exact: true },
  { label: "Work Calendar",       href: "/dashboard/calendar",              icon: Calendar,        section: "My Work",       mobile: "tab",  tabLabel: "Calendar" },
  { label: "Leave Requests",      href: "/dashboard/leave",                 icon: Palmtree,        section: "My Work",       mobile: "tab",  tabLabel: "Leave" },
  { label: "Expense Claims",      href: "/dashboard/expenses",              icon: Receipt,         section: "My Work",       mobile: "tab",  tabLabel: "Expenses", title: "Expense Claims" },
  { label: "Meeting Notes",       href: "/dashboard/meetings",              icon: FileText,        section: "My Work",       mobile: "more" },
  // Rendered natively in the sidebar footer and mobile top bar; listed here so
  // the More sheet and mobile title can pick it up.
  { label: "Notifications",       href: "/dashboard/notifications",         icon: Bell,            section: "My Work",       mobile: "more", desktopHidden: true },

  // ── My Employment — personal records staff visit occasionally
  { label: "My Position",         href: "/dashboard/position-descriptions", icon: Briefcase,       section: "My Employment", mobile: "more" },
  { label: "Documents",           href: "/dashboard/documents",             icon: FileSignature,   section: "My Employment", mobile: "more", title: "Documents & Sign-offs" },
  { label: "Performance",         href: "/dashboard/performance",           icon: TrendingUp,      section: "My Employment", mobile: "more" },
  { label: "Checklists",          href: "/dashboard/onboarding",            icon: CheckSquare,     section: "My Employment", mobile: "more", hideWhenNoChecklists: true },
  // Title-only entries so detail pages under the old routes keep a sensible
  // mobile top-bar title (index routes redirect to /dashboard/documents).
  { label: "Policies",            href: "/dashboard/policies",              icon: Shield,          section: "My Employment", desktopHidden: true },
  { label: "Contracts",           href: "/dashboard/contracts",             icon: FileSignature,   section: "My Employment", desktopHidden: true },

  // ── Organisation — shared reference
  { label: "Resources",           href: "/dashboard/hub",                   icon: BookOpen,        section: "Organisation",  mobile: "more" },
  { label: "People",              href: "/dashboard/people",                icon: Network,         section: "Organisation",  mobile: "more" },

  // ── Admin — management tools (permission-gated)
  { label: "Staff",               href: "/dashboard/staff",                 icon: Users,           section: "Admin",         mobile: "more", permission: "manage_staff" },
  { label: "Hours & TOIL",        href: "/dashboard/schedule",              icon: CalendarDays,    section: "Admin",         mobile: "more", permission: "view_team_schedule" },
  { label: "Roles & Permissions", href: "/dashboard/access",                icon: ShieldCheck,     section: "Admin",         mobile: "more", adminOnly: true },
  { label: "Settings",            href: "/dashboard/settings",              icon: Settings,        section: "Admin",         mobile: "more", adminOnly: true },
];

export interface NavVisibilityCtx {
  isAdmin?: boolean;
  permissions?: string[];
  hasActiveChecklists?: boolean;
}

export function isNavItemVisible(item: NavItem, ctx: NavVisibilityCtx): boolean {
  const { isAdmin = false, permissions = [], hasActiveChecklists = true } = ctx;
  if (item.adminOnly) return isAdmin;
  if (item.permission) return isAdmin || permissions.includes(item.permission);
  if (item.hideWhenNoChecklists && !isAdmin) return hasActiveChecklists;
  return true;
}

/** Full nav list for the desktop sidebar, filtered by visibility. */
export function visibleNavItems(ctx: NavVisibilityCtx): NavItem[] {
  return NAV_ITEMS.filter((i) => !i.desktopHidden && isNavItemVisible(i, ctx));
}

/** Items for the mobile "More" sheet, filtered by visibility. */
export function visibleMoreItems(ctx: NavVisibilityCtx): NavItem[] {
  return NAV_ITEMS.filter((i) => i.mobile === "more" && isNavItemVisible(i, ctx));
}

/** Mobile bottom tab bar items (none are permission-gated). */
export const BOTTOM_NAV_ITEMS: NavItem[] = NAV_ITEMS.filter((i) => i.mobile === "tab");

/** Resolve the mobile top-bar title for a pathname (longest-prefix match). */
export function getPageTitle(pathname: string): string {
  const entries: [string, string][] = NAV_ITEMS.map(
    (i) => [i.href, i.title ?? i.label] as [string, string]
  );
  const match = entries
    .sort((a, b) => b[0].length - a[0].length)
    .find(([href]) => pathname.startsWith(href));
  return match?.[1] ?? "HR Portal";
}
