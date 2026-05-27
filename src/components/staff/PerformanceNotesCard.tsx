"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Plus, Lock, Eye, Check, Trash2, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import Image from "next/image";

interface Note {
  id: string;
  content: string;
  is_visible_to_staff: boolean;
  acknowledged_at: string | null;
  created_at: string;
  updated_at: string;
  author: { id: string; full_name: string; avatar_url?: string } | null;
}

interface Props {
  staffId: string;
  callerId: string;
  isManager: boolean; // admin or manager with manage_staff
  isOwnProfile: boolean;
}

function AuthorAvatar({ author }: { author: Note["author"] }) {
  const name = author?.full_name ?? "?";
  const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  if (author?.avatar_url) {
    return (
      <Image src={author.avatar_url} alt={name} width={28} height={28}
        className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
    );
  }
  return (
    <div className="w-7 h-7 rounded-full bg-[#223149] flex items-center justify-center flex-shrink-0">
      <span className="text-white text-[10px] font-bold">{initials}</span>
    </div>
  );
}

export default function PerformanceNotesCard({ staffId, callerId, isManager, isOwnProfile }: Props) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>("staff");

  // Add note modal
  const [showAdd, setShowAdd] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newVisible, setNewVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const fetchNotes = () => {
    fetch(`/api/staff/${staffId}/notes`)
      .then((r) => r.json())
      .then((d) => {
        setNotes(d.notes ?? []);
        setRole(d.role ?? "staff");
        setLoading(false);
      });
  };

  useEffect(() => { fetchNotes(); }, [staffId]);

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch(`/api/staff/${staffId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newContent, is_visible_to_staff: newVisible }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed to save");
      setNotes([d, ...notes]);
      setNewContent("");
      setNewVisible(false);
      setShowAdd(false);
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleVisibility = async (note: Note) => {
    const next = !note.is_visible_to_staff;
    // Optimistic
    setNotes(notes.map((n) => n.id === note.id ? { ...n, is_visible_to_staff: next } : n));
    const res = await fetch(`/api/staff/${staffId}/notes/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_visible_to_staff: next }),
    });
    if (!res.ok) {
      // Revert
      setNotes(notes.map((n) => n.id === note.id ? { ...n, is_visible_to_staff: note.is_visible_to_staff } : n));
    }
  };

  const deleteNote = async (noteId: string) => {
    if (!confirm("Delete this note? This cannot be undone.")) return;
    setNotes(notes.filter((n) => n.id !== noteId));
    await fetch(`/api/staff/${staffId}/notes/${noteId}`, { method: "DELETE" });
  };

  const acknowledge = async (noteId: string) => {
    const res = await fetch(`/api/staff/${staffId}/notes/${noteId}/acknowledge`, { method: "POST" });
    if (res.ok) {
      const now = new Date().toISOString();
      setNotes(notes.map((n) => n.id === noteId ? { ...n, acknowledged_at: now } : n));
    }
  };

  // Don't render anything for staff viewing someone else's profile
  if (!isManager && !isOwnProfile) return null;
  // Don't render for staff if no visible notes
  if (!isManager && notes.length === 0 && !loading) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[#9BADB7]" />
          <span className="font-semibold text-[#223149]">Performance Notes</span>
          {isManager && notes.length > 0 && (
            <span className="text-xs text-[#9BADB7]">{notes.length}</span>
          )}
        </div>
        {isManager && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-[#5F7C84] hover:text-[#223149] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add note
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <div className="w-5 h-5 border-2 border-[#223149] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : notes.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm text-[#9BADB7]">
            {isManager ? "No notes yet. Add one to track performance observations." : "No notes to show."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => {
            const canEdit = isManager && (role === "admin" || note.author?.id === callerId);
            return (
              <div key={note.id} className="border border-[#ECE3DF] rounded-xl p-4 space-y-3">
                {/* Note meta row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <AuthorAvatar author={note.author} />
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-[#223149]">
                        {note.author?.full_name ?? "Unknown"}
                      </span>
                      <span className="text-xs text-[#9BADB7] ml-2">
                        {format(parseISO(note.created_at), "d MMM yyyy")}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Visibility badge */}
                    {isManager ? (
                      <button
                        onClick={() => toggleVisibility(note)}
                        title={note.is_visible_to_staff ? "Visible to staff — click to make confidential" : "Confidential — click to share with staff"}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                          note.is_visible_to_staff
                            ? "bg-blue-50 text-blue-600 hover:bg-blue-100"
                            : "bg-[#F8F6F4] text-[#9BADB7] hover:bg-[#ECE3DF]"
                        }`}
                      >
                        {note.is_visible_to_staff ? <Eye className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                        {note.is_visible_to_staff ? "Visible" : "Confidential"}
                      </button>
                    ) : (
                      note.is_visible_to_staff && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600">
                          <Eye className="w-3 h-3" />
                          Shared with you
                        </span>
                      )
                    )}
                    {/* Delete */}
                    {canEdit && (
                      <button
                        onClick={() => deleteNote(note.id)}
                        className="p-1 rounded-lg hover:bg-red-50 text-[#9BADB7] hover:text-red-400 transition-colors"
                        title="Delete note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Content */}
                <p className="text-sm text-[#223149] whitespace-pre-wrap leading-relaxed">{note.content}</p>

                {/* Acknowledgement */}
                {note.is_visible_to_staff && (
                  <div className="pt-2 border-t border-[#ECE3DF]">
                    {note.acknowledged_at ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-green-600">
                        <Check className="w-3.5 h-3.5" />
                        Acknowledged {format(parseISO(note.acknowledged_at), "d MMM yyyy")}
                      </span>
                    ) : isOwnProfile && !isManager ? (
                      <button
                        onClick={() => acknowledge(note.id)}
                        className="flex items-center gap-1.5 text-xs font-medium text-[#5F7C84] hover:text-[#223149] transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Acknowledge
                      </button>
                    ) : (
                      <span className="text-xs text-[#9BADB7]">Awaiting acknowledgement</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add note modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-xl w-full md:max-w-lg pb-safe">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#ECE3DF]">
              <h2 className="text-lg font-bold text-[#223149]">Add Performance Note</h2>
              <button onClick={() => { setShowAdd(false); setSaveError(""); }}
                className="p-2 rounded-xl hover:bg-[#F8F6F4] transition-colors">
                <X className="w-5 h-5 text-[#5F7C84]" />
              </button>
            </div>
            <form onSubmit={addNote} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#223149] mb-1.5">Note</label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  required
                  rows={5}
                  placeholder="Write your performance observation, feedback or note here…"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors resize-none"
                />
              </div>

              {/* Visibility toggle */}
              <div className="flex items-start gap-3 p-4 bg-[#F8F6F4] rounded-xl">
                <button
                  type="button"
                  onClick={() => setNewVisible(!newVisible)}
                  style={{ touchAction: "manipulation" }}
                  className={`relative w-9 h-5 rounded-full flex-shrink-0 mt-0.5 transition-colors ${newVisible ? "bg-[#223149]" : "bg-[#ECE3DF]"}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${newVisible ? "right-0.5" : "left-0.5"}`} />
                </button>
                <div>
                  <p className="text-sm font-semibold text-[#223149]">
                    {newVisible ? "Visible to staff member" : "Confidential"}
                  </p>
                  <p className="text-xs text-[#9BADB7] mt-0.5">
                    {newVisible
                      ? "The staff member will see this note and can acknowledge it."
                      : "Only managers and admins can see this note."}
                  </p>
                </div>
              </div>

              {saveError && <p className="text-sm text-red-500">{saveError}</p>}

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={saving || !newContent.trim()}
                  className="flex-1 px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "Saving…" : "Save Note"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAdd(false); setSaveError(""); }}
                  className="px-4 py-2.5 border border-[#ECE3DF] text-[#5F7C84] rounded-xl text-sm font-semibold hover:bg-[#F8F6F4] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
