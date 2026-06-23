"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Mail, Building2, Shield, User, X } from "lucide-react";

interface StaffMember {
  id: string;
  full_name: string;
  email: string;
  position: string | null;
  department: string | null;
  role: string;
  roles?: string[] | null;
  avatar_url: string | null;
  is_active: boolean;
}

type RoleMeta = Record<string, { label: string; is_admin: boolean }>;

interface Props {
  activeStaff: StaffMember[];
  inactiveStaff: StaffMember[];
  roleMeta?: RoleMeta;
}

function Avatar({ member }: { member: StaffMember }) {
  const initials = member.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2);
  if (member.avatar_url) {
    return <img src={member.avatar_url} alt={member.full_name} className="w-10 h-10 rounded-full object-cover" />;
  }
  return (
    <span className="text-white text-sm font-bold">{initials}</span>
  );
}

// Colour per role key; custom/unknown roles get a neutral slate.
const ROLE_BADGE_CLS: Record<string, string> = {
  admin: "bg-[#223149] text-white",
  manager: "bg-[#5F7C84] text-white",
  finance: "bg-[#2E7D52] text-white",
  leave_approver: "bg-[#7C5C8A] text-white",
};

function RoleBadges({ member, roleMeta }: { member: StaffMember; roleMeta: RoleMeta }) {
  const roles = member.roles && member.roles.length > 0 ? member.roles : member.role ? [member.role] : [];
  // The baseline "staff" role applies to everyone, so don't badge it.
  const shown = roles.filter((r) => r !== "staff");
  if (shown.length === 0) return null;
  return (
    <>
      {shown.map((r) => {
        const meta = roleMeta[r];
        const label = meta?.label ?? r;
        const isAdmin = meta?.is_admin ?? r === "admin";
        return (
          <span
            key={r}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${ROLE_BADGE_CLS[r] ?? "bg-[#50676E] text-white"}`}
          >
            {isAdmin && <Shield className="w-3 h-3" />}
            {label}
          </span>
        );
      })}
    </>
  );
}

export default function StaffListClient({ activeStaff, inactiveStaff, roleMeta = {} }: Props) {
  const [query, setQuery] = useState("");

  const q = query.toLowerCase().trim();
  const filter = (list: StaffMember[]) =>
    q
      ? list.filter(
          (s) =>
            s.full_name.toLowerCase().includes(q) ||
            s.email.toLowerCase().includes(q) ||
            s.position?.toLowerCase().includes(q) ||
            s.department?.toLowerCase().includes(q)
        )
      : list;

  const filteredActive = filter(activeStaff);
  const filteredInactive = filter(inactiveStaff);
  const hasResults = filteredActive.length > 0 || filteredInactive.length > 0;

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#50676E] pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email, role or department…"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#ECE3DF] bg-white text-[#223149] placeholder:text-[#6E8189] text-sm focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            aria-label="Clear search"
            title="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#50676E] hover:text-[#223149] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* No results */}
      {q && !hasResults && (
        <div className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm px-6 py-10 text-center text-[#50676E] text-sm">
          No staff found matching "{query}"
        </div>
      )}

      {/* Active Staff */}
      {filteredActive.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#ECE3DF] flex items-center justify-between">
            <h2 className="font-semibold text-[#223149]">Active Staff</h2>
            {q && <span className="text-xs text-[#50676E]">{filteredActive.length} result{filteredActive.length !== 1 ? "s" : ""}</span>}
          </div>
          <div className="divide-y divide-[#ECE3DF]">
            {filteredActive.map((member) => (
              <Link
                key={member.id}
                href={`/dashboard/staff/${member.id}`}
                className="flex items-center gap-4 px-6 py-4 hover:bg-[#F8F6F4] transition-colors group"
              >
                <div className="w-10 h-10 rounded-full bg-[#223149] flex items-center justify-center flex-shrink-0">
                  <Avatar member={member} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-[#223149] group-hover:text-[#50676E] transition-colors truncate">
                      {member.full_name}
                    </p>
                    <RoleBadges member={member} roleMeta={roleMeta} />
                  </div>
                  <div className="flex items-center gap-4 mt-0.5">
                    {member.position && (
                      <span className="flex items-center gap-1 text-xs text-[#50676E]">
                        <User className="w-3 h-3" />
                        {member.position}
                      </span>
                    )}
                    {member.department && (
                      <span className="flex items-center gap-1 text-xs text-[#50676E]">
                        <Building2 className="w-3 h-3" />
                        {member.department}
                      </span>
                    )}
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-1 text-sm text-[#50676E]">
                  <Mail className="w-3.5 h-3.5" />
                  {member.email}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Inactive Staff */}
      {filteredInactive.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm overflow-hidden opacity-60">
          <div className="px-6 py-4 border-b border-[#ECE3DF] flex items-center justify-between">
            <h2 className="font-semibold text-[#223149]">
              Former staff ({filteredInactive.length})
            </h2>
          </div>
          <div className="divide-y divide-[#ECE3DF]">
            {filteredInactive.map((member) => (
              <Link
                key={member.id}
                href={`/dashboard/staff/${member.id}`}
                className="flex items-center gap-4 px-6 py-4 hover:bg-[#F8F6F4] transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-[#9BADB7] flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-sm font-bold">
                    {member.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-[#223149]">{member.full_name}</p>
                  <p className="text-xs text-[#50676E]">{member.email}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
