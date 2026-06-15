import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function getCallerId(email: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("staff")
    .select("id")
    .eq("email", email)
    .single();
  return (data?.id as string | undefined) ?? null;
}

// POST — register (or refresh) this device's push subscription for the caller.
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const staffId = await getCallerId(session.user?.email ?? "");
  if (!staffId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const authKey = body?.keys?.auth;
  if (!endpoint || !p256dh || !authKey) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  // Upsert on endpoint: the same device re-subscribing (or a different user
  // logging in on it) overwrites the existing row rather than duplicating.
  const { error } = await supabaseAdmin.from("push_subscriptions").upsert(
    {
      staff_id: staffId,
      endpoint,
      p256dh,
      auth: authKey,
      user_agent: req.headers.get("user-agent"),
    },
    { onConflict: "endpoint" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE — remove this device's subscription (user turned notifications off).
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const staffId = await getCallerId(session.user?.email ?? "");
  if (!staffId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { endpoint?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!body?.endpoint) {
    return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", body.endpoint)
    .eq("staff_id", staffId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
