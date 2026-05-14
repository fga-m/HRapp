import { supabaseAdmin } from "@/lib/supabase";
import Link from "next/link";
import { UserPlus, Mail, Building2, Shield, User, Download } from "lucide-react";

export const dynamic = "force-dynamic";

async function getStaff() {
  const { data, error } = await supabaseAdmin
    .from("staff")
    .select("*")
    .order("full_name");
  if (error) throw error;
  return data;
}

export default async function StaffPage() {
  const staff = await getStaff();
  const activeStaff = staff.filter((s: any) => s.is_active);
  const inactiveStaff = staff.filter((s: any) => !s.is_active);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#223149]">Staff</h1>
          <p className="text-[#5F7C84] mt-1 text-sm">
            {activeStaff.length} active staff member{activeStaff.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/staff/import"
            className="flex items-center gap-2 px-3 py-2.5 border border-[#223149] text-[#223149] rounded-xl text-sm font-semibold hover:bg-[#F8F6F4] transition-colors"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Import from Google</span>
          </Link>
          <Link
            href="/dashboard/staff/new"
            className="flex items-center gap-2 px-3 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Staff</span>
          </Link>
        </div>
      </div>

      {/* Active Staff */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[#ECE3DF]">
          <h2 className="font-semibold text-[#223149]">Active Staff</h2>
        </div>
        {activeStaff.length === 0 ? (
          <div className="px-6 py-12 text-center text-[#9BADB7]">
            No staff yet. Add your first staff member!
          </div>
        ) : (
          <div className="divide-y divide-[#ECE3DF]">
            {activeStaff.map((member: any) => (
              <Link
                key={member.id}
                href={`/dashboard/staff/${member.id}`}
                className="flex items-center gap-4 px-6 py-4 hover:bg-[#F8F6F4] transition-colors group"
              >
                <div className="w-10 h-10 rounded-full bg-[#223149] flex items-center justify-center flex-shrink-0">
                  {member.avatar_url ? (
                    <img src={member.avatar_url} alt={member.full_name} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <span className="text-white text-sm font-bold">
                      {member.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-[#223149] group-hover:text-[#5F7C84] transition-colors truncate">
                      {member.full_name}
                    </p>
                    {member.role === "admin" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#223149] text-white flex-shrink-0">
                        <Shield className="w-3 h-3" />
                        Admin
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-0.5">
                    {member.position && (
                      <span className="flex items-center gap-1 text-xs text-[#9BADB7]">
                        <User className="w-3 h-3" />
                        {member.position}
                      </span>
                    )}
                    {member.department && (
                      <span className="flex items-center gap-1 text-xs text-[#9BADB7]">
                        <Building2 className="w-3 h-3" />
                        {member.department}
                      </span>
                    )}
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-1 text-sm text-[#9BADB7]">
                  <Mail className="w-3.5 h-3.5" />
                  {member.email}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Inactive Staff */}
      {inactiveStaff.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden opacity-60">
          <div className="px-6 py-4 border-b border-[#ECE3DF]">
            <h2 className="font-semibold text-[#223149]">Inactive / Offboarded ({inactiveStaff.length})</h2>
          </div>
          <div className="divide-y divide-[#ECE3DF]">
            {inactiveStaff.map((member: any) => (
              <Link
                key={member.id}
                href={`/dashboard/staff/${member.id}`}
                className="flex items-center gap-4 px-6 py-4 hover:bg-[#F8F6F4] transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-[#9BADB7] flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-sm font-bold">
                    {member.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-[#223149]">{member.full_name}</p>
                  <p className="text-xs text-[#9BADB7]">{member.email}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
