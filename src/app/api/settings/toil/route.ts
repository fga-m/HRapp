import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import {
  getToilWindowWeeks,
  setToilWindowWeeks,
  TOIL_WINDOW_MIN,
  TOIL_WINDOW_MAX,
} from "@/lib/app-settings";

// GET — current TOIL window length (any authenticated user).
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const weeks = await getToilWindowWeeks();
  return NextResponse.json({ toilWindowWeeks: weeks, min: TOIL_WINDOW_MIN, max: TOIL_WINDOW_MAX });
}

// PUT — change the TOIL window length (admins only).
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session.user?.email ?? "")
    .single();

  if (!caller) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (caller.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const weeks = Number(body?.weeks);
  if (!Number.isFinite(weeks)) {
    return NextResponse.json({ error: "weeks must be a number" }, { status: 400 });
  }

  const stored = await setToilWindowWeeks(weeks, caller.id);
  return NextResponse.json({ toilWindowWeeks: stored, min: TOIL_WINDOW_MIN, max: TOIL_WINDOW_MAX });
}
