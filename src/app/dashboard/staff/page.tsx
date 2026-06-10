import { supabaseAdmin } from "@/lib/supabase";
import Link from "next/link";
import { UserPlus, Download } from "lucide-react";
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
          <PageSubtitle pageKey="staff" defaultDescription="View and manage profiles, documents, and details for all staff members." />
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

      <StaffListClient activeStaff={activeStaff} inactiveStaff={inactiveStaff} />
    </div>
  );
}
