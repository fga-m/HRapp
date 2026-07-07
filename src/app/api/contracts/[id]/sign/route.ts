import { NextRequest, NextResponse } from "next/server";
import { getCaller } from "@/lib/caller";
import { supabaseAdmin } from "@/lib/supabase";
import { createNotification } from "@/lib/notifications";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Validate: must be assigned to this contract
  const { data: assignment } = await supabaseAdmin
    .from("contract_assignments")
    .select("id")
    .eq("contract_id", id)
    .eq("staff_id", caller.id)
    .single();

  if (!assignment) return NextResponse.json({ error: "You are not assigned to this contract" }, { status: 403 });

  // Validate: must not have already signed
  const { data: existing } = await supabaseAdmin
    .from("contract_signatures")
    .select("id")
    .eq("contract_id", id)
    .eq("staff_id", caller.id)
    .single();

  if (existing) return NextResponse.json({ error: "You have already signed this contract" }, { status: 409 });

  const body = await req.json();
  const { name_as_typed } = body;

  if (!name_as_typed || name_as_typed.trim().length < 2) {
    return NextResponse.json({ error: "A valid full name is required to sign" }, { status: 400 });
  }

  // Get IP from request headers
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    null;

  const { data, error } = await supabaseAdmin
    .from("contract_signatures")
    .insert({
      contract_id: id,
      staff_id: caller.id,
      name_as_typed: name_as_typed.trim(),
      ip_address: ip,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify all admins that the contract has been signed
  const { data: contract } = await supabaseAdmin
    .from("contracts")
    .select("title, created_by")
    .eq("id", id)
    .single();

  const { data: signer } = await supabaseAdmin
    .from("staff")
    .select("full_name")
    .eq("id", caller.id)
    .single();

  const { data: admins } = await supabaseAdmin
    .from("staff")
    .select("id")
    .eq("role", "admin")
    .eq("is_active", true)
    .neq("id", caller.id); // don't notify the signer if they're also an admin

  if (admins && admins.length > 0 && contract) {
    await createNotification(
      admins.map((a: any) => ({
        staff_id: a.id,
        title: `Contract signed by ${signer?.full_name ?? "a staff member"}`,
        message: `${signer?.full_name ?? "A staff member"} has signed "${contract.title}".`,
        type: "contract",
        link: `/dashboard/contracts/${id}`,
        is_read: false,
      }))
    );
  }

  return NextResponse.json(data, { status: 201 });
}
