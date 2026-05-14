import {
  Calendar,
  FileText,
  Shield,
  CheckSquare,
  BookOpen,
  Users,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";

const stats = [
  { label: "Total Staff", value: "18", icon: Users, href: "/dashboard/staff" },
  { label: "Pending Policy Sign-offs", value: "4", icon: Shield, href: "/dashboard/policies" },
  { label: "Active Onboardings", value: "2", icon: CheckSquare, href: "/dashboard/onboarding" },
  { label: "Meeting Notes This Month", value: "7", icon: FileText, href: "/dashboard/meetings" },
];

const quickLinks = [
  { label: "View Staff Calendars", href: "/dashboard/calendar", icon: Calendar, description: "See when staff are working" },
  { label: "New Meeting Note", href: "/dashboard/meetings/new", icon: FileText, description: "Create a meeting note" },
  { label: "Manage Policies", href: "/dashboard/policies", icon: Shield, description: "View sign-off status" },
  { label: "Staff Hub", href: "/dashboard/hub", icon: BookOpen, description: "Documents & links" },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[#223149]">Good morning, Nick 👋</h1>
        <p className="text-[#5F7C84] mt-1">Here's what's happening at FGA Melbourne today.</p>
      </div>

      {/* Alert */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800">4 staff haven't signed the updated Code of Conduct</p>
          <Link href="/dashboard/policies" className="text-xs text-amber-600 underline mt-0.5 inline-block">
            View policy sign-off tracker →
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="bg-white rounded-2xl p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow group"
            >
              <div className="w-11 h-11 rounded-xl bg-[#ECE3DF] flex items-center justify-center group-hover:bg-[#223149] transition-colors">
                <Icon className="w-5 h-5 text-[#223149] group-hover:text-white transition-colors" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#223149]">{stat.value}</p>
                <p className="text-xs text-[#5F7C84]">{stat.label}</p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-lg font-bold text-[#223149] mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="bg-white rounded-2xl p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow group"
              >
                <div className="w-10 h-10 rounded-xl bg-[#223149] flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-[#223149] group-hover:text-[#5F7C84] transition-colors">
                    {link.label}
                  </p>
                  <p className="text-xs text-[#9BADB7]">{link.description}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
