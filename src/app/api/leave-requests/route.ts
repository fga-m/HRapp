import { NextRequest, NextResponse } from "next/server";
import { getCaller } from "@/lib/caller";
import { supabaseAdmin } from "@/lib/supabase";
import { can } from "@/lib/access";

export const dynamic = "force-dynamic";

// GET /api/leave-requests?status=PENDING|APPROVED|REJECTED|ALL
// Anyone who can approve leave (admins always; otherwise the approve_leave perm)
export async function GET(req: NextRequest) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!can(caller, "approve_leave")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const statusParam = (searchParams.get("status") ?? "PENDING").toUpperCase();

  let query = supabaseAdmin
    .from("leave_requests")
    .select(`
      id, staff_id, leave_type_id, leave_type_name,
      start_date, end_date, description, hours, status,
      approver_id, approver_note, submitted_at, reviewed_at,
      staff:staff_id ( full_name, email, contracted_hours )
    `);

  if (statusParam !== "ALL") {
    query = query.eq("status", statusParam);
  }

  const { data, error } = await query.order("submitted_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ requests: data ?? [] });
}
