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
  type LucideIcon,
} from "lucide-react";
import type { FeatureKey } from "@/lib/permissions";

/**
 * Single source of truth for navigation. The desktop sidebar, the mobile bottom
 * tab bar, the mobile "More" sheet, and the mobile top-bar title are all derived
 * from this list — so adding/renaming/re-gating a page only happens here.
 */
export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  adminOnly?: boolean;            // only admin can see (not configurable)
  permission?: FeatureKey;        // visible if admin OR the user has this permission
  hideWhenNoChecklists?: boolean; // hide for regular staff when no active checklists
  mobile?: "tab" | "more";        // where it appears in the mobile nav (omitted = neither)
  tabLabel?: string;              // short label for the bottom tab bar (defaults to label)
  title?: string;                 // mobile top-bar title (defaults to label)
  exact?: boolean;                // active state requires an exact path match
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard",           href: "/dashboard",                       icon: LayoutDashboard, mobile: "tab",  tabLabel: "Home", exact: true },
  { label: "Work Calendar",       href: "/dashboard/calendar",              icon: Calendar,        mobile: "tab",  tabLabel: "Calendar" },
  { label: "Leave Requests",      href: "/dashboard/leave",                 icon: Palmtree,        mobile: "more" },
  { label: "Expenses",            href: "/dashboard/expenses",              icon: Receipt,         mobile: "more", title: "Expense Claims" },
  { label: "Hours & TOIL",        href: "/dashboard/schedule",              icon: CalendarDays,    mobile: "more", permission: "view_team_schedule" },
  { label: "Meeting Notes",       href: "/dashboard/meetings",              icon: FileText,        mobile: "tab",  tabLabel: "Meetings" },
  { label: "Performance",         href: "/dashboard/performance",           icon: TrendingUp,      mobile: "more" },
  { label: "Policies",            href: "/dashboard/policies",              icon: Shield,          mobile: "more" },
  { label: "Contracts",           href: "/dashboard/contracts",             icon: FileSignature,   mobile: "more" },
  { label: "Checklists",          href: "/dashboard/onboarding",            icon: CheckSquare,     mobile: "more", hideWhenNoChecklists: true },
  { label: "Resources",           href: "/dashboard/hub",                   icon: BookOpen,        mobile: "tab" },
  { label: "Org Chart",           href: "/dashboard/org",                   icon: Network,         mobile: "more" },
  { label: "My Position",         href: "/dashboard/position-descriptions", icon: Briefcase,       mobile: "more" },
  { label: "Staff",               href: "/dashboard/staff",                 icon: Users,           mobile: "more", permission: "manage_staff" },
  { label: "Roles & Permissions", href: "/dashboard/access",                icon: ShieldCheck,     mobile: "more", adminOnly: true },
  { label: "Settings",            href: "/dashboard/settings",              icon: Settings,        mobile: "more", adminOnly: true },
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
  return NAV_ITEMS.filter((i) => isNavItemVisible(i, ctx));
}

/** Items for the mobile "More" sheet, filtered by visibility. */
export function visibleMoreItems(ctx: NavVisibilityCtx): NavItem[] {
  return NAV_ITEMS.filter((i) => i.mobile === "more" && isNavItemVisible(i, ctx));
}

/** Mobile bottom tab bar items (none are permission-gated). */
export const BOTTOM_NAV_ITEMS: NavItem[] = NAV_ITEMS.filter((i) => i.mobile === "tab");

// Titles for the mobile top bar, including pages not in the main nav.
const EXTRA_TITLES: Record<string, string> = {
  "/dashboard/notifications": "Notifications",
};

/** Resolve the mobile top-bar title for a pathname (longest-prefix match). */
export function getPageTitle(pathname: string): string {
  const entries: [string, string][] = [
    ...NAV_ITEMS.map((i) => [i.href, i.title ?? i.label] as [string, string]),
    ...Object.entries(EXTRA_TITLES),
  ];
  const match = entries
    .sort((a, b) => b[0].length - a[0].length)
    .find(([href]) => pathname.startsWith(href));
  return match?.[1] ?? "HR Portal";
}
