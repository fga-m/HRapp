export const FEATURES = [
  { key: "manage_staff",                 label: "Manage Staff",                description: "Create, edit and deactivate staff members" },
  { key: "manage_policies",              label: "Manage Policies",             description: "Create, edit and archive policies" },
  { key: "manage_meetings",              label: "Manage Meeting Notes",        description: "Create meeting notes and view all staff notes" },
  { key: "manage_hub",                   label: "Manage Staff Hub",            description: "Add and edit Staff Hub items" },
  { key: "manage_onboarding",            label: "Manage Onboarding",           description: "Create and assign onboarding checklists" },
  { key: "manage_org",                   label: "Edit Org Chart",              description: "Add, edit and remove org chart roles" },
  { key: "manage_position_descriptions", label: "Manage Position Descriptions", description: "Create and assign position descriptions" },
  { key: "view_team_schedule",           label: "View Team Schedule",          description: "Access the team schedule and TOIL tracker" },
  { key: "manage_toil",                  label: "Manage TOIL (time off in lieu)", description: "Log and adjust time off in lieu for staff" },
] as const;

export type FeatureKey = typeof FEATURES[number]["key"];

// Admin has all features. For other roles, check the DB permissions.
export function hasPermission(role: string, permissions: string[], feature: FeatureKey): boolean {
  if (role === "admin") return true;
  return permissions.includes(feature);
}
