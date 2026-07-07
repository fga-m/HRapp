import { supabaseAdmin } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { getCaller, callerCan } from "@/lib/caller";
import LeavePageClient from "./LeavePageClient";

export const dynamic = "force-dynamic";

export default async function LeavePage() {
  // getCaller honours "Preview as staff", so the Team tab hides in preview.
  const caller = await getCaller();
  if (!caller) redirect("/");

  const { data: staff } = await supabaseAdmin
    .from("staff")
    .select("id, full_name, xero_employee_id, contracted_hours")
    .eq("id", caller.id)
    .single();

  if (!staff) redirect("/");

  const isReviewer = callerCan(caller, "approve_leave");

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
