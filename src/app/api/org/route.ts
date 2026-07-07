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

export async function GET(_req: NextRequest) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: roles, error } = await supabaseAdmin
    .from("org_roles")
    .select(`*, org_role_staff(staff:staff(id, full_name, email, avatar_url, position)), pd:position_descriptions(id, title)`)
    .order("order_index", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch position descriptions to build pdMap: { [staff_id]: pd_id }
  const { data: pds } = await supabaseAdmin
    .from("position_descriptions")
    .select("id, staff_id");

  const pdMap: Record<string, string> = {};
  if (pds) {
    for (const pd of pds) {
      if (pd.staff_id) {
        pdMap[pd.staff_id] = pd.id;
      }
    }
  }

  return NextResponse.json({ roles: roles || [], role: caller.role, pdMap });
}

export async function POST(req: NextRequest) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await callerCanDo(caller.role, "manage_org"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { title, description, parent_id } = body;

  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("org_roles")
    .insert({
      title,
      description: description || null,
      parent_id: parent_id || null,
      order_index: 0,
      created_by: caller.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
