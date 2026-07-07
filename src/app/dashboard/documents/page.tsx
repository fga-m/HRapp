import PageSubtitle from "@/components/PageSubtitle";
import DocumentsClient from "@/components/documents/DocumentsClient";

export const dynamic = "force-dynamic";

// Policies and contracts are both "read and sign" documents, so they live
// together as tabs of one page. The old /dashboard/policies and
// /dashboard/contracts index routes redirect here (detail routes unchanged).
export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#223149]">Documents &amp; Sign-offs</h1>
        <PageSubtitle
          pageKey="documents"
          defaultDescription="Company policies and your employment contracts — read and sign in one place."
        />
      </div>
      <DocumentsClient />
    </div>
  );
}
