"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Calendar,
  CalendarDays,
  FileText,
  Shield,
  CheckSquare,
  BookOpen,
  Users,
  LayoutDashboard,
  Bell,
  LogOut,
  Eye,
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
import { enableStaffView } from "@/app/actions/view-mode";
import type { FeatureKey } from "@/lib/permissions";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  adminOnly?: boolean;           // only admin can see (not configurable)
  permission?: FeatureKey;       // visible if admin OR if user has this permission
  hideWhenNoChecklists?: boolean; // hide for regular staff when no active checklists
}

const navItems: NavItem[] = [
  { label: "Dashboard",         href: "/dashboard",                       icon: LayoutDashboard },
  { label: "Work Calendar",     href: "/dashboard/calendar",              icon: Calendar },
  { label: "Leave Requests",    href: "/dashboard/leave",                 icon: Palmtree },
  { label: "Expenses",          href: "/dashboard/expenses",              icon: Receipt },
  { label: "Hours & TOIL",      href: "/dashboard/schedule",              icon: CalendarDays,  permission: "view_team_schedule" },
  { label: "Meeting Notes",     href: "/dashboard/meetings",              icon: FileText },
  { label: "Performance",       href: "/dashboard/performance",           icon: TrendingUp },
  { label: "Policies",          href: "/dashboard/policies",              icon: Shield },
  { label: "Contracts",         href: "/dashboard/contracts",             icon: FileSignature },
  { label: "Checklists",        href: "/dashboard/onboarding",            icon: CheckSquare,   hideWhenNoChecklists: true },
  { label: "Resources",         href: "/dashboard/hub",                   icon: BookOpen },
  { label: "Org Chart",         href: "/dashboard/org",                   icon: Network },
  { label: "My Position",       href: "/dashboard/position-descriptions", icon: Briefcase },
  { label: "Staff",             href: "/dashboard/staff",                 icon: Users,         permission: "manage_staff" },
  { label: "Roles & Permissions", href: "/dashboard/access",              icon: ShieldCheck,   adminOnly: true },
  { label: "Settings",          href: "/dashboard/settings",              icon: Settings,      adminOnly: true },
];

interface SidebarProps {
  isAdmin?: boolean;
  role?: string;
  permissions?: string[];
  userName?: string;
  userEmail?: string;
  userId?: string;
  notificationCount?: number;
  viewAsStaff?: boolean;
  hasActiveChecklists?: boolean;
}

export default function Sidebar({
  isAdmin,
  role = "staff",
  permissions = [],
  userName,
  userEmail,
  userId,
  notificationCount = 0,
  viewAsStaff = false,
  hasActiveChecklists = true,
}: SidebarProps) {
  const pathname = usePathname();

  const visibleItems = navItems.filter((item) => {
    if (item.adminOnly) return isAdmin ?? false;
    if (item.permission) return (isAdmin) || permissions.includes(item.permission);
    if (item.hideWhenNoChecklists && !isAdmin) return hasActiveChecklists;
    return true;
  });

  const roleBadgeLabel =
    role === "admin" ? "Admin" : role === "manager" ? "Manager" : role === "finance" ? "Finance" : null;

  return (
    <aside className="w-64 h-screen sticky top-0 bg-[#223149] flex flex-col overflow-y-auto">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
            <span
              className="text-white text-sm font-bold"
              style={{ fontFamily: "var(--font-league-spartan)" }}
            >
              FGA
            </span>
          </div>
          <div>
            <p
              className="text-white font-bold text-sm leading-tight"
              style={{ fontFamily: "var(--font-league-spartan)" }}
            >
              FGA Melbourne
            </p>
            <p className="text-[#9BADB7] text-xs">HR Portal</p>
          </div>
        </div>
      </div>

      {/* Role badge */}
      {roleBadgeLabel && (
        <div className="px-6 py-3">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#9BADB7]/20 text-[#9BADB7]">
            {roleBadgeLabel}
          </span>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                isActive
                  ? "bg-white/10 text-white"
                  : "text-[#9BADB7] hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-white/10 space-y-1">
        <Link
          href="/dashboard/notifications"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
            pathname.startsWith("/dashboard/notifications")
              ? "bg-white/10 text-white"
              : "text-[#9BADB7] hover:bg-white/5 hover:text-white"
          )}
        >
          <div className="relative">
            <Bell className="w-4 h-4" />
            {notificationCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-red-500 rounded-full text-white text-[9px] flex items-center justify-center font-bold">
                {notificationCount > 9 ? "9+" : notificationCount}
              </span>
            )}
          </div>
          Notifications
        </Link>

        {userId ? (
          <Link
            href={`/dashboard/staff/${userId}`}
            className="block px-3 py-2 mt-2 rounded-xl hover:bg-white/5 transition-colors group"
          >
            <p className="text-white text-sm font-medium truncate group-hover:underline">{userName}</p>
            <p className="text-[#9BADB7] text-xs truncate">{userEmail}</p>
          </Link>
        ) : (
          <div className="px-3 py-2 mt-2">
            <p className="text-white text-sm font-medium truncate">{userName}</p>
            <p className="text-[#9BADB7] text-xs truncate">{userEmail}</p>
          </div>
        )}
        {/* Preview as staff — only visible to admins, hidden while preview is active */}
        {isAdmin && (
          <form action={enableStaffView}>
            <button
              type="submit"
              title="See the portal exactly as a staff member sees it"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#9BADB7] hover:bg-white/5 hover:text-white transition-colors"
            >
              <Eye className="w-4 h-4" />
              Preview as staff
            </button>
          </form>
        )}
        <a
          href="/api/auth/signout"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#9BADB7] hover:bg-white/5 hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </a>
      </div>
    </aside>
  );
}
