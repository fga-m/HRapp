import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { Receipt } from "lucide-react";
import PageSubtitle from "@/components/PageSubtitle";
import ExpenseApproverQueue from "@/components/expenses/ExpenseApproverQueue";

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
  let canApprove = caller.role === "admin";
  if (!canApprove) {
    const { data: perm } = await supabaseAdmin
      .from("role_permissions")
      .select("enabled")
      .eq("role", caller.role)
      .eq("feature", "approve_expenses")
      .single();
    canApprove = perm?.enabled ?? false;
  }
  if (!canApprove) redirect("/dashboard");

  return (
    <div className="space-y-2">
      <h1 className="text-3xl font-bold text-[#223149] flex items-center gap-2">
        <Receipt className="w-7 h-7" /> Expense Claims
      </h1>
      <PageSubtitle
        pageKey="expenses"
        defaultDescription="Review submitted expense claims and approve them to send to Xero as a bill."
      />
      <div className="pt-4">
        <ExpenseApproverQueue />
      </div>
    </div>
  );
}
