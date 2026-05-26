import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, full_name")
    .eq("email", session.user?.email)
    .single();

  if (!caller) return NextResponse.json({ error: "Staff not found" }, { status: 404 });

  const { data: policy } = await supabaseAdmin
    .from("policies")
    .select("version, title, created_by")
    .eq("id", id)
    .single();

  if (!policy) return NextResponse.json({ error: "Policy not found" }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from("policy_signoffs")
    .insert({
      policy_id: id,
      staff_id: caller.id,
      policy_version: policy.version,
      signoff_year: new Date().getFullYear(),
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Already signed" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Notify the admin who created the policy
  if (policy.created_by) {
    await supabaseAdmin.from("notifications").insert({
      staff_id: policy.created_by,
      title: "Policy Signed Off",
      message: `${caller.full_name} has signed off on "${policy.title}" (v${policy.version})`,
      type: "policy",
      reference_id: id,
    });
  }

  return NextResponse.json(data, { status: 201 });
}
