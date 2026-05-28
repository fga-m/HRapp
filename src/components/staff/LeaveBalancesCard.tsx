"use client";

import { useEffect, useState } from "react";
import { Palmtree, AlertCircle } from "lucide-react";

interface LeaveBalance {
  name: string;
  balance: number;
  units: string;
}

interface Props {
  staffId: string;
}

// Colour-code common leave types
function leaveColour(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("annual")) return "bg-blue-50 text-blue-700 border-blue-100";
  if (n.includes("sick") || n.includes("personal")) return "bg-amber-50 text-amber-700 border-amber-100";
  if (n.includes("long service")) return "bg-purple-50 text-purple-700 border-purple-100";
  if (n.includes("parental") || n.includes("maternity") || n.includes("paternity")) return "bg-pink-50 text-pink-700 border-pink-100";
  if (n.includes("carer")) return "bg-orange-50 text-orange-700 border-orange-100";
  return "bg-[#F8F6F4] text-[#223149] border-[#ECE3DF]";
}

function formatBalance(balance: number, units: string): string {
  const rounded = Math.round(balance * 10) / 10;
  if (units.toLowerCase() === "days") {
    return `${rounded} ${rounded === 1 ? "day" : "days"}`;
  }
  // Show hours, and convert to days alongside if >= 1 day (assuming 7.6 hr day)
  const days = balance / 7.6;
  if (days >= 1) {
    return `${rounded} hrs (${Math.round(days * 10) / 10} days)`;
  }
  return `${rounded} hrs`;
}

export default function LeaveBalancesCard({ staffId }: Props) {
  const [state, setState] = useState<{
    status: "loading" | "unlinked" | "error" | "ready" | "xero_down";
    balances: LeaveBalance[];
    error?: string;
  }>({ status: "loading", balances: [] });

  useEffect(() => {
    fetch(`/api/staff/${staffId}/leave-balances`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setState({ status: "error", balances: [], error: d.error });
        } else if (!d.linked) {
          setState({ status: "unlinked", balances: [] });
        } else if (d.xeroDown) {
          setState({ status: "xero_down", balances: [] });
        } else {
          setState({ status: "ready", balances: d.balances ?? [] });
        }
      })
      .catch(() => setState({ status: "error", balances: [], error: "Failed to load" }));
  }, [staffId]);

  // Don't render anything if not linked to Xero
  if (state.status === "unlinked") return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <div className="flex items-center gap-2 mb-5">
        <Palmtree className="w-4 h-4 text-[#9BADB7]" />
        <span className="font-semibold text-[#223149]">Leave Balances</span>
        <span className="ml-1 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#13B5EA]/10 text-[#13B5EA] text-[10px] font-semibold">
          Xero
        </span>
      </div>

      {state.status === "loading" && (
        <div className="flex justify-center py-6">
          <div className="w-5 h-5 border-2 border-[#223149] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {state.status === "error" && (
        <div className="flex items-center gap-2 text-sm text-red-500 py-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {state.error}
        </div>
      )}

      {state.status === "xero_down" && (
        <p className="text-sm text-[#9BADB7]">
          Xero is not connected. An admin can reconnect it in Settings.
        </p>
      )}

      {state.status === "ready" && state.balances.length === 0 && (
        <p className="text-sm text-[#9BADB7] text-center py-4">No leave balances found in Xero.</p>
      )}

      {state.status === "ready" && state.balances.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {state.balances.map((b) => (
            <div
              key={b.name}
              className={`flex items-center justify-between px-4 py-3 rounded-xl border ${leaveColour(b.name)}`}
            >
              <span className="text-sm font-medium">{b.name}</span>
              <span className="text-sm font-bold tabular-nums">
                {formatBalance(b.balance, b.units)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
