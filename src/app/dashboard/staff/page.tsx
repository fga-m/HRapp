import { supabaseAdmin } from "@/lib/supabase";
import Link from "next/link";
import { UserPlus, Users } from "lucide-react";
import StaffListClient from "@/components/staff/StaffListClient";
import PageSubtitle from "@/components/PageSubtitle";

export const dynamic = "force-dynamic";

async function getStaff() {
  const { data, error } = await supabaseAdmin
    .from("staff")
    .select("*")
    .order("full_name");
  if (error) throw error;
  return data;
}

async function getRoleMeta(): Promise<Record<string, { label: string; is_admin: boolean }>> {
  const { data } = await supabaseAdmin.from("roles").select("key, label, is_admin");
  return Object.fromEntries(
    (data ?? []).map((r: { key: string; label: string; is_admin: boolean }) => [r.key, { label: r.label, is_admin: r.is_admin }])
  );
}

export default async function StaffPage() {
  const staff = await getStaff();
  const roleMeta = await getRoleMeta();
  const activeStaff = staff.filter((s: any) => s.is_active);
  const inactiveStaff = staff.filter((s: any) => !s.is_active);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#223149]">Staff</h1>
          <p className="text-[#50676E] mt-1 text-sm">
            {activeStaff.length} active staff member{activeStaff.length !== 1 ? "s" : ""}
          </p>
          <PageSubtitle pageKey="staff" defaultDescription="View and manage profiles, documents, and details for all staff members." />
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/staff/import"
            title="Import staff from Google Workspace"
            aria-label="Import staff from Google Workspace"
            className="flex items-center gap-2 px-3 py-2.5 border border-[#223149] text-[#223149] rounded-xl text-sm font-semibold hover:bg-[#F8F6F4] transition-colors"
          >
            <Users className="w-4 h-4" />
            <span className="sm:hidden">Import</span>
            <span className="hidden sm:inline">Import from Google</span>
          </Link>
          <Link
            href="/dashboard/staff/new"
            title="Add staff member"
            aria-label="Add staff member"
            className="flex items-center gap-2 px-3 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span className="sm:hidden">Add</span>
            <span className="hidden sm:inline">Add Staff</span>
          </Link>
        </div>
      </div>

      <StaffListClient activeStaff={activeStaff} inactiveStaff={inactiveStaff} roleMeta={roleMeta} />
    </div>
  );
}
