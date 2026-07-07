import { supabaseAdmin } from "@/lib/supabase";
import { isExpenseApprover } from "@/lib/expenses";
import { getCaller } from "@/lib/caller";
import { redirect } from "next/navigation";
import { Receipt } from "lucide-react";
import PageSubtitle from "@/components/PageSubtitle";
import ExpensesPageClient from "@/components/expenses/ExpensesPageClient";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  // getCaller honours "Preview as staff", so the approver tabs hide in preview.
  const caller = await getCaller();
  if (!caller) redirect("/");

  // Approver = admin OR any of the caller's roles has approve_expenses enabled.
  const isApprover = await isExpenseApprover(caller.roles);

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
