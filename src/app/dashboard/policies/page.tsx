import { redirect } from "next/navigation";

// Policies now live in Documents & Sign-offs (detail routes are unchanged).
export default function PoliciesRedirect() {
  redirect("/dashboard/documents?tab=policies");
}
