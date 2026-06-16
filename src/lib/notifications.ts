import { supabaseAdmin } from "@/lib/supabase";
import { sendPushBatch } from "@/lib/push";
import {
  categoryForNotification,
  LOCKED_CATEGORY_KEYS,
} from "@/lib/notification-categories";

export type NotificationInput = {
  staff_id: string;
  title: string;
  message: string;
  type?: string;
  link?: string | null;
  reference_id?: string | null;
  is_read?: boolean;
  // Preference topic this notification belongs to. Used only to decide whether
  // to fire a push — it is NOT a notifications column and is stripped before
  // the insert. When omitted, the topic is derived from `type`.
  category?: string;
  // Allow any additional columns to pass straight through to the insert.
  [key: string]: unknown;
};

/**
 * Topics each staff member has muted, keyed by staff id. Locked topics are
 * never returned (they can't be muted). Fails open: on any error every staff
 * member maps to an empty set, so push is sent as before.
 */
async function mutedTopicsByStaff(
  staffIds: string[]
): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();
  if (staffIds.length === 0) return map;

  const { data, error } = await supabaseAdmin
    .from("notification_preferences")
    .select("staff_id, disabled_categories")
    .in("staff_id", staffIds);

  if (error || !data) return map;

  for (const row of data as {
    staff_id: string;
    disabled_categories: string[] | null;
  }[]) {
    const muted = (row.disabled_categories ?? []).filter(
      (c) => !LOCKED_CATEGORY_KEYS.has(c)
    );
    map.set(row.staff_id, new Set(muted));
  }
  return map;
}

// Mirror the click-through logic on the in-app notifications page: an explicit
// link wins, otherwise derive a target from the type + reference_id, falling
// back to the notifications list.
function resolveUrl(n: NotificationInput): string {
  if (typeof n.link === "string" && n.link) return n.link;
  if (n.reference_id) {
    switch (n.type) {
      case "policy":
        return `/dashboard/policies/${n.reference_id}`;
      case "meeting":
        return `/dashboard/meetings/${n.reference_id}`;
      case "checklist":
        return `/dashboard/onboarding/${n.reference_id}`;
    }
  }
  return "/dashboard/notifications";
}

/**
 * Single choke point for creating in-app notifications.
 *
 * Inserts the notification row(s) exactly as a direct `.insert()` would, then
 * fires a Web Push to every device each recipient has opted in on. Push is
 * best-effort: a push failure never affects the stored notification. Returns
 * the same `{ error }` shape as the Supabase insert so callers can keep their
 * existing error handling.
 */
export async function createNotification(
  input: NotificationInput | NotificationInput[]
): Promise<{ error: { message: string } | null }> {
  const rows = Array.isArray(input) ? input : [input];
  if (rows.length === 0) return { error: null };

  // `category` drives push routing only — it isn't a notifications column, so
  // strip it out before the insert. The in-app row is always written.
  const insertRows = rows.map((r) => {
    const row = { ...r };
    delete row.category;
    return row;
  });

  const { error } = await supabaseAdmin.from("notifications").insert(insertRows);
  if (error) return { error };

  try {
    const recipients = rows.filter((r) => r.staff_id);
    const muted = await mutedTopicsByStaff([
      ...new Set(recipients.map((r) => r.staff_id)),
    ]);

    // Suppress the push for any recipient who has muted this topic. The locked
    // topics were already filtered out of `muted`, so they always go through.
    const items = recipients
      .filter(
        (r) => !muted.get(r.staff_id)?.has(categoryForNotification(r))
      )
      .map((r) => ({
        staffId: r.staff_id,
        payload: { title: r.title, body: r.message, url: resolveUrl(r) },
      }));

    await sendPushBatch(items);
  } catch (err) {
    console.error("[notifications] push dispatch failed:", err);
  }

  return { error: null };
}
