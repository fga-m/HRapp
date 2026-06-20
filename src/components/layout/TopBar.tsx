"use client";

import { useState, useEffect } from "react";
import { Bell, X, LogOut, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { visibleMoreItems, getPageTitle } from "@/lib/nav";

interface TopBarProps {
  userName?: string;
  userEmail?: string;
  userAvatar?: string;
  userId?: string;
  isAdmin?: boolean;
  role?: string;
  permissions?: string[];
  notificationCount?: number;
  hasActiveChecklists?: boolean;
}

function Avatar({ src, name }: { src?: string; name?: string }) {
  const initials = name
    ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";
  // Literal classes (not `w-${size}`) so Tailwind generates them in production.
  if (src) {
    return (
      <Image
        src={src}
        alt={name ?? ""}
        width={28}
        height={28}
        className="w-7 h-7 rounded-full object-cover ring-2 ring-white/20"
      />
    );
  }
  return (
    <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center ring-2 ring-white/20">
      <span className="text-white text-xs font-bold">{initials}</span>
    </div>
  );
}

export default function TopBar({
  userName,
  userEmail,
  userAvatar,
  userId,
  isAdmin,
  role = "staff",
  permissions = [],
  notificationCount = 0,
  hasActiveChecklists = true,
}: TopBarProps) {
  const [showMore, setShowMore] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const pathname = usePathname();

  // Listen for the BottomNav "More" button event
  useEffect(() => {
    const handler = () => setShowMore(true);
    window.addEventListener("openMobileMenu", handler);
    return () => window.removeEventListener("openMobileMenu", handler);
  }, []);

  const title = getPageTitle(pathname);

  const roleBadge = role === "admin" ? "Admin" : role === "manager" ? "Manager" : role === "finance" ? "Finance" : null;

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
          {/* Profile avatar button */}
          <button
            onClick={() => setShowProfile(true)}
            className="p-1.5 rounded-xl hover:bg-white/10 transition-colors"
            style={{ touchAction: "manipulation" }}
          >
            <Avatar src={userAvatar} name={userName} />
          </button>
        </div>
      </header>

      {/* Profile slide-up sheet */}
      {showProfile && (
        <>
          <div className="md:hidden fixed inset-0 bg-black/50 z-50" onClick={() => setShowProfile(false)} />
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl pb-safe">
            {/* Header */}
            <div className="flex items-center gap-4 px-6 py-5 border-b border-[#ECE3DF]">
              {userAvatar ? (
                <Image
                  src={userAvatar}
                  alt={userName ?? ""}
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded-full object-cover ring-2 ring-[#ECE3DF]"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-[#223149] flex items-center justify-center">
                  <span className="text-white text-base font-bold">
                    {userName ? userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "?"}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[#223149] truncate" style={{ fontFamily: "var(--font-league-spartan)" }}>
                  {userName}
                </p>
                <p className="text-sm text-[#50676E] truncate">{userEmail}</p>
                {roleBadge && (
                  <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#223149]/10 text-[#223149]">
                    {roleBadge}
                  </span>
                )}
              </div>
              <button onClick={() => setShowProfile(false)} className="p-2 rounded-xl hover:bg-[#F8F6F4] flex-shrink-0">
                <X className="w-5 h-5 text-[#50676E]" />
              </button>
            </div>
            {/* Actions */}
            <div className="px-4 py-3">
              {userId && (
                <Link
                  href={`/dashboard/staff/${userId}`}
                  onClick={() => setShowProfile(false)}
                  className="flex items-center gap-4 px-4 py-3.5 rounded-xl text-[#50676E] hover:bg-[#F8F6F4] transition-colors"
                >
                  <User className="w-5 h-5" />
                  <span className="font-medium">View my profile</span>
                </Link>
              )}
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

      {/* More slide-up sheet */}
      {showMore && (
        <>
          <div className="md:hidden fixed inset-0 bg-black/50 z-50" onClick={() => setShowMore(false)} />
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl pb-safe">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#ECE3DF]">
              <p className="font-bold text-[#223149]" style={{ fontFamily: "var(--font-league-spartan)" }}>Menu</p>
              <button onClick={() => setShowMore(false)} className="p-2 rounded-xl hover:bg-[#F8F6F4]">
                <X className="w-5 h-5 text-[#50676E]" />
              </button>
            </div>
            <div className="px-4 py-3 space-y-1">
              {visibleMoreItems({ isAdmin, permissions, hasActiveChecklists })
                .map(item => {
                  const Icon = item.icon;
                  const isActive = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setShowMore(false)}
                      className={`flex items-center gap-4 px-4 py-3.5 rounded-xl transition-colors ${
                        isActive ? "bg-[#223149]/5 text-[#223149]" : "text-[#50676E] hover:bg-[#F8F6F4]"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  );
                })}
            </div>
          </div>
        </>
      )}
    </>
  );
}
