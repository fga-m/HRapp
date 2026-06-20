import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  Calendar, FileText, Shield, CheckSquare,
  BookOpen, Bell, Users, AlertCircle, ChevronRight,
  Palmtree, FileArchive, FileSignature,
} from "lucide-react";
import PageSubtitle from "@/components/PageSubtitle";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/");

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, full_name, role")
    .eq("email", session.user?.email ?? "")
    .single();

  if (!caller) redirect("/");

  const isAdmin = caller.role === "admin";
  const firstName = caller.full_name?.split(" ")[0] ?? "there";
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const today      = new Date().toISOString().split("T")[0];
  const in30Days   = new Date(Date.now() + 30 * 86_400_000).toISOString().split("T")[0];

  // ── Parallel data fetches ────────────────────────────────────────────────
  const [
    staffRes,
    activeStaffIdsRes,
    allPoliciesRes,
    allSignoffsRes,
    mySignoffsRes,
    checklistsRes,
    unreadRes,
    meetingNotesRes,
    pendingLeaveRes,
    expiredDocsRes,
    expiringDocsRes,
    unsignedContractsRes,
  ] = await Promise.all([
    // Active staff count
    supabaseAdmin.from("staff").select("*", { count: "exact", head: true }).eq("is_active", true),

    // Active staff IDs (for "all staff must sign" policies)
    supabaseAdmin.from("staff").select("id").eq("is_active", true),

    // Active policies requiring sign-off
    supabaseAdmin.from("policies")
      .select("id, title, required_signatories")
      .eq("requires_signoff", true)
      .eq("is_active", true),

    // All policy signoffs (to compute pending counts)
    supabaseAdmin.from("policy_signoffs").select("policy_id, staff_id"),

    // My own signoffs
    supabaseAdmin.from("policy_signoffs").select("policy_id").eq("staff_id", caller.id),

    // Active checklists — admin sees all, staff sees own
    isAdmin
      ? supabaseAdmin.from("staff_checklists").select("*", { count: "exact", head: true })
      : supabaseAdmin.from("staff_checklists").select("*", { count: "exact", head: true }).eq("staff_id", caller.id),

    // My unread notifications
    supabaseAdmin.from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("staff_id", caller.id)
      .eq("is_read", false),

    // Meeting notes this month — same filter as the meetings page
    isAdmin
      ? supabaseAdmin.from("meeting_notes")
          .select("*", { count: "exact", head: true })
          .eq("created_by", caller.id)
          .gte("created_at", monthStart)
      : supabaseAdmin.from("meeting_notes")
          .select("*", { count: "exact", head: true })
          .eq("is_shared_with_staff", true)
          .contains("attendees", [caller.id])
          .gte("created_at", monthStart),

    // Pending leave approvals (admin only)
    isAdmin
      ? supabaseAdmin.from("leave_requests")
          .select("*", { count: "exact", head: true })
          .eq("status", "PENDING")
      : Promise.resolve({ count: 0 }),

    // Expired staff documents (admin only) — list with names for the alert
    isAdmin
      ? supabaseAdmin.from("staff_documents")
          .select("id, title, expiry_date, staff:staff_id(full_name)")
          .lt("expiry_date", today)
          .order("expiry_date", { ascending: true })
          .limit(5)
      : Promise.resolve({ data: [] }),

    // Documents expiring within 30 days (admin only)
    isAdmin
      ? supabaseAdmin.from("staff_documents")
          .select("id, title, expiry_date, staff:staff_id(full_name)")
          .gte("expiry_date", today)
          .lte("expiry_date", in30Days)
          .order("expiry_date", { ascending: true })
          .limit(5)
      : Promise.resolve({ data: [] }),

    // Unsigned contracts — assigned but not yet signed (admin only)
    isAdmin
      ? supabaseAdmin.from("contract_assignments")
          .select("id", { count: "exact", head: true })
          .not("contract_id", "in",
            `(SELECT contract_id FROM contract_signatures WHERE staff_id = contract_assignments.staff_id)`)
      : Promise.resolve({ count: 0 }),
  ]);

  // ── Compute pending sign-offs ────────────────────────────────────────────
  const activeStaffIds = new Set((activeStaffIdsRes.data ?? []).map((s: any) => s.id));
  const mySignedIds = new Set((mySignoffsRes.data ?? []).map((s: any) => s.policy_id));
  const allPolicies = allPoliciesRes.data ?? [];

  // signoffsByPolicy: policyId → Set of staff_ids who signed
  const signoffsByPolicy = new Map<string, Set<string>>();
  for (const s of allSignoffsRes.data ?? []) {
    if (!signoffsByPolicy.has(s.policy_id)) signoffsByPolicy.set(s.policy_id, new Set());
    signoffsByPolicy.get(s.policy_id)!.add(s.staff_id);
  }

  const pendingPolicies = allPolicies.filter((p: any) => {
    if (isAdmin) {
      // Policy has outstanding signoffs if any required person hasn't signed
      const required: Set<string> =
        p.required_signatories?.length > 0
          ? new Set(p.required_signatories)
          : activeStaffIds;
      const signed = signoffsByPolicy.get(p.id) ?? new Set();
      for (const id of required) { if (!signed.has(id)) return true; }
      return false;
    } else {
      // Staff: am I required to sign and haven't yet?
      const isRequired =
        !p.required_signatories?.length || p.required_signatories.includes(caller.id);
      return isRequired && !mySignedIds.has(p.id);
    }
  });

  const pendingCount = pendingPolicies.length;

  // How many people are still pending on the top alert policy (admin only)
  const alertPolicy = pendingPolicies[0] ?? null;
  const alertPendingCount = alertPolicy
    ? (() => {
        const required: Set<string> =
          alertPolicy.required_signatories?.length > 0
            ? new Set(alertPolicy.required_signatories)
            : activeStaffIds;
        const signed = signoffsByPolicy.get(alertPolicy.id) ?? new Set();
        let n = 0;
        for (const id of required) { if (!signed.has(id)) n++; }
        return n;
      })()
    : 0;

  // ── Admin-only aggregates ────────────────────────────────────────────────
  const pendingLeaveCount   = (pendingLeaveRes as any).count ?? 0;
  const expiredDocs         = (expiredDocsRes as any).data ?? [];
  const expiringDocs        = (expiringDocsRes as any).data ?? [];
  const docIssueCount       = expiredDocs.length + expiringDocs.length;
  const unsignedCount       = (unsignedContractsRes as any).count ?? 0;

  // ── Build stats ──────────────────────────────────────────────────────────
  const stats = isAdmin
    ? [
        { label: "Active Staff",               value: staffRes.count ?? 0,        icon: Users,          href: "/dashboard/staff",         warn: false },
        { label: "Pending Leave Approvals",    value: pendingLeaveCount,           icon: Palmtree,       href: "/dashboard/leave",         warn: pendingLeaveCount > 0 },
        { label: "Policies Pending Sign-off",  value: pendingCount,               icon: Shield,         href: "/dashboard/policies",      warn: pendingCount > 0 },
        { label: "Active Checklists",          value: checklistsRes.count ?? 0,   icon: CheckSquare,    href: "/dashboard/onboarding",    warn: false },
        { label: "Document Issues",            value: docIssueCount,              icon: FileArchive,    href: "/dashboard/staff",         warn: docIssueCount > 0 },
        { label: "Unsigned Contracts",         value: unsignedCount,              icon: FileSignature,  href: "/dashboard/contracts",     warn: unsignedCount > 0 },
      ]
    : [
        { label: "Unsigned Policies",          value: pendingCount,               icon: Shield,         href: "/dashboard/policies",      warn: pendingCount > 0 },
        { label: "My Checklists",              value: checklistsRes.count ?? 0,   icon: CheckSquare,    href: "/dashboard/onboarding",    warn: false },
        { label: "Unread Notifications",       value: unreadRes.count ?? 0,       icon: Bell,           href: "/dashboard/notifications", warn: (unreadRes.count ?? 0) > 0 },
        { label: "Meeting Notes This Month",   value: meetingNotesRes.count ?? 0, icon: FileText,       href: "/dashboard/meetings",      warn: false },
      ];

  const quickLinks = isAdmin
    ? [
        { label: "View Calendars",    href: "/dashboard/calendar",     icon: Calendar,  description: "See when staff are working" },
        { label: "Leave Requests",    href: "/dashboard/leave",        icon: Palmtree,  description: pendingLeaveCount > 0 ? `${pendingLeaveCount} pending approval${pendingLeaveCount === 1 ? "" : "s"}` : "Review leave requests" },
        { label: "Manage Policies",   href: "/dashboard/policies",     icon: Shield,    description: "View sign-off status" },
        { label: "Staff Hub",         href: "/dashboard/hub",          icon: BookOpen,  description: "Documents & links" },
      ]
    : [
        { label: "View Calendars",    href: "/dashboard/calendar",     icon: Calendar,  description: "See when staff are working" },
        { label: "New Meeting Note",  href: "/dashboard/meetings/new", icon: FileText,  description: "Create a meeting note" },
        { label: "Manage Policies",   href: "/dashboard/policies",     icon: Shield,    description: "View sign-off status" },
        { label: "Staff Hub",         href: "/dashboard/hub",          icon: BookOpen,  description: "Documents & links" },
      ];

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-3xl font-bold text-[#223149]">
          Welcome back, {firstName} 👋
        </h1>
        <p className="text-[#5F7C84] mt-1">{format(new Date(), "EEEE, d MMMM yyyy")}</p>
        <PageSubtitle pageKey="dashboard" defaultDescription="Your overview of today's alerts, pending actions, and quick links." />
      </div>

      {/* ── Alert banners ───────────────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Expired documents — red (most urgent) */}
        {isAdmin && expiredDocs.length > 0 && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-800">
                {expiredDocs.length} staff document{expiredDocs.length === 1 ? "" : "s"} {expiredDocs.length === 1 ? "has" : "have"} expired
              </p>
              <ul className="mt-1 space-y-0.5">
                {expiredDocs.map((d: any) => (
                  <li key={d.id} className="text-xs text-red-700 truncate">
                    {(d.staff as any)?.full_name} — {d.title}
                    {d.expiry_date && ` (expired ${format(new Date(d.expiry_date), "d MMM yyyy")})`}
                  </li>
                ))}
              </ul>
              <Link href="/dashboard/staff" className="inline-flex items-center gap-0.5 text-xs text-red-600 underline mt-1.5">
                View staff profiles <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        )}

        {/* Documents expiring soon — amber */}
        {isAdmin && expiringDocs.length > 0 && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800">
                {expiringDocs.length} document{expiringDocs.length === 1 ? "" : "s"} expiring within 30 days
              </p>
              <ul className="mt-1 space-y-0.5">
                {expiringDocs.map((d: any) => (
                  <li key={d.id} className="text-xs text-amber-700 truncate">
                    {(d.staff as any)?.full_name} — {d.title}
                    {d.expiry_date && ` (expires ${format(new Date(d.expiry_date), "d MMM yyyy")})`}
                  </li>
                ))}
              </ul>
              <Link href="/dashboard/staff" className="inline-flex items-center gap-0.5 text-xs text-amber-600 underline mt-1.5">
                View staff profiles <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        )}

        {/* Pending leave approvals — amber */}
        {isAdmin && pendingLeaveCount > 0 && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800">
                {pendingLeaveCount} leave request{pendingLeaveCount === 1 ? "" : "s"} awaiting approval
              </p>
              <Link href="/dashboard/leave" className="inline-flex items-center gap-0.5 text-xs text-amber-600 underline mt-1">
                Review requests <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        )}

        {/* Policy sign-offs — amber */}
        {alertPolicy && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800">
                {isAdmin
                  ? `${pendingCount} ${pendingCount === 1 ? "policy has" : "policies have"} outstanding sign-offs`
                  : `You have ${pendingCount} unsigned ${pendingCount === 1 ? "policy" : "policies"}`}
              </p>
              <p className="text-xs text-amber-700 mt-0.5 truncate">
                {isAdmin
                  ? `"${alertPolicy.title}" — ${alertPendingCount} ${alertPendingCount === 1 ? "person" : "people"} yet to sign`
                  : `"${alertPolicy.title}" is waiting for your signature`}
              </p>
              <Link href="/dashboard/policies" className="inline-flex items-center gap-0.5 text-xs text-amber-600 underline mt-1">
                View policies <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Stats grid — 6 cards for admin, 4 for staff */}
      <div className={`grid gap-3 md:gap-4 ${isAdmin ? "grid-cols-2 lg:grid-cols-3" : "grid-cols-2 lg:grid-cols-4"}`}>
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="bg-white rounded-2xl p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-4 shadow-sm hover:shadow-md transition-shadow group"
            >
              <div className={`w-9 h-9 md:w-11 md:h-11 rounded-xl flex items-center justify-center group-hover:bg-[#223149] transition-colors flex-shrink-0 ${
                stat.warn ? "bg-amber-100" : "bg-[#ECE3DF]"
              }`}>
                <Icon className={`w-4 h-4 md:w-5 md:h-5 group-hover:text-white transition-colors ${
                  stat.warn ? "text-amber-600" : "text-[#223149]"
                }`} />
              </div>
              <div>
                <p className={`text-2xl font-bold ${stat.warn ? "text-amber-600" : "text-[#223149]"}`}>
                  {stat.value}
                </p>
                <p className="text-xs text-[#5F7C84] leading-tight">{stat.label}</p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-lg font-bold text-[#223149] mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
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
