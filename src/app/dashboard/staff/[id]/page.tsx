import { supabaseAdmin } from "@/lib/supabase";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Mail, Building2, User, Calendar, Shield, Edit, ExternalLink, FileSignature, CheckCircle, Clock, Clock3 } from "lucide-react";
import ScheduleCard from "@/components/staff/ScheduleCard";
import PerformanceNotesCard from "@/components/staff/PerformanceNotesCard";
import LeaveBalancesCard from "@/components/staff/LeaveBalancesCard";
import StaffQuickSearch from "@/components/staff/StaffQuickSearch";
import StaffContractUpload from "@/components/staff/StaffContractUpload";

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

  // Fetch ordered staff list for prev/next navigation
  const { data: allStaff } = await supabaseAdmin
    .from("staff")
    .select("id, full_name")
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  const staffList = allStaff ?? [];
  const currentIndex = staffList.findIndex((s: any) => s.id === id);
  const prevStaff = currentIndex > 0 ? staffList[currentIndex - 1] : null;
  const nextStaff = currentIndex < staffList.length - 1 ? staffList[currentIndex + 1] : null;

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

  // Fetch contract assignments for this staff member (shown to admin or own profile)
  const canSeeContracts = caller?.role === "admin" || caller?.id === id || isManager;

  let contractRows: Array<{
    group_id: string | null;
    group_title: string;
    current_version: {
      contract_id: string;
      version: number;
      file_name: string;
      signed_at: string | null;
    };
  }> = [];

  if (canSeeContracts) {
    const { data: contractAssignments } = await supabaseAdmin
      .from("contract_assignments")
      .select(`
        contract_id,
        contracts!inner(id, title, version, group_id, is_active,
          contract_groups(id, title))
      `)
      .eq("staff_id", id)
      .eq("contracts.is_active", true);

    const { data: signatures } = await supabaseAdmin
      .from("contract_signatures")
      .select("contract_id, name_as_typed, signed_at")
      .eq("staff_id", id);

    const sigMap = new Map((signatures ?? []).map((s: any) => [s.contract_id, s]));

    // Group by group_id, pick highest version per group
    const groupMap = new Map<string, typeof contractRows[number]>();
    const standaloneList: typeof contractRows = [];

    for (const a of contractAssignments ?? []) {
      const contract = a.contracts as any;
      if (!contract) continue;

      const sig = sigMap.get(a.contract_id) ?? null;
      const entry = {
        group_id: contract.group_id ?? null,
        group_title: contract.contract_groups?.title ?? contract.title,
        current_version: {
          contract_id: contract.id,
          version: contract.version ?? 1,
          file_name: contract.title,
          signed_at: sig?.signed_at ?? null,
        },
      };

      if (contract.group_id) {
        const existing = groupMap.get(contract.group_id);
        if (!existing || contract.version > existing.current_version.version) {
          groupMap.set(contract.group_id, entry);
        }
      } else {
        standaloneList.push(entry);
      }
    }

    contractRows = [...groupMap.values(), ...standaloneList];
  }

  const initials = member.full_name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/staff"
            className="p-2 rounded-xl hover:bg-[#ECE3DF] transition-colors"
            title="Back to staff list"
          >
            <ArrowLeft className="w-5 h-5 text-[#223149]" />
          </Link>
          <h1 className="text-3xl font-bold text-[#223149]">Staff Profile</h1>
        </div>

        {/* Quick-jump search */}
        <StaffQuickSearch staffList={staffList} />

        {/* Prev / Next navigation */}
        {staffList.length > 1 && (
          <div className="flex items-center gap-1">
            {currentIndex >= 0 && (
              <span className="text-xs text-[#9BADB7] mr-2 hidden sm:block">
                {currentIndex + 1} / {staffList.length}
              </span>
            )}
            {prevStaff ? (
              <Link
                href={`/dashboard/staff/${prevStaff.id}`}
                className="flex items-center gap-1 px-3 py-2 rounded-xl border border-[#ECE3DF] hover:bg-[#ECE3DF] transition-colors group"
                title={`Previous: ${prevStaff.full_name}`}
              >
                <ChevronLeft className="w-4 h-4 text-[#223149]" />
                <span className="text-xs font-medium text-[#5F7C84] hidden sm:block max-w-[120px] truncate">
                  {prevStaff.full_name}
                </span>
              </Link>
            ) : (
              <span className="flex items-center px-3 py-2 rounded-xl border border-[#ECE3DF] opacity-30 cursor-not-allowed">
                <ChevronLeft className="w-4 h-4 text-[#223149]" />
              </span>
            )}
            {nextStaff ? (
              <Link
                href={`/dashboard/staff/${nextStaff.id}`}
                className="flex items-center gap-1 px-3 py-2 rounded-xl border border-[#ECE3DF] hover:bg-[#ECE3DF] transition-colors group"
                title={`Next: ${nextStaff.full_name}`}
              >
                <span className="text-xs font-medium text-[#5F7C84] hidden sm:block max-w-[120px] truncate">
                  {nextStaff.full_name}
                </span>
                <ChevronRight className="w-4 h-4 text-[#223149]" />
              </Link>
            ) : (
              <span className="flex items-center px-3 py-2 rounded-xl border border-[#ECE3DF] opacity-30 cursor-not-allowed">
                <ChevronRight className="w-4 h-4 text-[#223149]" />
              </span>
            )}
          </div>
        )}
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
          {member.contracted_hours != null && (
            <div className="flex items-center gap-3 p-3 bg-[#F8F6F4] rounded-xl">
              <Clock3 className="w-4 h-4 text-[#9BADB7] flex-shrink-0" />
              <div>
                <p className="text-xs text-[#9BADB7] font-medium">Contracted Hours</p>
                <p className="text-sm text-[#223149]">{member.contracted_hours} hrs / week</p>
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

      {/* Contracts Card */}
      {canSeeContracts && (
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileSignature className="w-4 h-4 text-[#9BADB7]" />
              <h3 className="text-sm font-semibold text-[#223149]">Contracts</h3>
            </div>
            {caller?.role === "admin" && (
              <StaffContractUpload staffId={id} staffName={member.full_name} />
            )}
          </div>
          {contractRows.length === 0 ? (
            <p className="text-sm text-[#9BADB7]">No contracts assigned</p>
          ) : (
            <div className="space-y-2">
              {contractRows.map((row) => {
                const signed = !!row.current_version.signed_at;
                const contractLink = `/dashboard/contracts/${row.current_version.contract_id}`;
                return (
                  <Link
                    key={row.current_version.contract_id}
                    href={contractLink}
                    className="flex items-center justify-between gap-3 p-3 bg-[#F8F6F4] rounded-xl hover:bg-[#ECE3DF] transition-colors group"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Link
                        href={contractLink}
                        className="text-sm font-medium text-[#223149] hover:underline truncate"
                      >
                        {row.group_title}
                      </Link>
                      <span className="bg-[#ECE3DF] text-[#223149] text-xs px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0">
                        v{row.current_version.version}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {signed ? (
                        <div className="flex items-center gap-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                            <CheckCircle className="w-3 h-3" />
                            Signed
                          </span>
                          {row.current_version.signed_at && (
                            <span className="text-xs text-[#9BADB7] hidden sm:block">
                              {new Date(row.current_version.signed_at).toLocaleDateString("en-AU", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="w-3 h-3" />
                          Pending
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

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
      <LeaveBalancesCard staffId={member.id} isOwnProfile={caller?.id === id} />

      {/* Work Schedule */}
      <ScheduleCard staffId={member.id} canEdit={canEditSchedule} contractedHours={member.contracted_hours ?? undefined} />

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
