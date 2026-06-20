"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { BOTTOM_NAV_ITEMS } from "@/lib/nav";

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#ECE3DF] flex items-stretch pb-safe">
      {BOTTOM_NAV_ITEMS.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] transition-colors",
              isActive ? "text-[#223149]" : "text-[#50676E]"
            )}
          >
            <Icon className={cn("w-5 h-5", isActive && "stroke-[2.5px]")} />
            <span className={cn("text-[10px] font-medium", isActive && "font-bold")}>
              {tab.tabLabel ?? tab.label}
            </span>
            {isActive && (
              <span className="absolute bottom-0 w-8 h-0.5 bg-[#223149] rounded-full" />
            )}
          </Link>
        );
      })}
      {/* More tab — fires a custom event that TopBar listens to */}
      <button
        onClick={() => window.dispatchEvent(new Event("openMobileMenu"))}
        className="flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] text-[#50676E] transition-colors active:text-[#223149] cursor-pointer"
        style={{ touchAction: "manipulation" }}
      >
        <MoreHorizontal className="w-5 h-5" />
        <span className="text-[10px] font-medium">More</span>
      </button>
    </nav>
  );
}
