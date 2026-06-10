"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Shield, CheckCircle, Clock, ChevronRight, AlertCircle } from "lucide-react";
import PageSubtitle from "@/components/PageSubtitle";
import { format } from "date-fns";

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<any[]>([]);
  const [role, setRole] = useState<string>("staff");
  const [staffId, setStaffId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/policies")
      .then((r) => r.json())
      .then((d) => {
        setPolicies(d.policies || []);
        setRole(d.role);
        setStaffId(d.staffId);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#223149] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const needsSignoff = policies.filter((p) => p.requires_signoff);
  const noSignoff = policies.filter((p) => !p.requires_signoff);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-[#223149]">Policies</h1>
          <PageSubtitle pageKey="policies" defaultDescription="Review company policies and sign off where your acknowledgement is required." />
          <p className="text-[#5F7C84] mt-1 text-sm">
            {policies.length} active {policies.length === 1 ? "policy" : "policies"}
          </p>
        </div>
        {role === "admin" && (
          <Link
            href="/dashboard/policies/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Policy
          </Link>
        )}
      </div>

      {policies.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 shadow-sm text-center">
          <Shield className="w-10 h-10 text-[#9BADB7] mx-auto mb-3" />
          <p className="text-[#5F7C84] font-medium">No policies yet</p>
          {role === "admin" && (
            <Link href="/dashboard/policies/new" className="text-sm text-[#223149] underline mt-1 inline-block">
              Create your first policy
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Requires sign-off */}
          {needsSignoff.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-[#5F7C84] uppercase tracking-wide">
                Requires Sign-off
              </h2>
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-[#ECE3DF]">
                {needsSignoff.map((policy) => (
                  <PolicyRow key={policy.id} policy={policy} role={role} staffId={staffId} />
                ))}
              </div>
            </div>
          )}

          {/* Reference only */}
          {noSignoff.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-[#5F7C84] uppercase tracking-wide">
                Reference Documents
              </h2>
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-[#ECE3DF]">
                {noSignoff.map((policy) => (
                  <PolicyRow key={policy.id} policy={policy} role={role} staffId={staffId} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PolicyRow({ policy, role, staffId }: { policy: any; role: string; staffId: string }) {
  return (
    <Link
      href={`/dashboard/policies/${policy.id}`}
      className="flex items-center gap-4 px-6 py-4 hover:bg-[#F8F6F4] transition-colors group"
    >
      <div className="w-10 h-10 rounded-xl bg-[#ECE3DF] flex items-center justify-center flex-shrink-0">
        <Shield className="w-5 h-5 text-[#223149]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-[#223149] truncate">{policy.title}</p>
          <span className="text-xs text-[#9BADB7] flex-shrink-0">v{policy.version}</span>
          {!policy.is_active && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500 flex-shrink-0">Archived</span>
          )}
        </div>
        {policy.description && (
          <p className="text-xs text-[#9BADB7] truncate mt-0.5">{policy.description}</p>
        )}
        <p className="text-xs text-[#9BADB7] mt-0.5">
          Added {format(new Date(policy.created_at), "d MMM yyyy")}
          {policy.created_by_staff?.full_name && ` · by ${policy.created_by_staff.full_name}`}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {policy.requires_signoff && (
          <span className="flex items-center gap-1 text-xs text-[#9BADB7]">
            <Clock className="w-3.5 h-3.5" />
            Sign-off required
          </span>
        )}
        <ChevronRight className="w-4 h-4 text-[#9BADB7] group-hover:text-[#223149] transition-colors" />
      </div>
    </Link>
  );
}
