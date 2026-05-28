import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { redirect } from "next/navigation";
import LeavePageClient from "./LeavePageClient";

export const dynamic = "force-dynamic";

export default async function LeavePage() {
  const session = await auth();
  if (!session) redirect("/");

  const { data: staff } = await supabaseAdmin
    .from("staff")
    .select("id, full_name, role, xero_employee_id")
    .eq("email", session.user?.email ?? "")
    .single();

  if (!staff) redirect("/");

  const isReviewer = staff.role === "admin" || staff.role === "manager";

  return (
    <LeavePageClient
      staffId={staff.id}
      staffName={staff.full_name}
      hasXeroLink={!!staff.xero_employee_id}
      isReviewer={isReviewer}
    />
  );
}
