import { NextRequest, NextResponse } from "next/server";
import { getCaller } from "@/lib/caller";
import { supabaseAdmin } from "@/lib/supabase";
import { createNotification } from "@/lib/notifications";

export async function GET(_req: NextRequest) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const currentYear = new Date().getFullYear();

  let query = supabaseAdmin
    .from("position_descriptions")
    .select(`*, assigned_staff:staff!position_descriptions_staff_id_fkey(full_name, email, avatar_url)`)
    .order("created_at", { ascending: false });

  if (!caller.isAdmin) {
    query = query.eq("staff_id", caller.id);
  }

  const { data: pds, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // For each PD, check if the staff has acknowledged the current version for the current year
  const pdIds = (pds || []).map((pd: any) => pd.id);
  let ackMap: Record<string, boolean> = {};

  if (pdIds.length > 0) {
    const { data: acks } = await supabaseAdmin
      .from("pd_acknowledgements")
      .select("pd_id, pd_version, ack_year, staff_id")
      .in("pd_id", pdIds)
      .eq("ack_year", currentYear);

    if (acks) {
      for (const ack of acks) {
        const pd = (pds || []).find((p: any) => p.id === ack.pd_id);
        if (pd && ack.pd_version === pd.version && ack.staff_id === pd.staff_id) {
          ackMap[ack.pd_id] = true;
        }
      }
    }
  }

  const enriched = (pds || []).map((pd: any) => ({
    ...pd,
    acknowledged: ackMap[pd.id] ?? false,
  }));

  return NextResponse.json({ pds: enriched, role: caller.role });
}

export async function POST(req: NextRequest) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!caller.isAdmin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const body = await req.json();
  const { staff_id, title, content } = body;

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const { data: pd, error } = await supabaseAdmin
    .from("position_descriptions")
    .insert({
      staff_id: staff_id || null,
      title,
      content: content || "",
      version: 1,
      is_active: true,
      created_by: caller.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify the assigned staff (only if a specific staff member was assigned)
  if (staff_id) {
    await createNotification({
      staff_id,
      title: "Position Description Assigned",
      message: "Your position description has been shared. Please review and acknowledge it.",
      type: "general",
      category: "position_description",
      reference_id: pd.id,
    });
  }

  return NextResponse.json(pd, { status: 201 });
}
