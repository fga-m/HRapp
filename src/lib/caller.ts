import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveRoles, rolesAreAdmin, permissionsForRoles } from "@/lib/access";

// ─────────────────────────────────────────────────────────────────────────────
// getCaller() — the single way to resolve "who is making this request?"
//
// Resolves the session → staff row → multi-role access, and applies the
// admin "Preview as staff" cookie so that EVERY consumer (API routes, server
// pages) sees the same downgraded identity while preview is active. This is
// what makes the preview trustworthy end-to-end.
//
// Semantics while previewing (admin + fga_view_as_staff=1):
//   role → "staff", roles → ["staff"], isAdmin → false, permissions → [].
// The preview only ever *removes* capability from a real admin, so honoring
// it in write-path authorization is safe (a previewing admin is correctly
// denied admin actions, exactly like the staff member they're emulating).
// `reallyAdmin` is exposed for the rare spot that must ignore preview
// (e.g. the "Exit preview" control itself).
// ─────────────────────────────────────────────────────────────────────────────

export type Caller = {
  id: string;
  email: string;
  fullName: string | null;
  /** Primary role with preview applied ("staff" while previewing). */
  role: string;
  /** All roles with preview applied. */
  roles: string[];
  /** Admin status with preview applied. */
  isAdmin: boolean;
  /** Permission union with preview applied. */
  permissions: string[];
  /** True while a real admin is previewing the portal as a staff member. */
  previewingAsStaff: boolean;
  /** Admin status ignoring preview. Use sparingly. */
  reallyAdmin: boolean;
};

export async function getCaller(): Promise<Caller | null> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return null;

  const { data: s } = await supabaseAdmin
    .from("staff")
    .select("id, email, full_name, role, roles")
    .eq("email", email)
    .single();
  if (!s) return null;

  const roles = resolveRoles(s);
  const reallyAdmin = rolesAreAdmin(roles);

  const cookieStore = await cookies();
  const previewingAsStaff =
    reallyAdmin && cookieStore.get("fga_view_as_staff")?.value === "1";

  if (previewingAsStaff) {
    return {
      id: s.id,
      email: s.email,
      fullName: s.full_name ?? null,
      role: "staff",
      roles: ["staff"],
      isAdmin: false,
      permissions: [],
      previewingAsStaff: true,
      reallyAdmin,
    };
  }

  return {
    id: s.id,
    email: s.email,
    fullName: s.full_name ?? null,
    role: s.role ?? roles[0] ?? "staff",
    roles,
    isAdmin: reallyAdmin,
    permissions: await permissionsForRoles(roles),
    previewingAsStaff: false,
    reallyAdmin,
  };
}

/** True if the caller may use a feature (admins always may). */
export function callerCan(caller: Pick<Caller, "isAdmin" | "permissions">, feature: string): boolean {
  return caller.isAdmin || caller.permissions.includes(feature);
}
