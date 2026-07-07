import { supabaseAdmin } from "@/lib/supabase";
import { getCaller, callerCan } from "@/lib/caller";
import { redirect } from "next/navigation";
import PageSubtitle from "@/components/PageSubtitle";
import PeopleClient, { type DirectoryPerson } from "@/components/people/PeopleClient";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const caller = await getCaller();
  if (!caller) redirect("/");

  // Everyone can browse the directory — names, positions and work contact
  // details only. Managing staff stays behind manage_staff.
  const { data } = await supabaseAdmin
    .from("staff")
    .select("id, full_name, email, position, avatar_url")
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  const people = (data ?? []) as DirectoryPerson[];
  const canManage = callerCan(caller, "manage_staff");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#223149]">People</h1>
        <PageSubtitle
          pageKey="people"
          defaultDescription="Who's who — the team directory and how everyone fits together."
        />
      </div>
      <PeopleClient people={people} canManage={canManage} />
    </div>
  );
}
