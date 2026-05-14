"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Shield, CheckCircle, Clock, ExternalLink,
  Users, RefreshCw, Check, AlertCircle
} from "lucide-react";
import { format } from "date-fns";

export default function PolicyDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [bumpingVersion, setBumpingVersion] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [signSuccess, setSignSuccess] = useState(false);
  const [error, setError] = useState("");

  const fetchPolicy = () => {
    setLoading(true);
    fetch(`/api/policies/${id}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  };

  useEffect(() => { fetchPolicy(); }, [id]);

  const handleSignoff = async () => {
    setSigning(true);
    setError("");
    try {
      const res = await fetch(`/api/policies/${id}/signoff`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setSignSuccess(true);
      fetchPolicy();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSigning(false);
    }
  };

  const handleBumpVersion = async () => {
    if (!confirm("This will create a new version and notify all staff to re-sign. Continue?")) return;
    setBumpingVersion(true);
    await fetch(`/api/policies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bump_version: true, requires_signoff: data.policy.requires_signoff }),
    });
    setBumpingVersion(false);
    fetchPolicy();
  };

  const handleArchive = async () => {
    if (!confirm("Archive this policy? Staff will no longer see it.")) return;
    setArchiving(true);
    await fetch(`/api/policies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: false }),
    });
    setArchiving(false);
    router.push("/dashboard/policies");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#223149] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data?.policy) return <div className="text-[#9BADB7]">Policy not found.</div>;

  const { policy, signoffs, unsigned, mySignoff, role } = data;
  const signedCount = signoffs.length;
  const totalCount = signedCount + unsigned.length;
  const progress = totalCount > 0 ? Math.round((signedCount / totalCount) * 100) : 0;
  const isSigned = !!mySignoff;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/policies" className="p-2 rounded-xl hover:bg-[#ECE3DF] transition-colors">
          <ArrowLeft className="w-5 h-5 text-[#223149]" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-[#223149]">{policy.title}</h1>
            <span className="text-sm text-[#9BADB7] font-medium">v{policy.version}</span>
            {!policy.is_active && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">Archived</span>
            )}
          </div>
          {policy.description && (
            <p className="text-[#5F7C84] mt-1 text-sm">{policy.description}</p>
          )}
        </div>
      </div>

      {/* Document + Staff Sign-off action */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Document card */}
        <div className="md:col-span-2 bg-white rounded-2xl shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#9BADB7]" />
            <span className="text-sm font-semibold text-[#223149]">Policy Document</span>
          </div>

          {policy.content_drive_url ? (
            <a
              href={policy.content_drive_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 bg-[#F8F6F4] rounded-xl hover:bg-[#ECE3DF] transition-colors group"
            >
              <div className="w-9 h-9 rounded-lg bg-[#223149] flex items-center justify-center flex-shrink-0">
                <ExternalLink className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#223149]">Open in Google Drive</p>
                <p className="text-xs text-[#9BADB7] truncate">{policy.content_drive_url}</p>
              </div>
            </a>
          ) : (
            <div className="p-4 bg-[#F8F6F4] rounded-xl text-sm text-[#9BADB7] text-center">
              No document linked yet.
            </div>
          )}

          <div className="text-xs text-[#9BADB7] pt-1 border-t border-[#ECE3DF]">
            Created {format(new Date(policy.created_at), "d MMM yyyy")}
            {policy.created_by_staff?.full_name && ` by ${policy.created_by_staff.full_name}`}
          </div>
        </div>

        {/* Staff sign-off action */}
        {policy.requires_signoff && role === "staff" && (
          <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-col items-center justify-center text-center gap-3">
            {isSigned ? (
              <>
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-500" />
                </div>
                <p className="font-semibold text-[#223149] text-sm">You've signed off</p>
                <p className="text-xs text-[#9BADB7]">
                  {format(new Date(mySignoff.signed_at), "d MMM yyyy, h:mm a")}
                </p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-amber-500" />
                </div>
                <p className="font-semibold text-[#223149] text-sm">Sign-off required</p>
                <p className="text-xs text-[#9BADB7]">Please read the policy then sign off below</p>
                {error && <p className="text-xs text-red-500">{error}</p>}
                {signSuccess && <p className="text-xs text-green-600">Signed successfully!</p>}
                <button
                  onClick={handleSignoff}
                  disabled={signing}
                  className="w-full px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50"
                >
                  {signing ? "Signing..." : "I Agree & Sign Off"}
                </button>
              </>
            )}
          </div>
        )}

        {/* Admin sign-off progress */}
        {policy.requires_signoff && role === "admin" && (
          <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-3">
            <p className="text-sm font-semibold text-[#223149]">Sign-off Progress</p>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-[#223149]">{signedCount}</span>
              <span className="text-sm text-[#9BADB7] mb-1">/ {totalCount} staff</span>
            </div>
            <div className="w-full bg-[#ECE3DF] rounded-full h-2">
              <div
                className="bg-[#223149] h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-[#9BADB7]">{progress}% complete</p>
          </div>
        )}
      </div>

      {/* Sign-off tracker (admin only) */}
      {role === "admin" && policy.requires_signoff && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#ECE3DF] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#9BADB7]" />
              <span className="font-semibold text-[#223149]">Sign-off Tracker</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleBumpVersion}
                disabled={bumpingVersion}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#5F7C84] hover:text-[#223149] transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {bumpingVersion ? "Updating..." : "New Version"}
              </button>
              <button
                onClick={handleArchive}
                disabled={archiving}
                className="text-xs font-semibold text-red-400 hover:text-red-600 transition-colors"
              >
                {archiving ? "Archiving..." : "Archive"}
              </button>
            </div>
          </div>

          {/* Signed */}
          {signoffs.length > 0 && (
            <div className="px-6 py-3 border-b border-[#ECE3DF]">
              <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-2">Signed</p>
              <div className="space-y-2">
                {signoffs.map((s: any) => (
                  <div key={s.id} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3.5 h-3.5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[#223149]">{s.staff?.full_name}</p>
                      <p className="text-xs text-[#9BADB7]">{s.staff?.email}</p>
                    </div>
                    <p className="text-xs text-[#9BADB7]">
                      {format(new Date(s.signed_at), "d MMM yyyy")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Not signed */}
          {unsigned.length > 0 && (
            <div className="px-6 py-3">
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2">Pending</p>
              <div className="space-y-2">
                {unsigned.map((s: any) => (
                  <div key={s.id} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[#223149]">{s.full_name}</p>
                      <p className="text-xs text-[#9BADB7]">{s.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
