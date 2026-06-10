import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });

  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", `page_desc:${key}`)
    .maybeSingle();

  return NextResponse.json({ description: data?.value ?? null });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session.user?.email ?? "")
    .single();

  if (caller?.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const { key, description } = await req.json();
  if (!key || typeof description !== "string") {
    return NextResponse.json({ error: "key and description required" }, { status: 400 });
  }

  await supabaseAdmin.from("app_settings").upsert(
    {
      key: `page_desc:${key}`,
      value: description.trim(),
      updated_at: new Date().toISOString(),
      updated_by: caller.id,
    },
    { onConflict: "key" }
  );

  return NextResponse.json({ ok: true });
}
