import { NextRequest, NextResponse } from "next/server";
import { getCaller } from "@/lib/caller";
import { supabaseAdmin } from "@/lib/supabase";

async function callerCanDo(callerRole: string, feature: string): Promise<boolean> {
  if (callerRole === "admin") return true;
  if (callerRole !== "manager") return false;
  const { data } = await supabaseAdmin
    .from("role_permissions")
    .select("enabled")
    .eq("role", "manager")
    .eq("feature", feature)
    .single();
  return data?.enabled ?? false;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  if (!(await callerCanDo(caller.role, "manage_org"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };

  if (body.title !== undefined) updatePayload.title = body.title;
  if (body.description !== undefined) updatePayload.description = body.description;
  if ("parent_id" in body) updatePayload.parent_id = body.parent_id; // allow explicit null
  if ("pd_id" in body) updatePayload.pd_id = body.pd_id; // allow null to unlink
  if (body.order_index !== undefined) updatePayload.order_index = body.order_index;

  const { data, error } = await supabaseAdmin
    .from("org_roles")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  if (!(await callerCanDo(caller.role, "manage_org"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Detach children so they become root nodes (not orphaned / cascade deleted)
  await supabaseAdmin
    .from("org_roles")
    .update({ parent_id: null })
    .eq("parent_id", id);

  const { error } = await supabaseAdmin
    .from("org_roles")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
