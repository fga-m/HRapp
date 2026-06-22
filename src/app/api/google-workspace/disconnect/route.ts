import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// POST — disconnect the Google Workspace admin account. Admin only.
export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("role")
    .eq("email", session.user?.email ?? "")
    .single();
  if (caller?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error } = await supabaseAdmin
    .from("google_workspace_connection")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
