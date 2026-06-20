"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, FileText, ExternalLink, CheckCircle,
  Clock, Send, Users, MessageSquare, Share2, AlertTriangle
} from "lucide-react";
import { MarkdownContent } from "@/components/MarkdownContent";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { format } from "date-fns";

const TYPE_LABELS: Record<string, string> = {
  "1on1": "1-on-1",
  team: "Team Meeting",
  performance_review: "Performance Review",
  projects_goals: "Projects & Goals",
};

const TYPE_COLOURS: Record<string, string> = {
  "1on1": "bg-blue-100 text-blue-700",
  team: "bg-purple-100 text-purple-700",
  performance_review: "bg-amber-100 text-amber-700",
  projects_goals: "bg-green-100 text-green-700",
};

export default function MeetingDetailPage() {
  const { id } = useParams();
  const confirm = useConfirm();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const [suggestion, setSuggestion] = useState("");
  const [showSuggest, setShowSuggest] = useState(false);
  const [submittingSuggestion, setSubmittingSuggestion] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchNote = () => {
    setLoading(true);
    setLoadError("");
    fetch(`/api/meetings/${id}`)
      .then((r) => { if (!r.ok) throw new Error("Failed to load"); return r.json(); })
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setLoadError("Could not load this meeting note. Please try again."); setLoading(false); });
  };

  useEffect(() => { fetchNote(); }, [id]);

  const handleShare = async () => {
    if (!(await confirm({ title: "Share these notes with the attendees?", message: "They'll be notified and can view, acknowledge, or suggest changes.", confirmLabel: "Share" }))) return;
    setSharing(true);
    setError("");
    try {
      const res = await fetch(`/api/meetings/${id}/share`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Failed to share notes.");
      fetchNote();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSharing(false);
    }
  };

  const handleAcknowledge = async () => {
    setAcknowledging(true);
    setError("");
    try {
      const res = await fetch(`/api/meetings/${id}/acknowledge`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setSuccess("Acknowledged!");
      fetchNote();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAcknowledging(false);
    }
  };

  const handleSuggest = async () => {
    if (!suggestion.trim()) return;
    setSubmittingSuggestion(true);
    setError("");
    try {
      const res = await fetch(`/api/meetings/${id}/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestion }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setSuggestion("");
      setShowSuggest(false);
      setSuccess("Suggestion sent to the note author.");
      fetchNote();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmittingSuggestion(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#223149] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{loadError}</p>
        </div>
        <button
          onClick={fetchNote}
          className="px-4 py-2 border border-[#ECE3DF] text-[#50676E] rounded-xl text-sm font-semibold hover:bg-[#F8F6F4] transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data?.note) return <div className="text-[#50676E]">Meeting note not found.</div>;

  const { note, attendees, myAck, suggestions, canManage } = data;
  const isShared = note.is_shared_with_staff;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/meetings" className="p-2 rounded-xl hover:bg-[#ECE3DF] transition-colors">
          <ArrowLeft className="w-5 h-5 text-[#223149]" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-[#223149]">{note.title}</h1>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLOURS[note.meeting_type] || "bg-gray-100 text-gray-600"}`}>
              {TYPE_LABELS[note.meeting_type] || note.meeting_type}
            </span>
          </div>
          <p className="text-[#50676E] mt-1 text-sm">
            {format(new Date(note.meeting_date), "EEEE, d MMMM yyyy")}
          </p>
        </div>
        {/* Admin: Share button */}
        {canManage && !isShared && (
          <button
            onClick={handleShare}
            disabled={sharing}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50"
          >
            <Share2 className="w-4 h-4" />
            {sharing ? "Sharing..." : "Share with Staff"}
          </button>
        )}
        {canManage && isShared && (
          <span className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-50 text-green-700 text-sm font-medium">
            <CheckCircle className="w-4 h-4" />
            Shared with staff
          </span>
        )}
      </div>

      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
          {success}
        </div>
      )}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        {/* Main content */}
        <div className="md:col-span-2 space-y-4">
          {/* Drive link */}
          {note.drive_file_url && (
            <div className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm p-5">
              <p className="text-sm font-semibold text-[#223149] mb-3">Document</p>
              <a
                href={note.drive_file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 bg-[#F8F6F4] rounded-xl hover:bg-[#ECE3DF] transition-colors group"
              >
                <div className="w-9 h-9 rounded-lg bg-[#223149] flex items-center justify-center">
                  <ExternalLink className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#223149]">Open in Google Drive</p>
                  <p className="text-xs text-[#50676E]">View the full meeting document</p>
                </div>
              </a>
            </div>
          )}

          {/* Notes content */}
          {note.content && (
            <div className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm p-5">
              <p className="text-sm font-semibold text-[#223149] mb-4">Notes</p>
              <MarkdownContent content={note.content} />
            </div>
          )}

          {/* Staff: Acknowledge / Suggest Changes */}
          {!canManage && isShared && (
            <div className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm p-5 space-y-4">
              <p className="text-sm font-semibold text-[#223149]">Your Response</p>

              {myAck ? (
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <div>
                    <p className="text-sm font-semibold text-green-800">Acknowledged</p>
                    <p className="text-xs text-green-600">
                      {format(new Date(myAck.acknowledged_at), "d MMM yyyy, h:mm a")}
                    </p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleAcknowledge}
                  disabled={acknowledging}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  {acknowledging ? "Acknowledging..." : "Acknowledge I've read this"}
                </button>
              )}

              {/* Suggest changes */}
              {!showSuggest ? (
                <button
                  onClick={() => setShowSuggest(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-[#ECE3DF] text-[#50676E] rounded-xl text-sm font-semibold hover:bg-[#F8F6F4] transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  Suggest Changes
                </button>
              ) : (
                <div className="space-y-3">
                  <textarea
                    rows={4}
                    value={suggestion}
                    onChange={(e) => setSuggestion(e.target.value)}
                    placeholder="Describe what you'd like amended or clarified..."
                    className="w-full px-4 py-3 rounded-xl border border-[#ECE3DF] text-sm text-[#223149] placeholder:text-[#6E8189] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSuggest}
                      disabled={submittingSuggestion || !suggestion.trim()}
                      className="flex items-center gap-2 px-4 py-2 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {submittingSuggestion ? "Sending..." : "Send Suggestion"}
                    </button>
                    <button
                      onClick={() => { setShowSuggest(false); setSuggestion(""); }}
                      className="px-4 py-2 border border-[#ECE3DF] text-[#50676E] rounded-xl text-sm font-semibold hover:bg-[#F8F6F4] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Attendees */}
          <div className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-[#50676E]" />
              <p className="text-sm font-semibold text-[#223149]">Attendees</p>
            </div>
            <div className="space-y-2">
              {attendees.map((a: any) => (
                <div key={a.id} className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-[#223149] flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">
                      {a.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#223149]">{a.full_name}</p>
                  </div>
                </div>
              ))}
              {attendees.length === 0 && (
                <p className="text-xs text-[#50676E]">No attendees listed</p>
              )}
            </div>
          </div>

          {/* Suggestions (admin view) */}
          {canManage && suggestions.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-4 h-4 text-[#50676E]" />
                <p className="text-sm font-semibold text-[#223149]">Suggested Changes</p>
              </div>
              <div className="space-y-3">
                {suggestions.map((s: any) => (
                  <div key={s.id} className="p-3 bg-amber-50 rounded-xl">
                    <p className="text-xs font-semibold text-amber-800 mb-1">{s.staff?.full_name}</p>
                    <p className="text-sm text-amber-700">{s.suggestion}</p>
                    <p className="text-xs text-amber-500 mt-1">
                      {format(new Date(s.created_at), "d MMM yyyy")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Meta */}
          <div className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm p-5">
            <p className="text-xs text-[#50676E]">
              Created {format(new Date(note.created_at), "d MMM yyyy")}
            </p>
            {note.creator?.full_name && !canManage && (
              <p className="text-xs text-[#50676E] mt-1">by {note.creator.full_name}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
