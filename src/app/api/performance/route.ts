import { NextRequest, NextResponse } from "next/server";
import { getCaller } from "@/lib/caller";
import { supabaseAdmin } from "@/lib/supabase";
import { createNotification } from "@/lib/notifications";
import { getPeriodLabel } from "@/lib/performance";

export async function GET() {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let query = supabaseAdmin
    .from("performance_reviews")
    .select(`*, staff:staff!performance_reviews_staff_id_fkey(id, full_name, avatar_url, position)`)
    .order("created_at", { ascending: false });

  // Staff only see their own reviews
  if (caller.role === "staff") {
    query = query.eq("staff_id", caller.id);
  }
  // Admin and manager see all (per spec: "for now, any manager sees all")

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ reviews: data, role: caller.role, callerId: caller.id });
}

export async function POST(req: NextRequest) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!caller.isAdmin) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const body = await req.json();
  const { staff_id, year, period_type } = body;

  if (!staff_id || !year || !period_type) {
    return NextResponse.json({ error: "staff_id, year, and period_type are required" }, { status: 400 });
  }

  if (period_type !== "mid_year" && period_type !== "end_of_year") {
    return NextResponse.json({ error: "period_type must be 'mid_year' or 'end_of_year'" }, { status: 400 });
  }

  const period_label = getPeriodLabel(Number(year), period_type);

  const { data, error } = await supabaseAdmin
    .from("performance_reviews")
    .insert({
      staff_id,
      year: Number(year),
      period_type,
      period_label,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "A review for this staff member and period already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Notify the staff member
  await createNotification({
    staff_id,
    title: `Performance review created: ${period_label}`,
    message: `Your ${period_label} performance review has been created. Please complete your self-evaluation.`,
    category: "performance",
    link: `/dashboard/performance/${data.id}`,
    is_read: false,
  });

  return NextResponse.json(data, { status: 201 });
}
