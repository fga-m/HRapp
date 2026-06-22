import { supabaseAdmin } from "@/lib/supabase";

/**
 * Approver = admin, OR any of the person's roles has the `approve_expenses`
 * feature enabled in role_permissions. Accepts a single role (backward
 * compatible) or an array of roles (multi-role). Shared by the expenses API
 * routes and dashboard pages.
 */
export async function isExpenseApprover(
  roleOrRoles: string | string[] | null | undefined
): Promise<boolean> {
  const roles = Array.isArray(roleOrRoles)
    ? roleOrRoles
    : roleOrRoles
      ? [roleOrRoles]
      : [];
  if (roles.length === 0) return false;
  if (roles.includes("admin")) return true;
  const { data } = await supabaseAdmin
    .from("role_permissions")
    .select("enabled")
    .in("role", roles)
    .eq("feature", "approve_expenses");
  return (data ?? []).some((d: { enabled: boolean }) => d.enabled);
}
