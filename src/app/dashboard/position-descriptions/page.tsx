import { getCaller } from "@/lib/caller";
import { redirect } from "next/navigation";
import PositionDescriptionsAdmin from "@/components/positions/PositionDescriptionsAdmin";

export const dynamic = "force-dynamic";

// Admin manage view. A staff member's own position description now lives on
// their profile, so non-admins are sent there (detail routes unchanged).
export default async function PositionDescriptionsPage() {
  const caller = await getCaller();
  if (!caller) redirect("/");
  if (!caller.isAdmin) redirect(`/dashboard/staff/${caller.id}`);

  return <PositionDescriptionsAdmin />;
}
