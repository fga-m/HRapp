import { redirect } from "next/navigation";

// Contracts now live in Documents & Sign-offs (detail routes are unchanged).
export default function ContractsRedirect() {
  redirect("/dashboard/documents?tab=contracts");
}
