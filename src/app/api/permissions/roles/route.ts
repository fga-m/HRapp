import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getAccessByEmail, resolveRoles, primaryRoleFor } from "@/lib/access";

export const dynamic = "force-dynamic";

async function requireAdmin(email: string) {
  const access = await getAccessByEmail(email);
  return access?.isAdmin ? access : null;
}

function slugify(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

// POST — create a new role from a label.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireAdmin(session.user?.email ?? ""))) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const { label } = await req.json();
  const clean = String(label ?? "").trim();
  if (!clean) return NextResponse.json({ error: "A role name is required." }, { status: 400 });

  let key = slugify(clean);
  if (!key) return NextResponse.json({ error: "Please use letters or numbers in the name." }, { status: 400 });

  // Ensure a unique key.
  const { data: existing } = await supabaseAdmin.from("roles").select("key");
  const taken = new Set((existing ?? []).map((r: { key: string }) => r.key));
  if (taken.has(key)) {
    let i = 2;
    while (taken.has(`${key}_${i}`)) i++;
    key = `${key}_${i}`;
  }

  // Place new roles just before "Staff" (sort_order 90).
  const { data, error } = await supabaseAdmin
    .from("roles")
    .insert({ key, label: clean, sort_order: 80, is_system: false, is_admin: false })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// PATCH — rename a role (label only; key stays stable). System roles are locked.
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireAdmin(session.user?.email ?? ""))) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const { key, label } = await req.json();
  const clean = String(label ?? "").trim();
  if (!key || !clean) return NextResponse.json({ error: "key and label are required" }, { status: 400 });

  const { data: roleRow } = await supabaseAdmin
    .from("roles")
    .select("key, is_system")
    .eq("key", key)
    .single();

  if (!roleRow) return NextResponse.json({ error: "Unknown role" }, { status: 400 });
  if (roleRow.is_system) {
    return NextResponse.json({ error: "Built-in roles can't be renamed." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("roles")
    .update({ label: clean, updated_at: new Date().toISOString() })
    .eq("key", key)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE ?key=... — remove a role and detach it from any staff. System locked.
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireAdmin(session.user?.email ?? ""))) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const key = new URL(req.url).searchParams.get("key") ?? "";
  if (!key) return NextResponse.json({ error: "key is required" }, { status: 400 });

  const { data: roleRow } = await supabaseAdmin
    .from("roles")
    .select("key, is_system")
    .eq("key", key)
    .single();

  if (!roleRow) return NextResponse.json({ error: "Unknown role" }, { status: 400 });
  if (roleRow.is_system) {
    return NextResponse.json({ error: "Built-in roles can't be deleted." }, { status: 400 });
  }

  // Detach the role from any staff who hold it (fall back to 'staff' if it was
  // their only role), then drop its permissions and the role itself.
  const { data: staff } = await supabaseAdmin.from("staff").select("id, role, roles");
  for (const s of staff ?? []) {
    const current = resolveRoles(s);
    if (!current.includes(key) && s.role !== key) continue;
    let next = current.filter((r) => r !== key);
    if (next.length === 0) next = ["staff"];
    await supabaseAdmin
      .from("staff")
      .update({ roles: next, role: primaryRoleFor(next) })
      .eq("id", s.id);
  }

  await supabaseAdmin.from("role_permissions").delete().eq("role", key);

  const { error } = await supabaseAdmin.from("roles").delete().eq("key", key).eq("is_system", false);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
