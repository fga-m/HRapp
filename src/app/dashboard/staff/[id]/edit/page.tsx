import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { redirect } from "next/navigation";
import EditStaffForm from "./EditStaffForm";

export const dynamic = "force-dynamic";

export default async function EditStaffPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session) redirect("/");

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("role")
    .eq("email", session.user?.email ?? "")
    .single();

  const isAdmin = caller?.role === "admin";

  return <EditStaffForm id={id} isAdmin={isAdmin} />;
}
