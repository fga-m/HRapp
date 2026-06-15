import { supabaseAdmin } from "@/lib/supabase";
import { sendPushBatch } from "@/lib/push";

export type NotificationInput = {
  staff_id: string;
  title: string;
  message: string;
  type?: string;
  link?: string | null;
  reference_id?: string | null;
  is_read?: boolean;
  // Allow any additional columns to pass straight through to the insert.
  [key: string]: unknown;
};

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

  const { error } = await supabaseAdmin.from("notifications").insert(rows);
  if (error) return { error };

  try {
    await sendPushBatch(
      rows
        .filter((r) => r.staff_id)
        .map((r) => ({
          staffId: r.staff_id,
          payload: { title: r.title, body: r.message, url: resolveUrl(r) },
        }))
    );
  } catch (err) {
    console.error("[notifications] push dispatch failed:", err);
  }

  return { error: null };
}
