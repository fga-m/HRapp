import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { getAccessByEmail, can } from "@/lib/access";
import LeavePageClient from "./LeavePageClient";

export const dynamic = "force-dynamic";

export default async function LeavePage() {
  const session = await auth();
  if (!session) redirect("/");

  const { data: staff } = await supabaseAdmin
    .from("staff")
    .select("id, full_name, role, xero_employee_id, contracted_hours")
    .eq("email", session.user?.email ?? "")
    .single();

  if (!staff) redirect("/");

  const access = await getAccessByEmail(session.user?.email ?? "");
  const isReviewer = access ? can(access, "approve_leave") : false;

  return (
    <LeavePageClient
      staffId={staff.id}
      staffName={staff.full_name}
      hasXeroLink={!!staff.xero_employee_id}
      isReviewer={isReviewer}
      contractedHours={staff.contracted_hours ?? 37.5}
    />
  );
}
