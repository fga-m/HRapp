import { supabaseAdmin } from "@/lib/supabase";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, Building2, User, Calendar, Shield, Edit, ExternalLink } from "lucide-react";
import ScheduleCard from "@/components/staff/ScheduleCard";
import PerformanceNotesCard from "@/components/staff/PerformanceNotesCard";
import LeaveBalancesCard from "@/components/staff/LeaveBalancesCard";

export const dynamic = "force-dynamic";

async function getStaffMember(id: string) {
  const { data, error } = await supabaseAdmin
    .from("staff")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return data;
}

export default async function StaffProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const member = await getStaffMember(id);
  if (!member) notFound();

  const session = await auth();
  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session?.user?.email ?? "")
    .single();

  const canEditSchedule =
    caller?.id === id ||
    caller?.role === "admin" ||
    caller?.role === "manager";

  // Check manager's manage_staff permission for performance notes
  let isManager = caller?.role === "admin";
  if (caller?.role === "manager") {
    const { data: perm } = await supabaseAdmin
      .from("role_permissions")
      .select("enabled")
      .eq("role", "manager")
      .eq("feature", "manage_staff")
      .single();
    isManager = perm?.enabled ?? false;
  }

  const initials = member.full_name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2);

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/staff"
          className="p-2 rounded-xl hover:bg-[#ECE3DF] transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-[#223149]" />
        </Link>
        <h1 className="text-3xl font-bold text-[#223149]">Staff Profile</h1>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#223149] flex items-center justify-center flex-shrink-0">
              {member.avatar_url ? (
                <img src={member.avatar_url} alt={member.full_name} className="w-16 h-16 rounded-full object-cover" />
              ) : (
                <span className="text-white text-xl font-bold">{initials}</span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-[#223149]">{member.full_name}</h2>
                {member.role === "admin" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#223149] text-white">
                    <Shield className="w-3 h-3" />
                    Admin
                  </span>
                )}
                {!member.is_active && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">
                    Inactive
                  </span>
                )}
              </div>
              {member.position && (
                <p className="text-[#5F7C84] text-sm mt-0.5">{member.position}</p>
              )}
            </div>
          </div>
          <Link
            href={`/dashboard/staff/${member.id}/edit`}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#ECE3DF] text-sm font-medium text-[#5F7C84] hover:bg-[#F8F6F4] transition-colors"
          >
            <Edit className="w-4 h-4" />
            Edit
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-3 bg-[#F8F6F4] rounded-xl">
            <Mail className="w-4 h-4 text-[#9BADB7] flex-shrink-0" />
            <div>
              <p className="text-xs text-[#9BADB7] font-medium">Email</p>
              <p className="text-sm text-[#223149]">{member.email}</p>
            </div>
          </div>
          {member.department && (
            <div className="flex items-center gap-3 p-3 bg-[#F8F6F4] rounded-xl">
              <Building2 className="w-4 h-4 text-[#9BADB7] flex-shrink-0" />
              <div>
                <p className="text-xs text-[#9BADB7] font-medium">Department</p>
                <p className="text-sm text-[#223149]">{member.department}</p>
              </div>
            </div>
          )}
          {member.position && (
            <div className="flex items-center gap-3 p-3 bg-[#F8F6F4] rounded-xl">
              <User className="w-4 h-4 text-[#9BADB7] flex-shrink-0" />
              <div>
                <p className="text-xs text-[#9BADB7] font-medium">Position</p>
                <p className="text-sm text-[#223149]">{member.position}</p>
              </div>
            </div>
          )}
          {member.google_calendar_id && (
            <div className="flex items-center gap-3 p-3 bg-[#F8F6F4] rounded-xl">
              <Calendar className="w-4 h-4 text-[#9BADB7] flex-shrink-0" />
              <div>
                <p className="text-xs text-[#9BADB7] font-medium">Google Calendar</p>
                <p className="text-sm text-[#223149] truncate">{member.google_calendar_id}</p>
              </div>
            </div>
          )}
        </div>

        {/* Xero link — admin only */}
        {caller?.role === "admin" && (
          <div className="mt-4 pt-4 border-t border-[#ECE3DF]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-[#13B5EA]/10 flex items-center justify-center">
                  <span className="text-[#13B5EA] text-[9px] font-bold">X</span>
                </div>
                <span className="text-xs font-medium text-[#9BADB7]">Xero Employee</span>
              </div>
              {member.xero_employee_id ? (
                <span className="text-xs text-[#223149] font-mono bg-[#F8F6F4] px-2 py-0.5 rounded-lg">
                  linked ✓
                </span>
              ) : (
                <Link
                  href={`/dashboard/staff/${member.id}/edit`}
                  className="text-xs text-[#13B5EA] hover:underline flex items-center gap-1"
                >
                  Link to Xero
                  <ExternalLink className="w-3 h-3" />
                </Link>
              )}
            </div>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-[#ECE3DF]">
          <p className="text-xs text-[#9BADB7]">
            Added {new Date(member.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-4">
        <Link
          href={`/dashboard/calendar?staff=${member.id}`}
          className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow flex items-center gap-3 group"
        >
          <div className="w-9 h-9 rounded-xl bg-[#ECE3DF] flex items-center justify-center group-hover:bg-[#223149] transition-colors">
            <Calendar className="w-4 h-4 text-[#223149] group-hover:text-white transition-colors" />
          </div>
          <span className="text-sm font-semibold text-[#223149]">View Calendar</span>
        </Link>
        <Link
          href={`/dashboard/meetings?staff=${member.id}`}
          className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow flex items-center gap-3 group"
        >
          <div className="w-9 h-9 rounded-xl bg-[#ECE3DF] flex items-center justify-center group-hover:bg-[#223149] transition-colors">
            <User className="w-4 h-4 text-[#223149] group-hover:text-white transition-colors" />
          </div>
          <span className="text-sm font-semibold text-[#223149]">Meeting Notes</span>
        </Link>
      </div>

      {/* Leave Balances */}
      <LeaveBalancesCard staffId={member.id} />

      {/* Work Schedule */}
      <ScheduleCard staffId={member.id} canEdit={canEditSchedule} />

      {/* Performance Notes */}
      <PerformanceNotesCard
        staffId={member.id}
        callerId={caller?.id ?? ""}
        isManager={isManager}
        isOwnProfile={caller?.id === id}
      />
    </div>
  );
}
