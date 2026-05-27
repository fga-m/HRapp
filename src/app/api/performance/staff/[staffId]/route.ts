import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ staffId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { staffId } = await params;

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session.user?.email)
    .single();

  if (!caller) return NextResponse.json({ error: "Staff not found" }, { status: 404 });

  const isManagerOrAdmin = caller.role === "admin" || caller.role === "manager";

  // Staff can only get their own reviews
  if (!isManagerOrAdmin && caller.id !== staffId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("performance_reviews")
    .select("*")
    .eq("staff_id", staffId)
    .order("year", { ascending: false })
    .order("period_type", { ascending: true }); // mid_year before end_of_year alphabetically

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // For staff viewing their own reviews, redact manager evals if not visible
  let reviews = data || [];
  if (!isManagerOrAdmin) {
    reviews = reviews.map((r) => {
      if (!r.is_visible_to_staff) {
        return { ...r, manager_evaluation: null, manager_submitted_at: null, manager_id: null };
      }
      return r;
    });
  }

  return NextResponse.json({ reviews, role: caller.role, callerId: caller.id });
}
