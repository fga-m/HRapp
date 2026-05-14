import Sidebar from "@/components/layout/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth + role will be wired up once NextAuth is configured
  const isAdmin = true; // temporary until auth is set up
  const userName = "Nick Teh";
  const userEmail = "nicholas.teh@fgam.org.au";

  return (
    <div className="flex min-h-screen">
      <Sidebar isAdmin={isAdmin} userName={userName} userEmail={userEmail} />
      <div className="flex-1 flex flex-col bg-[#F8F6F4]">
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
