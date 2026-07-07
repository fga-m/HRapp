"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Shield, FileSignature } from "lucide-react";
import PoliciesView from "@/components/documents/PoliciesView";
import ContractsView from "@/components/documents/ContractsView";

function DocumentsTabs() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"policies" | "contracts">(
    searchParams.get("tab") === "contracts" ? "contracts" : "policies"
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setTab("policies")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            tab === "policies"
              ? "bg-[#223149] text-white"
              : "border border-[#ECE3DF] text-[#50676E] hover:bg-[#F8F6F4]"
          }`}
        >
          <Shield className="w-4 h-4" />
          Policies
        </button>
        <button
          onClick={() => setTab("contracts")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            tab === "contracts"
              ? "bg-[#223149] text-white"
              : "border border-[#ECE3DF] text-[#50676E] hover:bg-[#F8F6F4]"
          }`}
        >
          <FileSignature className="w-4 h-4" />
          Contracts
        </button>
      </div>

      {tab === "policies" ? <PoliciesView /> : <ContractsView />}
    </div>
  );
}

export default function DocumentsClient() {
  // useSearchParams needs a Suspense boundary in the app router.
  return (
    <Suspense fallback={null}>
      <DocumentsTabs />
    </Suspense>
  );
}
