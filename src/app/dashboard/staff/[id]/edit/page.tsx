import { getCaller } from "@/lib/caller";
import { redirect } from "next/navigation";
import EditStaffForm from "./EditStaffForm";

export const dynamic = "force-dynamic";

export default async function EditStaffPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // getCaller honours "Preview as staff" and multi-role admin.
  const caller = await getCaller();
  if (!caller) redirect("/");

  return <EditStaffForm id={id} isAdmin={caller.isAdmin} />;
}
