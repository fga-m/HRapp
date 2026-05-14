"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Calendar,
  FileText,
  Shield,
  CheckSquare,
  BookOpen,
  Users,
  LayoutDashboard,
  Bell,
  LogOut,
  Settings,
  Eye,
} from "lucide-react";
import { enableStaffView } from "@/app/actions/view-mode";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Calendars", href: "/dashboard/calendar", icon: Calendar },
  { label: "Meeting Notes", href: "/dashboard/meetings", icon: FileText },
  { label: "Policies", href: "/dashboard/policies", icon: Shield },
  { label: "Onboarding", href: "/dashboard/onboarding", icon: CheckSquare },
  { label: "Staff Hub", href: "/dashboard/hub", icon: BookOpen },
  { label: "Staff", href: "/dashboard/staff", icon: Users, adminOnly: true },
];

interface SidebarProps {
  isAdmin?: boolean;
  userName?: string;
  userEmail?: string;
  notificationCount?: number;
  viewAsStaff?: boolean;
}

export default function Sidebar({ isAdmin, userName, userEmail, notificationCount = 0, viewAsStaff = false }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-64 min-h-screen bg-[#223149] flex flex-col">
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
      {isAdmin && (
        <div className="px-6 py-3">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#9BADB7]/20 text-[#9BADB7]">
            Admin
          </span>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems
          .filter((item) => !item.adminOnly || isAdmin)
          .map((item) => {
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
          {notificationCount > 0 && (
            <span className="ml-auto text-xs bg-red-500 text-white rounded-full px-1.5 py-0.5 font-bold">
              {notificationCount > 9 ? "9+" : notificationCount}
            </span>
          )}
        </Link>
        {isAdmin && (
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#9BADB7] hover:bg-white/5 hover:text-white transition-colors"
          >
            <Settings className="w-4 h-4" />
            Settings
          </Link>
        )}
        <div className="px-3 py-2 mt-2">
          <p className="text-white text-sm font-medium truncate">{userName}</p>
          <p className="text-[#9BADB7] text-xs truncate">{userEmail}</p>
        </div>
        {/* Preview as staff — only visible to admins, hidden while preview is active */}
        {isAdmin && (
          <form action={enableStaffView}>
            <button
              type="submit"
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
