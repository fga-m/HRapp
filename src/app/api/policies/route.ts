import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session.user?.email)
    .single();

  if (!caller) return NextResponse.json({ error: "Staff not found" }, { status: 404 });

  let query = supabaseAdmin
    .from("policies")
    .select(`*, created_by_staff:staff!policies_created_by_fkey(full_name)`)
    .order("created_at", { ascending: false });

  // Staff only see active policies
  if (caller.role !== "admin") {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ policies: data, role: caller.role, staffId: caller.id });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session.user?.email)
    .single();

  if (caller?.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const body = await req.json();
  const { title, description, content_drive_url, requires_signoff, version, required_signatories } = body;

  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("policies")
    .insert({
      title,
      description: description || null,
      content_drive_url: content_drive_url || null,
      requires_signoff: requires_signoff ?? true,
      version: version && Number(version) >= 0.1 ? Number(version) : 1,
      created_by: caller.id,
      required_signatories: required_signatories ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify required staff (null = all active staff)
  if (requires_signoff) {
    let staffQuery = supabaseAdmin
      .from("staff")
      .select("id")
      .eq("is_active", true)
      .neq("id", caller.id);

    // If specific signatories selected, filter to just those people
    if (Array.isArray(required_signatories) && required_signatories.length > 0) {
      staffQuery = staffQuery.in("id", required_signatories);
    }

    const { data: staffToNotify } = await staffQuery;

    if (staffToNotify?.length) {
      await supabaseAdmin.from("notifications").insert(
        staffToNotify.map((s: any) => ({
          staff_id: s.id,
          title: "New Policy Requires Your Sign-off",
          message: `Please review and sign off on: ${title}`,
          type: "policy",
          reference_id: data.id,
        }))
      );
    }
  }

  return NextResponse.json(data, { status: 201 });
}
