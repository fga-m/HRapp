import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import BottomNav from "@/components/layout/BottomNav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth + role will be wired up once NextAuth is configured
  const isAdmin = true;
  const userName = "Nick Teh";
  const userEmail = "nicholas.teh@fgam.org.au";

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar isAdmin={isAdmin} userName={userName} userEmail={userEmail} />
      </div>

      {/* Mobile top bar */}
      <TopBar userName={userName} isAdmin={isAdmin} />

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
