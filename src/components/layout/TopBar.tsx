"use client";

import { useState, useEffect } from "react";
import { Bell, X, LogOut, Calendar, CalendarDays, CheckSquare, Users, Network, Briefcase, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface TopBarProps {
  userName?: string;
  isAdmin?: boolean;
  role?: string;
  permissions?: string[];
  notificationCount?: number;
}

const moreItems = [
  { label: "Calendars",    href: "/dashboard/calendar",              icon: Calendar },
  { label: "Team Schedule", href: "/dashboard/schedule",             icon: CalendarDays, permission: "view_team_schedule" },
  { label: "Onboarding",  href: "/dashboard/onboarding",            icon: CheckSquare },
  { label: "Org Chart",   href: "/dashboard/org",                   icon: Network },
  { label: "My Role",     href: "/dashboard/position-descriptions", icon: Briefcase },
  { label: "Staff",       href: "/dashboard/staff",                 icon: Users,       permission: "manage_staff" },
  { label: "Access Levels", href: "/dashboard/access",              icon: ShieldCheck, adminOnly: true },
];

export default function TopBar({ userName, isAdmin, role = "staff", permissions = [], notificationCount = 0 }: TopBarProps) {
  const [showMore, setShowMore] = useState(false);
  const pathname = usePathname();

  // Listen for the BottomNav "More" button event
  useEffect(() => {
    const handler = () => setShowMore(true);
    window.addEventListener("openMobileMenu", handler);
    return () => window.removeEventListener("openMobileMenu", handler);
  }, []);

  const pageTitle: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/dashboard/calendar": "Calendars",
    "/dashboard/meetings": "Meeting Notes",
    "/dashboard/policies": "Policies",
    "/dashboard/onboarding": "Onboarding",
    "/dashboard/hub": "Staff Hub",
    "/dashboard/staff": "Staff",
    "/dashboard/settings": "Settings",
  };

  const title = Object.entries(pageTitle)
    .sort((a, b) => b[0].length - a[0].length)
    .find(([path]) => pathname.startsWith(path))?.[1] ?? "HR Portal";

  return (
    <>
      {/* Top bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-[#223149] h-14 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
            <span className="text-white text-xs font-bold" style={{ fontFamily: "var(--font-league-spartan)" }}>FGA</span>
          </div>
          <h1 className="text-white font-bold text-base" style={{ fontFamily: "var(--font-league-spartan)" }}>
            {title}
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <Link href="/dashboard/notifications" className="relative p-2 rounded-xl hover:bg-white/10 transition-colors">
            <Bell className="w-5 h-5 text-white" />
            {notificationCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center font-bold">
                {notificationCount > 9 ? "9+" : notificationCount}
              </span>
            )}
          </Link>
        </div>
      </header>

      {/* More slide-up sheet */}
      {showMore && (
        <>
          <div className="md:hidden fixed inset-0 bg-black/50 z-50" onClick={() => setShowMore(false)} />
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl pb-safe">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#ECE3DF]">
              <div>
                <p className="font-bold text-[#223149]" style={{ fontFamily: "var(--font-league-spartan)" }}>
                  {userName}
                </p>
                {role === "admin" && (
                  <span className="text-xs text-[#9BADB7]">Admin</span>
                )}
                {role === "manager" && (
                  <span className="text-xs text-[#9BADB7]">Manager</span>
                )}
              </div>
              <button onClick={() => setShowMore(false)} className="p-2 rounded-xl hover:bg-[#F8F6F4]">
                <X className="w-5 h-5 text-[#5F7C84]" />
              </button>
            </div>
            <div className="px-4 py-3 space-y-1">
              {moreItems
                .filter(item => {
                  if (!item.adminOnly && !(item as any).permission) return true;
                  if (isAdmin) return true;
                  if (item.adminOnly) return false;
                  if ((item as any).permission) return permissions.includes((item as any).permission);
                  return false;
                })
                .map(item => {
                  const Icon = item.icon;
                  const isActive = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setShowMore(false)}
                      className={`flex items-center gap-4 px-4 py-3.5 rounded-xl transition-colors ${
                        isActive ? "bg-[#223149]/5 text-[#223149]" : "text-[#5F7C84] hover:bg-[#F8F6F4]"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  );
                })}
            </div>
            <div className="px-4 pb-6 pt-2 border-t border-[#ECE3DF]">
              <a
                href="/api/auth/signout"
                className="flex items-center gap-4 px-4 py-3.5 rounded-xl text-red-500 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Sign out</span>
              </a>
            </div>
          </div>
        </>
      )}
    </>
  );
}
