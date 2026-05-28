import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { redirect } from "next/navigation";
import ExpensesPageClient from "./ExpensesPageClient";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const session = await auth();
  if (!session) redirect("/");

  const { data: staff } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session.user?.email ?? "")
    .single();

  if (!staff) redirect("/");

  const isReviewer =
    staff.role === "admin" ||
    staff.role === "manager" ||
    staff.role === "finance";

  return <ExpensesPageClient isReviewer={isReviewer} />;
}
