"use client";

import { useEffect, useState } from "react";
import { Users, Check, Search } from "lucide-react";

interface Props {
  value: string[] | null; // null = all staff
  onChange: (value: string[] | null) => void;
}

export default function StaffSignoffSelector({ value, onChange }: Props) {
  const [staff, setStaff] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"all" | "specific">(value === null ? "all" : "specific");

  useEffect(() => {
    fetch("/api/staff")
      .then((r) => r.json())
      .then((d) => setStaff(Array.isArray(d) ? d.filter((s: any) => s.is_active) : []));
  }, []);

  const toggleMode = (newMode: "all" | "specific") => {
    setMode(newMode);
    if (newMode === "all") onChange(null);
    else onChange([]);
  };

  const toggleStaff = (id: string) => {
    if (value === null) return;
    const next = value.includes(id) ? value.filter((v) => v !== id) : [...value, id];
    onChange(next);
  };

  const selectAll = () => onChange(staff.map((s) => s.id));
  const clearAll = () => onChange([]);

  const filtered = staff.filter(
    (s) =>
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-3">
      {/* Mode toggle */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => toggleMode("all")}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-colors text-left ${
            mode === "all"
              ? "border-[#223149] bg-[#223149]/5"
              : "border-[#ECE3DF] hover:border-[#9BADB7]"
          }`}
        >
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${mode === "all" ? "bg-[#223149]" : "bg-[#ECE3DF]"}`}>
            <Users className={`w-3.5 h-3.5 ${mode === "all" ? "text-white" : "text-[#9BADB7]"}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#223149]">All Staff</p>
            <p className="text-xs text-[#9BADB7]">Everyone signs</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => toggleMode("specific")}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-colors text-left ${
            mode === "specific"
              ? "border-[#223149] bg-[#223149]/5"
              : "border-[#ECE3DF] hover:border-[#9BADB7]"
          }`}
        >
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${mode === "specific" ? "bg-[#223149]" : "bg-[#ECE3DF]"}`}>
            <Check className={`w-3.5 h-3.5 ${mode === "specific" ? "text-white" : "text-[#9BADB7]"}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#223149]">Specific Staff</p>
            <p className="text-xs text-[#9BADB7]">Choose who signs</p>
          </div>
        </button>
      </div>

      {/* Staff list */}
      {mode === "specific" && (
        <div className="border border-[#ECE3DF] rounded-xl overflow-hidden">
          {/* Search + select all */}
          <div className="p-3 border-b border-[#ECE3DF] space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9BADB7]" />
              <input
                type="text"
                placeholder="Search staff..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-[#ECE3DF] text-[#223149] placeholder:text-[#9BADB7] focus:outline-none focus:border-[#223149] transition-colors"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#9BADB7]">
                {value?.length || 0} of {staff.length} selected
              </span>
              <div className="flex gap-2">
                <button type="button" onClick={selectAll} className="text-xs font-semibold text-[#223149] hover:underline">
                  Select all
                </button>
                <span className="text-[#9BADB7]">·</span>
                <button type="button" onClick={clearAll} className="text-xs font-semibold text-[#5F7C84] hover:underline">
                  Clear
                </button>
              </div>
            </div>
          </div>

          {/* Staff items */}
          <div className="max-h-52 overflow-y-auto divide-y divide-[#ECE3DF]">
            {filtered.map((s) => {
              const isSelected = value?.includes(s.id) ?? false;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleStaff(s.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    isSelected ? "bg-[#223149]/5" : "hover:bg-[#F8F6F4]"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    isSelected ? "bg-[#223149] border-[#223149]" : "border-[#9BADB7]"
                  }`}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div className="w-7 h-7 rounded-full bg-[#223149] flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">
                      {s.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#223149] truncate">{s.full_name}</p>
                    <p className="text-xs text-[#9BADB7] truncate">{s.position || s.department || s.email}</p>
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="px-4 py-6 text-sm text-[#9BADB7] text-center">No staff found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
