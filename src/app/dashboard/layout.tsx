import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { redirect } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import BottomNav from "@/components/layout/BottomNav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/");

  // Get real user data + role from DB
  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, full_name, email, role")
    .eq("email", session.user?.email ?? "")
    .single();

  const isAdmin = caller?.role === "admin";
  const userName = caller?.full_name || session.user?.name || "";
  const userEmail = caller?.email || session.user?.email || "";

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
          isAdmin={isAdmin}
          userName={userName}
          userEmail={userEmail}
          notificationCount={unreadCount ?? 0}
        />
      </div>

      {/* Mobile top bar */}
      <TopBar
        userName={userName}
        isAdmin={isAdmin}
        notificationCount={unreadCount ?? 0}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col bg-[#F8F6F4]">
        <main className="flex-1 p-4 md:p-8 pt-[72px] md:pt-8 pb-24 md:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <BottomNav />
    </div>
  );
}
