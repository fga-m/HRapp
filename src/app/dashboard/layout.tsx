import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { enableStaffView, disableStaffView } from "@/app/actions/view-mode";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import BottomNav from "@/components/layout/BottomNav";
import { Eye, EyeOff } from "lucide-react";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/");

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, full_name, email, role, avatar_url")
    .eq("email", session.user?.email ?? "")
    .single();

  const isAdmin = caller?.role === "admin";
  const userName = caller?.full_name || session.user?.name || "";
  const userEmail = caller?.email || session.user?.email || "";
  const userAvatar = caller?.avatar_url || session.user?.image || "";
  const userId = caller?.id || "";

  // "View as staff" preview mode — admins only
  const cookieStore = await cookies();
  const viewAsStaff = isAdmin && cookieStore.get("fga_view_as_staff")?.value === "1";
  const effectiveIsAdmin = isAdmin && !viewAsStaff;

  // Fetch effective permissions for this user
  const { data: dbPerms } = await supabaseAdmin
    .from("role_permissions")
    .select("feature, enabled")
    .eq("role", caller?.role ?? "staff");

  const permissions: string[] = (dbPerms ?? [])
    .filter((p: any) => p.enabled)
    .map((p: any) => p.feature as string);

  // Unread notification count
  const { count: unreadCount } = await supabaseAdmin
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("staff_id", caller?.id ?? "")
    .eq("is_read", false);

  // Checklist nav visibility — always show for admin/manager; for staff only show when
  // they have at least one assigned checklist with incomplete required items.
  const isManager = caller?.role === "manager";
  let hasActiveChecklists = isAdmin || isManager;

  if (!hasActiveChecklists && caller?.id) {
    const { data: assignedChecklists } = await supabaseAdmin
      .from("staff_checklists")
      .select("id")
      .eq("staff_id", caller.id);

    const checklistIds = (assignedChecklists ?? []).map((c: any) => c.id);

    if (checklistIds.length > 0) {
      // Assume visible unless we can confirm all required items are done
      hasActiveChecklists = true;

      const { data: reqItems } = await supabaseAdmin
        .from("staff_checklist_items")
        .select("id")
        .in("staff_checklist_id", checklistIds)
        .eq("is_required", true);

      const reqItemIds = (reqItems ?? []).map((c: any) => c.id);

      if (reqItemIds.length > 0) {
        const { count: doneCount } = await supabaseAdmin
          .from("checklist_completions")
          .select("*", { count: "exact", head: true })
          .in("staff_checklist_item_id", reqItemIds);

        hasActiveChecklists = (doneCount ?? 0) < reqItemIds.length;
      }
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar — sticky to viewport height */}
      <div className="hidden md:block flex-shrink-0">
        <Sidebar
          isAdmin={effectiveIsAdmin}
          role={caller?.role ?? "staff"}
          permissions={viewAsStaff ? [] : permissions}
          userName={userName}
          userEmail={userEmail}
          userId={userId}
          notificationCount={unreadCount ?? 0}
          viewAsStaff={viewAsStaff}
          hasActiveChecklists={hasActiveChecklists}
        />
      </div>

      {/* Mobile top bar */}
      <TopBar
        userName={userName}
        userEmail={userEmail}
        userAvatar={userAvatar}
        userId={userId}
        isAdmin={effectiveIsAdmin}
        role={caller?.role ?? "staff"}
        permissions={viewAsStaff ? [] : permissions}
        notificationCount={unreadCount ?? 0}
        hasActiveChecklists={hasActiveChecklists}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col bg-[#F8F6F4] min-w-0">
        {/* Staff view preview banner */}
        {viewAsStaff && (
          <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 md:px-6 py-2.5 bg-amber-400 text-amber-900 md:sticky md:top-0 z-30">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 flex-shrink-0" />
              <p className="text-sm font-semibold">
                Previewing as a staff member — admin controls are hidden
              </p>
            </div>
            <form action={disableStaffView}>
              <button
                type="submit"
                className="flex items-center gap-1.5 text-xs font-bold bg-amber-900/15 hover:bg-amber-900/25 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
              >
                <EyeOff className="w-3.5 h-3.5" />
                Exit preview
              </button>
            </form>
          </div>
        )}

        <main className="flex-1 p-4 md:p-8 pt-[72px] md:pt-8 pb-24 md:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <BottomNav />
    </div>
  );
}
