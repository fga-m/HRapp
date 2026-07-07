import { redirect } from "next/navigation";

// The org chart now lives inside the People page.
export default function OrgRedirect() {
  redirect("/dashboard/people?view=chart");
}
