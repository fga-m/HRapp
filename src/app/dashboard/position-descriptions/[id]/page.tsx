"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Edit,
  History,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Briefcase,
} from "lucide-react";
import { format } from "date-fns";
import { MarkdownContent } from "@/components/MarkdownContent";

function AvatarInitial({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  if (avatarUrl) {
    return (
      <img src={avatarUrl} alt={name} className="w-10 h-10 rounded-full object-cover" />
    );
  }
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return (
    <div className="w-10 h-10 rounded-full bg-[#223149] flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
      {initials}
    </div>
  );
}

export default function PositionDescriptionDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditMode = searchParams.get("edit") === "true";

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [acknowledging, setAcknowledging] = useState(false);
  const [ackSuccess, setAckSuccess] = useState(false);
  const [ackError, setAckError] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [newVersionNumber, setNewVersionNumber] = useState("");
  const [versionError, setVersionError] = useState("");
  const [bumpingVersion, setBumpingVersion] = useState(false);

  // Edit mode state
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const fetchData = () => {
    setLoading(true);
    fetch(`/api/position-descriptions/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        if (d.pd) {
          setEditTitle(d.pd.title);
          setEditContent(d.pd.content);
        }
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleAcknowledge = async () => {
    setAcknowledging(true);
    setAckError("");
    try {
      const res = await fetch(`/api/position-descriptions/${id}/acknowledge`, {
        method: "POST",
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setAckSuccess(true);
      fetchData();
    } catch (err: any) {
      setAckError(err.message);
    } finally {
      setAcknowledging(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) {
      setSaveError("Title is required.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch(`/api/position-descriptions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle.trim(), content: editContent }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      router.push(`/dashboard/position-descriptions/${id}`);
      fetchData();
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleBumpVersion = async () => {
    const versionNum = parseFloat(newVersionNumber);
    if (!newVersionNumber || isNaN(versionNum) || versionNum <= (data?.pd?.version || 0)) {
      setVersionError(`Version must be a number greater than the current version (${data?.pd?.version}).`);
      return;
    }
    setVersionError("");
    setBumpingVersion(true);
    setShowVersionModal(false);
    await fetch(`/api/position-descriptions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bump_version: true,
        new_version: versionNum,
      }),
    });
    setBumpingVersion(false);
    setNewVersionNumber("");
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#223149] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data?.pd) return <div className="text-[#50676E]">Position description not found.</div>;

  const { pd, ackHistory, myAck, role, currentYear, assignedStaff } = data;
  const isAdmin = role === "admin";
  const isAcknowledged = !!myAck;

  // Edit mode
  if (isEditMode && isAdmin) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href={`/dashboard/position-descriptions/${id}`}
            className="p-2 rounded-xl hover:bg-[#ECE3DF] transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-[#223149]" />
          </Link>
          <h1 className="text-2xl font-bold text-[#223149]">Edit Position Description</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-[#223149] mb-1.5">Title</label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#223149] mb-1.5">Content</label>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={24}
              className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors resize-y"
            />
          </div>
          {saveError && <p className="text-sm text-red-500">{saveError}</p>}
          <div className="flex gap-3">
            <button
              onClick={handleSaveEdit}
              disabled={saving}
              className="px-6 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <Link
              href={`/dashboard/position-descriptions/${id}`}
              className="px-6 py-2.5 border border-[#ECE3DF] text-[#50676E] rounded-xl text-sm font-semibold hover:bg-[#F8F6F4] transition-colors"
            >
              Cancel
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/position-descriptions"
          className="p-2 rounded-xl hover:bg-[#ECE3DF] transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-[#223149]" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-bold text-[#223149]">{pd.title}</h1>
            <span className="text-sm text-[#50676E] font-medium bg-[#F8F6F4] px-2 py-0.5 rounded-full">
              v{pd.version}
            </span>
            {!pd.is_active && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">
                Archived
              </span>
            )}
          </div>
        </div>
        {isAdmin && (
          <Link
            href={`/dashboard/position-descriptions/${id}?edit=true`}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#ECE3DF] text-sm font-medium text-[#50676E] hover:bg-[#F8F6F4] transition-colors flex-shrink-0"
          >
            <Edit className="w-4 h-4" />
            <span className="hidden sm:inline">Edit</span>
          </Link>
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start">
        {/* LEFT — Content (below the action panel on mobile) */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden order-last lg:order-none">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-[#ECE3DF]">
            <Briefcase className="w-4 h-4 text-[#50676E]" />
            <span className="text-sm font-semibold text-[#223149]">Position Description</span>
          </div>

          <div className="px-6 py-5">
            {pd.content ? (
              <MarkdownContent content={pd.content} />
            ) : (
              <p className="text-sm text-[#50676E] text-center py-8">No content yet.</p>
            )}
          </div>

          <div className="px-5 py-3 border-t border-[#ECE3DF] text-xs text-[#50676E]">
            Created {format(new Date(pd.created_at), "d MMM yyyy")}
            {pd.updated_at && pd.updated_at !== pd.created_at && (
              <> · Updated {format(new Date(pd.updated_at), "d MMM yyyy")}</>
            )}
          </div>
        </div>

        {/* RIGHT — Action panel (above the document on mobile) */}
        <div className="space-y-4 order-first lg:order-none lg:sticky lg:top-6 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto">
          {/* Assigned staff card */}
          {assignedStaff && (
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <p className="text-xs font-semibold text-[#50676E] uppercase tracking-wide mb-3">
                Assigned To
              </p>
              <div className="flex items-center gap-3">
                <AvatarInitial
                  name={assignedStaff.full_name}
                  avatarUrl={assignedStaff.avatar_url}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#223149] text-sm truncate">
                    {assignedStaff.full_name}
                  </p>
                  <p className="text-xs text-[#50676E] truncate">{assignedStaff.email}</p>
                  {assignedStaff.position && (
                    <p className="text-xs text-[#50676E] truncate mt-0.5">{assignedStaff.position}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Acknowledgement card */}
          <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-col items-center text-center gap-3">
            {isAcknowledged ? (
              <>
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-500" />
                </div>
                <p className="font-semibold text-[#223149] text-sm">
                  Acknowledged for {currentYear}
                </p>
                <p className="text-xs text-[#50676E]">
                  {format(new Date(myAck.acknowledged_at), "d MMM yyyy, h:mm a")}
                </p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-amber-500" />
                </div>
                <p className="font-semibold text-[#223149] text-sm">Acknowledgement required</p>
                <p className="text-xs text-[#50676E]">
                  Please read your position description then acknowledge below
                </p>
                {ackError && <p className="text-xs text-red-500">{ackError}</p>}
                {ackSuccess && (
                  <p className="text-xs text-green-600">Acknowledged successfully!</p>
                )}
                {/* Only show the button if this is the assigned staff member's own PD */}
                {(!isAdmin || data.staffId === pd.staff_id) && (
                  <button
                    onClick={handleAcknowledge}
                    disabled={acknowledging}
                    className="w-full px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50"
                  >
                    {acknowledging ? "Acknowledging..." : "I Agree & Acknowledge"}
                  </button>
                )}
              </>
            )}

            {/* Admin: version bump button */}
            {isAdmin && (
              <div className="w-full pt-3 border-t border-[#ECE3DF]">
                <button
                  onClick={() => {
                    setNewVersionNumber(String(Math.floor(data?.pd?.version || 1) + 1));
                    setShowVersionModal(true);
                  }}
                  disabled={bumpingVersion}
                  className="flex items-center justify-center gap-1.5 w-full text-xs font-semibold text-[#50676E] hover:text-[#223149] transition-colors py-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {bumpingVersion ? "Updating..." : "Update Version"}
                </button>
              </div>
            )}
          </div>

          {/* Acknowledgement history (admin only) */}
          {isAdmin && ackHistory && ackHistory.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <button
                onClick={() => setShowHistory((v) => !v)}
                className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-[#F8F6F4] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-[#50676E]" />
                  <span className="font-semibold text-[#223149] text-sm">
                    Acknowledgement History
                  </span>
                  <span className="text-xs text-[#50676E]">({ackHistory.length})</span>
                </div>
                {showHistory ? (
                  <ChevronUp className="w-4 h-4 text-[#50676E]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[#50676E]" />
                )}
              </button>
              {showHistory && (
                <div className="px-5 pb-4 space-y-2 border-t border-[#ECE3DF] pt-3">
                  {ackHistory.map((a: any) => (
                    <div key={a.id} className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-[#F8F6F4] flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="w-3 h-3 text-[#50676E]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#223149] truncate">
                          {a.staff?.full_name}
                        </p>
                        <p className="text-xs text-[#50676E]">
                          v{a.pd_version} · {a.ack_year}
                        </p>
                      </div>
                      <p className="text-xs text-[#50676E] flex-shrink-0">
                        {format(new Date(a.acknowledged_at), "d MMM yy")}
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
          <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-xl p-6 pb-8 md:pb-6 w-full md:max-w-sm space-y-4 pb-safe">
            <h2 className="text-lg font-bold text-[#223149]">Update Version</h2>
            <p className="text-sm text-[#50676E]">
              Current version:{" "}
              <span className="font-semibold">v{data?.pd?.version}</span>. The assigned staff
              member will be notified to re-acknowledge.
            </p>
            <div>
              <label className="block text-sm font-semibold text-[#223149] mb-1.5">
                New Version Number
              </label>
              <input
                type="number"
                min={Number(data?.pd?.version || 1) + 0.1}
                step={0.1}
                value={newVersionNumber}
                onChange={(e) => { setNewVersionNumber(e.target.value); if (versionError) setVersionError(""); }}
                className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
                placeholder={String(Math.floor(data?.pd?.version || 1) + 1)}
                autoFocus
              />
              {versionError && <p className="text-xs text-red-500 mt-1.5">{versionError}</p>}
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
