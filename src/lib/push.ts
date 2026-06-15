import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase";

// VAPID keys identify this application server to the browser push services.
// The public key is also exposed to the client (NEXT_PUBLIC_) so the browser
// can create a subscription bound to this server.
const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

// When the keys aren't configured (e.g. a preview without env vars) push is a
// no-op — in-app notifications still work, nothing throws.
export const pushConfigured = Boolean(PUBLIC_KEY && PRIVATE_KEY);

if (pushConfigured) {
  webpush.setVapidDetails(
    "mailto:nicholas.teh@fgam.org.au",
    PUBLIC_KEY as string,
    PRIVATE_KEY as string
  );
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

type SubscriptionRow = {
  id: string;
  staff_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

/**
 * Deliver a payload to every device each staff member has opted in on.
 *
 * `items` pairs a recipient with the exact payload to show them, so a single
 * call can fan a different message out to many people. Best-effort: this never
 * throws, and subscriptions the push service reports as gone (404/410) are
 * pruned so we stop trying them.
 */
export async function sendPushBatch(
  items: { staffId: string; payload: PushPayload }[]
): Promise<void> {
  if (!pushConfigured || items.length === 0) return;

  const staffIds = [...new Set(items.map((i) => i.staffId).filter(Boolean))];
  if (staffIds.length === 0) return;

  const { data, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, staff_id, endpoint, p256dh, auth")
    .in("staff_id", staffIds);

  const subs = (data ?? []) as SubscriptionRow[];
  if (error || subs.length === 0) return;

  // Group each staff member's devices for quick lookup.
  const byStaff = new Map<string, SubscriptionRow[]>();
  for (const s of subs) {
    const list = byStaff.get(s.staff_id) ?? [];
    list.push(s);
    byStaff.set(s.staff_id, list);
  }

  const deadIds: string[] = [];

  await Promise.all(
    items.flatMap((item) => {
      const targets = byStaff.get(item.staffId) ?? [];
      const body = JSON.stringify(item.payload);
      return targets.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body
          );
        } catch (err) {
          const status = (err as { statusCode?: number })?.statusCode;
          if (status === 404 || status === 410) {
            deadIds.push(s.id); // expired or unsubscribed — prune it
          } else {
            console.error("[push] send failed:", status, err);
          }
        }
      });
    })
  );

  if (deadIds.length > 0) {
    await supabaseAdmin.from("push_subscriptions").delete().in("id", deadIds);
  }
}
