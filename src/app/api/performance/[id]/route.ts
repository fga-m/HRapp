import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { createNotification } from "@/lib/notifications";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session.user?.email)
    .single();

  if (!caller) return NextResponse.json({ error: "Staff not found" }, { status: 404 });

  const { data: review, error } = await supabaseAdmin
    .from("performance_reviews")
    .select(`*, staff:staff!performance_reviews_staff_id_fkey(id, full_name, avatar_url, position), manager:staff!performance_reviews_manager_id_fkey(id, full_name)`)
    .eq("id", id)
    .single();

  if (error || !review) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = caller.role === "admin";
  const isManagerOrAdmin = isAdmin || caller.role === "manager";
  const isOwnReview = review.staff_id === caller.id;

  // Staff can only access their own review
  if (!isManagerOrAdmin && !isOwnReview) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Redact manager evaluation from staff if not visible
  let sanitized = { ...review };
  if (!isManagerOrAdmin && isOwnReview && !review.is_visible_to_staff) {
    sanitized = {
      ...sanitized,
      manager_evaluation: null,
      manager_submitted_at: null,
      manager_id: null,
      manager: null,
    };
  }

  return NextResponse.json({ review: sanitized, role: caller.role, callerId: caller.id });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session.user?.email)
    .single();

  if (!caller) return NextResponse.json({ error: "Staff not found" }, { status: 404 });

  const { data: review, error: fetchError } = await supabaseAdmin
    .from("performance_reviews")
    .select("id, staff_id, self_submitted_at, manager_submitted_at, is_visible_to_staff, period_label")
    .eq("id", id)
    .single();

  if (fetchError || !review) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = caller.role === "admin";
  const isManagerOrAdmin = isAdmin || caller.role === "manager";
  const isOwnReview = review.staff_id === caller.id;

  const body = await req.json();

  // Staff updating self_evaluation
  if ("self_evaluation" in body) {
    if (!isOwnReview && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (review.self_submitted_at && !isAdmin) {
      return NextResponse.json({ error: "Self-evaluation already submitted" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      self_evaluation: body.self_evaluation,
      updated_at: new Date().toISOString(),
    };

    // Set submitted_at on first submit (when body signals final submit)
    if (body.submit && !review.self_submitted_at) {
      updates.self_submitted_at = new Date().toISOString();
    }

    const { data, error } = await supabaseAdmin
      .from("performance_reviews")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // Manager updating manager_evaluation
  if ("manager_evaluation" in body) {
    if (!isManagerOrAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updates: Record<string, unknown> = {
      manager_evaluation: body.manager_evaluation,
      manager_id: caller.id,
      updated_at: new Date().toISOString(),
    };

    if (body.submit && !review.manager_submitted_at) {
      updates.manager_submitted_at = new Date().toISOString();
    }

    const { data, error } = await supabaseAdmin
      .from("performance_reviews")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // Toggle visibility
  if ("is_visible_to_staff" in body) {
    if (!isManagerOrAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from("performance_reviews")
      .update({ is_visible_to_staff: body.is_visible_to_staff, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Notify staff when visibility is turned on
    if (body.is_visible_to_staff && !review.is_visible_to_staff) {
      await createNotification({
        staff_id: review.staff_id,
        title: `Manager evaluation shared: ${review.period_label}`,
        message: `Your manager's evaluation for ${review.period_label} has been shared with you.`,
        link: `/dashboard/performance/${id}`,
        is_read: false,
      });
    }

    return NextResponse.json(data);
  }

  return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
}
