// The set of notification *topics* a user can opt out of. This is a separate
// concept from the in-app notification `type` (which drives icons/colours and
// is sometimes the catch-all "general"): a topic is the granularity at which a
// person chooses what interrupts them. The `key` is what gets stored in
// `notification_preferences.disabled_categories` and what `createNotification`
// matches against when deciding whether to fire a push.
//
// This module is intentionally free of server-only imports so the preferences
// UI can render the same catalog the server enforces.

export type NotificationCategory = {
  key: string;
  label: string;
  description: string;
  /** Compliance-critical topics that can never be muted. */
  locked: boolean;
};

// Ordered for display. Locked (compliance) topics come first so it's obvious
// they're always on.
export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  {
    key: "policy",
    label: "Policies",
    description: "New policies to sign off and updates that need re-signing.",
    locked: true,
  },
  {
    key: "contract",
    label: "Contracts",
    description: "Contracts assigned to you for signing and new versions.",
    locked: true,
  },
  {
    key: "leave",
    label: "Leave",
    description: "Leave requests, approvals and declines.",
    locked: true,
  },
  {
    key: "meeting",
    label: "Meetings",
    description: "Shared meeting notes, suggestions and acknowledgements.",
    locked: false,
  },
  {
    key: "checklist",
    label: "Onboarding",
    description: "Onboarding checklists assigned to you or completed.",
    locked: false,
  },
  {
    key: "expense",
    label: "Expenses",
    description: "Expense claims submitted, approved or declined.",
    locked: false,
  },
  {
    key: "performance",
    label: "Performance & notes",
    description: "Performance reviews and notes shared with you.",
    locked: false,
  },
  {
    key: "document",
    label: "Documents",
    description: "Documents added to your profile and expiry reminders.",
    locked: false,
  },
  {
    key: "position_description",
    label: "Position descriptions",
    description: "Position descriptions assigned to you and updates.",
    locked: false,
  },
  {
    key: "schedule",
    label: "Schedule & TOIL",
    description: "Changes to your work schedule and TOIL (time-off-in-lieu) balance.",
    locked: false,
  },
  {
    key: "general",
    label: "General",
    description: "Anything that doesn't fall under the topics above.",
    locked: false,
  },
];

export const NOTIFICATION_CATEGORY_KEYS = NOTIFICATION_CATEGORIES.map((c) => c.key);

export const LOCKED_CATEGORY_KEYS = new Set(
  NOTIFICATION_CATEGORIES.filter((c) => c.locked).map((c) => c.key)
);

// Map the coarse, sometimes-overloaded `type` onto a preference topic. Used as
// the fallback when a notification doesn't carry an explicit `category`.
const TYPE_TO_CATEGORY: Record<string, string> = {
  policy: "policy",
  contract: "contract",
  leave: "leave",
  meeting: "meeting",
  checklist: "checklist",
  expense: "expense",
  performance: "performance",
  note: "performance",
  document: "document",
  position_description: "position_description",
  schedule: "schedule",
  toil: "schedule",
  general: "general",
};

/**
 * Resolve the preference topic a notification belongs to. An explicit
 * `category` always wins; otherwise we derive it from `type`. Anything
 * unrecognised falls back to "general" so a notification is never dropped
 * because of an unmapped value.
 */
export function categoryForNotification(n: {
  type?: string | null;
  category?: string | null;
}): string {
  if (n.category && NOTIFICATION_CATEGORY_KEYS.includes(n.category)) {
    return n.category;
  }
  if (n.type && TYPE_TO_CATEGORY[n.type]) return TYPE_TO_CATEGORY[n.type];
  return "general";
}
