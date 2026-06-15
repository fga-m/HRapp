import { supabaseAdmin } from "@/lib/supabase";

/**
 * Approver = admin, OR the role has the `approve_expenses` feature enabled in
 * role_permissions. Shared by the expenses API routes and dashboard pages.
 */
export async function isExpenseApprover(role: string | null | undefined): Promise<boolean> {
  if (role === "admin") return true;
  if (!role) return false;
  const { data } = await supabaseAdmin
    .from("role_permissions")
    .select("enabled")
    .eq("role", role)
    .eq("feature", "approve_expenses")
    .single();
  return data?.enabled ?? false;
}
