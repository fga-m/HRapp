"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Shield, CheckCircle, Clock, ExternalLink,
  Users, RefreshCw, Check, Maximize2, Minimize2, Edit, History, ChevronDown, ChevronUp, AlertTriangle
} from "lucide-react";
import { format } from "date-fns";
import { useConfirm } from "@/components/ui/ConfirmDialog";

function getEmbedUrl(url: string): string {
  if (url.includes("docs.google.com/document"))
    return url.replace(/\/edit.*$/, "/preview").replace(/\/view.*$/, "/preview");
  if (url.includes("docs.google.com/spreadsheets"))
    return url.replace(/\/edit.*$/, "/preview").replace(/\/view.*$/, "/preview");
  if (url.includes("docs.google.com/presentation"))
    return url.replace(/\/edit.*$/, "/preview").replace(/\/view.*$/, "/preview");
  if (url.includes("drive.google.com/file"))
    return url.replace(/\/view.*$/, "/preview").replace(/\/edit.*$/, "/preview");
  return url;
}

export default function PolicyDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const confirm = useConfirm();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [bumpingVersion, setBumpingVersion] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [signSuccess, setSignSuccess] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [versionError, setVersionError] = useState("");
  const [newVersionNumber, setNewVersionNumber] = useState("");
  const [newDriveUrl, setNewDriveUrl] = useState("");
  const [docExpanded, setDocExpanded] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState("");

  const fetchPolicy = () => {
    setLoading(true);
    setError("");
    fetch(`/api/policies/${id}`)
      .then((r) => { if (!r.ok) throw new Error("Failed to load"); return r.json(); })
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError("Could not load this policy. Please try again."); setLoading(false); });
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
    const versionNum = parseFloat(newVersionNumber);
    if (!newVersionNumber || isNaN(versionNum) || versionNum <= (data?.policy?.version || 0)) {
      setVersionError(`Version must be a number greater than the current version (${data?.policy?.version}).`);
      return;
    }
    setVersionError("");
    setBumpingVersion(true);
    setShowVersionModal(false);
    await fetch(`/api/policies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bump_version: true,
        new_version: versionNum,
        requires_signoff: data.policy.requires_signoff,
        ...(newDriveUrl.trim() && { content_drive_url: newDriveUrl.trim() }),
      }),
    });
    setBumpingVersion(false);
    setNewVersionNumber("");
    setNewDriveUrl("");
    fetchPolicy();
  };

  const handleArchive = async () => {
    if (!(await confirm({ title: "Archive this policy?", message: "Staff will no longer see it.", confirmLabel: "Archive", danger: true }))) return;
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

  if (error && !data?.policy) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
        <button
          onClick={fetchPolicy}
          className="px-4 py-2 border border-[#ECE3DF] text-[#50676E] rounded-xl text-sm font-semibold hover:bg-[#F8F6F4] transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data?.policy) return <div className="text-[#50676E]">Policy not found.</div>;

  const { policy, signoffs, signoffHistory, unsigned, mySignoff, role, currentYear } = data;
  const signedCount = signoffs.length;
  const totalCount = signedCount + unsigned.length;
  const progress = totalCount > 0 ? Math.round((signedCount / totalCount) * 100) : 0;
  const isSigned = !!mySignoff;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/policies" className="p-2 rounded-xl hover:bg-[#ECE3DF] transition-colors">
          <ArrowLeft className="w-5 h-5 text-[#223149]" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-bold text-[#223149]">{policy.title}</h1>
            <span className="text-sm text-[#50676E] font-medium">v{policy.version}</span>
            {!policy.is_active && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">Archived</span>
            )}
          </div>
          {policy.description && (
            <p className="text-[#50676E] mt-1 text-sm">{policy.description}</p>
          )}
        </div>
        {role === "admin" && (
          <Link
            href={`/dashboard/policies/${id}/edit`}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#ECE3DF] text-sm font-medium text-[#50676E] hover:bg-[#F8F6F4] transition-colors flex-shrink-0"
          >
            <Edit className="w-4 h-4" />
            <span className="hidden sm:inline">Edit</span>
          </Link>
        )}
      </div>

      {/* Two-column layout: document left, sign-off panel right */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start">

        {/* LEFT — Document */}
        <div className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm overflow-hidden order-last lg:order-none">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#ECE3DF]">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#50676E]" />
              <span className="text-sm font-semibold text-[#223149]">Policy Document</span>
            </div>
            <div className="flex items-center gap-2">
              {policy.content_drive_url && (
                <>
                  <button
                    onClick={() => setDocExpanded((v) => !v)}
                    className="p-1.5 rounded-lg hover:bg-[#F8F6F4] transition-colors"
                    title={docExpanded ? "Collapse" : "Expand"}
                    aria-label={docExpanded ? "Collapse" : "Expand"}
                  >
                    {docExpanded
                      ? <Minimize2 className="w-4 h-4 text-[#50676E]" />
                      : <Maximize2 className="w-4 h-4 text-[#50676E]" />}
                  </button>
                  <a
                    href={policy.content_drive_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg hover:bg-[#F8F6F4] transition-colors"
                    title="Open in Google Drive"
                    aria-label="Open in Google Drive"
                  >
                    <ExternalLink className="w-4 h-4 text-[#50676E]" />
                  </a>
                </>
              )}
            </div>
          </div>

          {policy.content_drive_url ? (
            docExpanded ? (
              <iframe
                src={getEmbedUrl(policy.content_drive_url)}
                className="w-full border-0"
                style={{ height: "calc(100vh - 220px)", minHeight: "500px" }}
                title={policy.title}
                allow="autoplay"
              />
            ) : (
              <div
                className="px-5 py-4 cursor-pointer hover:bg-[#F8F6F4] transition-colors"
                onClick={() => setDocExpanded(true)}
              >
                <p className="text-sm text-[#50676E]">Click to view document</p>
              </div>
            )
          ) : (
            <div className="px-5 py-12 text-sm text-[#50676E] text-center">
              No document linked yet.
            </div>
          )}

          <div className="px-5 py-3 border-t border-[#ECE3DF] text-xs text-[#50676E]">
            Created {format(new Date(policy.created_at), "d MMM yyyy")}
            {policy.created_by_staff?.full_name && ` by ${policy.created_by_staff.full_name}`}
          </div>
        </div>

        {/* RIGHT — Sign-off action + tracker */}
        <div className="space-y-4 order-first lg:order-none lg:sticky lg:top-6 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto">

          {/* Sign-off action card */}
          {policy.requires_signoff && (
            <div className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm p-5 flex flex-col items-center text-center gap-3">
              {isSigned ? (
                <>
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-green-500" />
                  </div>
                  <p className="font-semibold text-[#223149] text-sm">Signed for {currentYear}</p>
                  <p className="text-xs text-[#50676E]">
                    {format(new Date(mySignoff.signed_at), "d MMM yyyy, h:mm a")}
                  </p>
                  <p className="text-xs text-[#50676E]">Renews each year.</p>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                    <Clock className="w-6 h-6 text-amber-500" />
                  </div>
                  <p className="font-semibold text-[#223149] text-sm">Sign-off required</p>
                  <p className="text-xs text-[#50676E]">Please read the policy then sign off below</p>
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

              {/* Admin progress bar */}
              {role === "admin" && (
                <div className="w-full pt-3 border-t border-[#ECE3DF] space-y-2">
                  <div className="flex justify-between text-xs text-[#50676E]">
                    <span>Team sign-off</span>
                    <span>{signedCount} / {totalCount}</span>
                  </div>
                  <div className="w-full bg-[#ECE3DF] rounded-full h-1.5">
                    <div
                      className="bg-[#223149] h-1.5 rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-[#50676E]">{progress}% of team signed</p>
                </div>
              )}
            </div>
          )}

          {/* Sign-off tracker (admin only) */}
          {role === "admin" && policy.requires_signoff && (
            <div className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#ECE3DF] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#50676E]" />
                  <span className="font-semibold text-[#223149] text-sm">Sign-off Tracker</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setNewVersionNumber(String(Math.floor(data?.policy?.version || 1) + 1));
                      setNewDriveUrl(data?.policy?.content_drive_url || "");
                      setShowVersionModal(true);
                    }}
                    disabled={bumpingVersion}
                    className="flex items-center gap-1.5 text-xs font-semibold text-[#50676E] hover:text-[#223149] transition-colors"
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
                <div className="px-5 py-3 border-b border-[#ECE3DF]">
                  <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-2">Signed</p>
                  <div className="space-y-2">
                    {signoffs.map((s: any) => (
                      <div key={s.id} className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                          <Check className="w-3 h-3 text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#223149] truncate">{s.staff?.full_name}</p>
                          <p className="text-xs text-[#50676E] truncate">{s.staff?.email}</p>
                        </div>
                        <p className="text-xs text-[#50676E] flex-shrink-0">
                          {format(new Date(s.signed_at), "d MMM")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pending */}
              {unsigned.length > 0 && (
                <div className="px-5 py-3">
                  <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2">Pending</p>
                  <div className="space-y-2">
                    {unsigned.map((s: any) => (
                      <div key={s.id} className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                          <Clock className="w-3 h-3 text-amber-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#223149] truncate">{s.full_name}</p>
                          <p className="text-xs text-[#50676E] truncate">{s.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sign-off History (admin only) */}
          {role === "admin" && signoffHistory && signoffHistory.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm overflow-hidden">
              <button
                onClick={() => setShowHistory((v) => !v)}
                className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-[#F8F6F4] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-[#50676E]" />
                  <span className="font-semibold text-[#223149] text-sm">Sign-off History</span>
                  <span className="text-xs text-[#50676E]">({signoffHistory.length})</span>
                </div>
                {showHistory
                  ? <ChevronUp className="w-4 h-4 text-[#50676E]" />
                  : <ChevronDown className="w-4 h-4 text-[#50676E]" />}
              </button>
              {showHistory && (
                <div className="px-5 pb-4 space-y-2 border-t border-[#ECE3DF] pt-3">
                  {signoffHistory.map((s: any) => (
                    <div key={s.id} className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-[#F8F6F4] flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-[#50676E]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#223149] truncate">{s.staff?.full_name}</p>
                        <p className="text-xs text-[#50676E]">v{s.policy_version} · {s.signoff_year}</p>
                      </div>
                      <p className="text-xs text-[#50676E] flex-shrink-0">
                        {format(new Date(s.signed_at), "d MMM yy")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Version Modal */}
      {showVersionModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-xl p-6 w-full md:max-w-sm space-y-4 pb-safe">
            <h2 className="text-lg font-bold text-[#223149]">Update Version</h2>
            <p className="text-sm text-[#50676E]">
              Current version: <span className="font-semibold">v{data?.policy?.version}</span>. All staff will be notified to re-sign.
            </p>
            <div>
              <label htmlFor="new-version-number" className="block text-sm font-semibold text-[#223149] mb-1.5">New Version Number</label>
              <input id="new-version-number"
                type="number"
                min={Number(data?.policy?.version || 1) + 0.1}
                step={0.1}
                value={newVersionNumber}
                onChange={(e) => { setNewVersionNumber(e.target.value); if (versionError) setVersionError(""); }}
                className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
                placeholder={String(Math.floor(data?.policy?.version || 1) + 1)}
                autoFocus
              />
              {versionError && <p className="text-xs text-red-500 mt-1.5">{versionError}</p>}
            </div>
            <div>
              <label htmlFor="updated-drive-link" className="block text-sm font-semibold text-[#223149] mb-1.5">
                Updated Drive Link
                <span className="ml-1 text-xs font-normal text-[#50676E]">(optional)</span>
              </label>
              <input id="updated-drive-link"
                type="url"
                value={newDriveUrl}
                onChange={(e) => setNewDriveUrl(e.target.value)}
                placeholder="https://docs.google.com/..."
                className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#6E8189] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
              />
              <p className="text-xs text-[#50676E] mt-1">Leave blank to keep the existing document</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleBumpVersion}
                disabled={bumpingVersion}
                className="flex-1 px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50"
              >
                Update & Notify Staff
              </button>
              <button
                onClick={() => setShowVersionModal(false)}
                className="px-4 py-2.5 border border-[#ECE3DF] text-[#50676E] rounded-xl text-sm font-semibold hover:bg-[#F8F6F4] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
