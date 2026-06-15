import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { Receipt } from "lucide-react";
import PageSubtitle from "@/components/PageSubtitle";
import ExpensesPageClient from "@/components/expenses/ExpensesPageClient";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const session = await auth();
  if (!session) redirect("/");

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session.user?.email ?? "")
    .single();

  if (!caller) redirect("/dashboard");

  // Approver = admin OR the caller's role has approve_expenses enabled.
  let isApprover = caller.role === "admin";
  if (!isApprover) {
    const { data: perm } = await supabaseAdmin
      .from("role_permissions")
      .select("enabled")
      .eq("role", caller.role)
      .eq("feature", "approve_expenses")
      .single();
    isApprover = perm?.enabled ?? false;
  }

  // Pending count for the review tab badge (claims needing attention).
  let pendingCount = 0;
  if (isApprover) {
    const { count } = await supabaseAdmin
      .from("expense_claims")
      .select("*", { count: "exact", head: true })
      .in("status", ["submitted", "push_failed"]);
    pendingCount = count ?? 0;
  }

  return (
    <div className="space-y-2">
      <h1 className="text-3xl font-bold text-[#223149] flex items-center gap-2">
        <Receipt className="w-7 h-7" /> Expense Claims
      </h1>
      <PageSubtitle
        pageKey="expenses"
        defaultDescription="Submit a reimbursement claim with a receipt. Approved claims are sent to Xero as a bill."
      />
      <div className="pt-4">
        <ExpensesPageClient callerId={caller.id} isApprover={isApprover} pendingCount={pendingCount} />
      </div>
    </div>
  );
}
