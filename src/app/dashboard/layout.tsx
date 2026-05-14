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
    .select("id, full_name, email, role")
    .eq("email", session.user?.email ?? "")
    .single();

  const isAdmin = caller?.role === "admin";
  const userName = caller?.full_name || session.user?.name || "";
  const userEmail = caller?.email || session.user?.email || "";

  // "View as staff" preview mode — admins only
  const cookieStore = await cookies();
  const viewAsStaff = isAdmin && cookieStore.get("fga_view_as_staff")?.value === "1";
  const effectiveIsAdmin = isAdmin && !viewAsStaff;

  // Unread notification count
  const { count: unreadCount } = await supabaseAdmin
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("staff_id", caller?.id ?? "")
    .eq("is_read", false);

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar
          isAdmin={effectiveIsAdmin}
          userName={userName}
          userEmail={userEmail}
          notificationCount={unreadCount ?? 0}
          viewAsStaff={viewAsStaff}
        />
      </div>

      {/* Mobile top bar */}
      <TopBar
        userName={userName}
        isAdmin={effectiveIsAdmin}
        notificationCount={unreadCount ?? 0}
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
