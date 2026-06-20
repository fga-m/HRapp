"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import ExpenseClaimsCard from "@/components/staff/ExpenseClaimsCard";
import ExpenseApproverQueue from "@/components/expenses/ExpenseApproverQueue";
import ExpenseHistory from "@/components/expenses/ExpenseHistory";

interface Props {
  callerId: string;
  isApprover: boolean;
  pendingCount: number;
}

export default function ExpensesPageClient({ callerId, isApprover, pendingCount }: Props) {
  const [tab, setTab] = useState<"mine" | "review" | "history">("mine");

  // Staff who can't approve just see their own claims (+ the submit form).
  if (!isApprover) {
    return <ExpenseClaimsCard staffId={callerId} isOwnProfile isManager={false} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setTab("mine")}
          className={cn(
            "px-4 py-2 rounded-xl text-sm font-medium transition-colors",
            tab === "mine"
              ? "bg-[#223149] text-white"
              : "border border-[#ECE3DF] bg-white text-[#50676E] hover:bg-[#F8F6F4]"
          )}
        >
          My claims
        </button>
        <button
          onClick={() => setTab("review")}
          className={cn(
            "px-4 py-2 rounded-xl text-sm font-medium transition-colors inline-flex items-center gap-2",
            tab === "review"
              ? "bg-[#223149] text-white"
              : "border border-[#ECE3DF] bg-white text-[#50676E] hover:bg-[#F8F6F4]"
          )}
        >
          To review
          {pendingCount > 0 && (
            <span
              className={cn(
                "inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-xs font-bold",
                tab === "review" ? "bg-white text-[#223149]" : "bg-[#223149] text-white"
              )}
            >
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("history")}
          className={cn(
            "px-4 py-2 rounded-xl text-sm font-medium transition-colors",
            tab === "history"
              ? "bg-[#223149] text-white"
              : "border border-[#ECE3DF] bg-white text-[#50676E] hover:bg-[#F8F6F4]"
          )}
        >
          History
        </button>
      </div>

      {tab === "mine" ? (
        <ExpenseClaimsCard staffId={callerId} isOwnProfile isManager={false} />
      ) : tab === "review" ? (
        <ExpenseApproverQueue />
      ) : (
        <ExpenseHistory />
      )}
    </div>
  );
}
