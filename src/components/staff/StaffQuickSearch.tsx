"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

interface StaffMember {
  id: string;
  full_name: string;
}

export default function StaffQuickSearch({ staffList }: { staffList: StaffMember[] }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const filtered = query.trim()
    ? staffList.filter((s) => s.full_name.toLowerCase().includes(query.toLowerCase().trim())).slice(0, 8)
    : [];

  // Close on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const go = (id: string) => {
    setOpen(false);
    setQuery("");
    router.push(`/dashboard/staff/${id}`);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#ECE3DF] bg-white hover:border-[#9BADB7] transition-colors w-44 sm:w-56">
        <Search className="w-3.5 h-3.5 text-[#50676E] flex-shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setOpen(false); setQuery(""); }
            if (e.key === "Enter" && filtered.length > 0) go(filtered[0].id);
          }}
          placeholder="Jump to staff…"
          className="flex-1 text-sm text-[#223149] placeholder:text-[#6E8189] focus:outline-none bg-transparent min-w-0"
        />
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute top-full mt-1 right-0 w-64 bg-white rounded-xl border border-[#ECE3DF] shadow-lg z-50 overflow-hidden">
          {filtered.map((s) => (
            <button
              key={s.id}
              onMouseDown={() => go(s.id)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[#F8F6F4] transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-[#223149] flex items-center justify-center flex-shrink-0">
                <span className="text-white text-[10px] font-bold">
                  {s.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </span>
              </div>
              <span className="text-sm text-[#223149] truncate">{s.full_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
