import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import {
  NOTIFICATION_CATEGORY_KEYS,
  LOCKED_CATEGORY_KEYS,
} from "@/lib/notification-categories";

export const dynamic = "force-dynamic";

async function getCallerId(email: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("staff")
    .select("id")
    .eq("email", email)
    .single();
  return (data?.id as string | undefined) ?? null;
}

// GET — the caller's muted topics. No row yet means nothing is muted.
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const staffId = await getCallerId(session.user?.email ?? "");
  if (!staffId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from("notification_preferences")
    .select("disabled_categories")
    .eq("staff_id", staffId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    disabledCategories: (data?.disabled_categories as string[] | undefined) ?? [],
  });
}

// PUT — replace the caller's muted topics. Locked and unknown keys are dropped
// server-side, so a compliance topic can never be muted even via a crafted body.
export async function PUT(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const staffId = await getCallerId(session.user?.email ?? "");
  if (!staffId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { disabledCategories?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const requested = Array.isArray(body?.disabledCategories)
    ? body.disabledCategories
    : [];

  const disabled = [
    ...new Set(
      requested.filter(
        (c): c is string =>
          typeof c === "string" &&
          NOTIFICATION_CATEGORY_KEYS.includes(c) &&
          !LOCKED_CATEGORY_KEYS.has(c)
      )
    ),
  ];

  const { error } = await supabaseAdmin.from("notification_preferences").upsert(
    {
      staff_id: staffId,
      disabled_categories: disabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "staff_id" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ disabledCategories: disabled });
}
