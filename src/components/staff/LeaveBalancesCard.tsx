"use client";

import { useEffect, useState } from "react";
import { Palmtree, AlertCircle } from "lucide-react";
import Link from "next/link";

interface LeaveBalance {
  name: string;
  leaveTypeId: string;
  balance: number;
  units: string;
}

interface Props {
  staffId: string;
  isOwnProfile: boolean;
}

function leaveColour(name: string) {
  const n = name.toLowerCase();
  if (n.includes("annual")) return "bg-blue-50 text-blue-700 border-blue-100";
  if (n.includes("sick") || n.includes("personal")) return "bg-amber-50 text-amber-700 border-amber-100";
  if (n.includes("long service")) return "bg-purple-50 text-purple-700 border-purple-100";
  if (n.includes("parental") || n.includes("maternity") || n.includes("paternity")) return "bg-pink-50 text-pink-700 border-pink-100";
  if (n.includes("carer")) return "bg-orange-50 text-orange-700 border-orange-100";
  return "bg-[#F8F6F4] text-[#223149] border-[#ECE3DF]";
}

function formatBalance(balance: number, units: string) {
  const rounded = Math.round(balance * 10) / 10;
  if (units.toLowerCase() === "days") return `${rounded} ${rounded === 1 ? "day" : "days"}`;
  const days = balance / 7.5; // 7.5 hrs/day — matches the leave page and the contracted-hours policy
  if (days >= 1) return `${rounded} hrs (${Math.round(days * 10) / 10} days)`;
  return `${rounded} hrs`;
}

export default function LeaveBalancesCard({ staffId, isOwnProfile }: Props) {
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [status, setStatus] = useState<"loading" | "unlinked" | "ready" | "error">("loading");

  useEffect(() => {
    fetch(`/api/staff/${staffId}/leave-balances`)
      .then(r => r.json())
      .then(d => {
        if (!d.linked) { setStatus("unlinked"); return; }
        setBalances(d.balances ?? []);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [staffId]);

  if (status === "unlinked") return null;

  return (
    <div className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Palmtree className="w-4 h-4 text-[#50676E]" />
          <span className="font-semibold text-[#223149]">Leave Balances</span>
          <span className="flex items-center px-1.5 py-0.5 rounded-md bg-[#13B5EA]/10 text-[#13B5EA] text-[10px] font-semibold">
            Xero
          </span>
        </div>
        {isOwnProfile && (
          <Link
            href="/dashboard/leave"
            className="text-xs font-medium text-[#50676E] hover:text-[#223149] transition-colors"
          >
            View all →
          </Link>
        )}
      </div>

      {status === "loading" && (
        <div className="flex justify-center py-4">
          <div className="w-5 h-5 border-2 border-[#223149] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {status === "error" && (
        <div className="flex items-center gap-2 text-sm text-red-500">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> Failed to load leave balances
        </div>
      )}

      {status === "ready" && balances.length === 0 && (
        <p className="text-sm text-[#50676E] text-center py-4">No leave balances found.</p>
      )}

      {status === "ready" && balances.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {balances.map(b => (
            <div key={b.name} className={`flex items-center justify-between px-4 py-3 rounded-xl border ${leaveColour(b.name)}`}>
              <span className="text-sm font-medium">{b.name}</span>
              <span className="text-sm font-bold tabular-nums">{formatBalance(b.balance, b.units)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
