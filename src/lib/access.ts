import { supabaseAdmin } from "@/lib/supabase";
import { FEATURE_KEYS } from "@/lib/permissions";

// ─────────────────────────────────────────────────────────────────────────────
// Multi-role access resolution.
//
// A staff member can hold several roles (staff.roles text[]). `staff.role`
// remains the "primary" role for backward compatibility (and is kept = 'admin'
// whenever 'admin' is among their roles, so legacy role === 'admin' checks still
// hold). Effective permissions are the UNION of every assigned role's enabled
// features in role_permissions; admins implicitly have every feature.
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_ROLE = "admin";

export type Access = {
  id: string;
  primaryRole: string;
  roles: string[];
  isAdmin: boolean;
  permissions: string[];
};

/** The full set of roles for a staff row — roles[] if present, else [role]. */
export function resolveRoles(s: { role?: string | null; roles?: string[] | null }): string[] {
  if (s.roles && s.roles.length > 0) return s.roles;
  return [s.role ?? "staff"];
}

export function rolesAreAdmin(roles: string[]): boolean {
  return roles.includes(ADMIN_ROLE);
}

/** Pick the primary role to store on staff.role given a chosen role set. */
export function primaryRoleFor(roles: string[]): string {
  if (roles.includes(ADMIN_ROLE)) return ADMIN_ROLE;
  return roles[0] ?? "staff";
}

/** Union of enabled features across the given roles (admins get everything). */
export async function permissionsForRoles(roles: string[]): Promise<string[]> {
  if (rolesAreAdmin(roles)) return [...FEATURE_KEYS];
  if (roles.length === 0) return [];
  const { data } = await supabaseAdmin
    .from("role_permissions")
    .select("feature, enabled")
    .in("role", roles);
  return Array.from(
    new Set(
      (data ?? [])
        .filter((p: { enabled: boolean }) => p.enabled)
        .map((p: { feature: string }) => p.feature)
    )
  );
}

function toAccess(s: { id: string; role: string | null; roles: string[] | null }, permissions: string[]): Access {
  const roles = resolveRoles(s);
  return {
    id: s.id,
    primaryRole: s.role ?? roles[0] ?? "staff",
    roles,
    isAdmin: rolesAreAdmin(roles),
    permissions,
  };
}

export async function getAccessByEmail(email: string): Promise<Access | null> {
  const { data: s } = await supabaseAdmin
    .from("staff")
    .select("id, role, roles")
    .eq("email", email)
    .single();
  if (!s) return null;
  const perms = await permissionsForRoles(resolveRoles(s));
  return toAccess(s, perms);
}

export async function getAccessById(id: string): Promise<Access | null> {
  const { data: s } = await supabaseAdmin
    .from("staff")
    .select("id, role, roles")
    .eq("id", id)
    .single();
  if (!s) return null;
  const perms = await permissionsForRoles(resolveRoles(s));
  return toAccess(s, perms);
}

/** True if the access grant includes a feature (admins always do). */
export function can(access: Pick<Access, "isAdmin" | "permissions">, feature: string): boolean {
  return access.isAdmin || access.permissions.includes(feature);
}

/**
 * IDs of active staff who can perform a feature: admins, plus anyone holding a
 * role that has the feature enabled. Used to fan out notifications (e.g. who to
 * tell about a new leave request) now that approval is permission-based.
 */
export async function getApproverStaffIds(feature: string): Promise<string[]> {
  const { data: rolesWith } = await supabaseAdmin
    .from("role_permissions")
    .select("role")
    .eq("feature", feature)
    .eq("enabled", true);

  const allowed = new Set<string>([ADMIN_ROLE, ...(rolesWith ?? []).map((r: { role: string }) => r.role)]);

  const { data: staff } = await supabaseAdmin
    .from("staff")
    .select("id, role, roles, is_active")
    .eq("is_active", true);

  return (staff ?? [])
    .filter((s: { role: string | null; roles: string[] | null }) =>
      resolveRoles(s).some((r) => allowed.has(r))
    )
    .map((s: { id: string }) => s.id);
}
