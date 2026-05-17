"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Plus, Pencil, Trash2, X, BookOpen } from "lucide-react";

type HubLink = {
  id: string;
  label: string;
  url: string;
  description: string | null;
  order_index: number;
};

// ── Link form modal ───────────────────────────────────────────────────────────

function LinkModal({
  initial,
  onClose,
  onSave,
}: {
  initial?: HubLink;
  onClose: () => void;
  onSave: (data: { label: string; url: string; description: string }) => Promise<void>;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) { setError("Label is required."); return; }
    if (!url.trim()) { setError("URL is required."); return; }

    // Prepend https:// if no protocol given
    const finalUrl = url.trim().match(/^https?:\/\//) ? url.trim() : `https://${url.trim()}`;

    setSaving(true);
    setError("");
    try {
      await onSave({ label: label.trim(), url: finalUrl, description: description.trim() });
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl md:rounded-2xl shadow-xl w-full md:max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#223149]">
            {initial ? "Edit Link" : "Add Link"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F8F6F4] transition-colors">
            <X className="w-5 h-5 text-[#9BADB7]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[#223149] mb-1.5">
              Label <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              autoFocus
              placeholder="e.g. Leave Request Form"
              className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#223149] mb-1.5">
              URL <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#223149] mb-1.5">
              Description{" "}
              <span className="text-xs font-normal text-[#9BADB7]">(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what this link is for"
              className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
            />
          </div>

          {error && <p className="text-sm text-rose-500">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : initial ? "Save Changes" : "Add Link"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-[#ECE3DF] text-[#5F7C84] rounded-xl text-sm font-semibold hover:bg-[#F8F6F4] transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function StaffHubPage() {
  const [links, setLinks] = useState<HubLink[]>([]);
  const [role, setRole] = useState("staff");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editLink, setEditLink] = useState<HubLink | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchLinks = async () => {
    const res = await fetch("/api/hub/links");
    const data = await res.json();
    setLinks(data.links ?? []);
    setRole(data.role ?? "staff");
    setLoading(false);
  };

  useEffect(() => { fetchLinks(); }, []);

  const isAdmin = role === "admin";

  const handleAdd = async (body: { label: string; url: string; description: string }) => {
    const res = await fetch("/api/hub/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json();
      throw new Error(d.error ?? "Failed to add link");
    }
    setShowAdd(false);
    fetchLinks();
  };

  const handleEdit = async (body: { label: string; url: string; description: string }) => {
    if (!editLink) return;
    const res = await fetch(`/api/hub/links/${editLink.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json();
      throw new Error(d.error ?? "Failed to update link");
    }
    setEditLink(null);
    fetchLinks();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this link?")) return;
    setDeletingId(id);
    await fetch(`/api/hub/links/${id}`, { method: "DELETE" });
    setDeletingId(null);
    fetchLinks();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#223149] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#223149]">Staff Hub</h1>
          <p className="text-[#5F7C84] mt-1 text-sm">Quick links and resources for the team</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Link</span>
          </button>
        )}
      </div>

      {/* Links grid */}
      {links.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center space-y-3">
          <BookOpen className="w-12 h-12 text-[#ECE3DF] mx-auto" />
          <p className="font-semibold text-[#223149]">No links yet</p>
          <p className="text-sm text-[#9BADB7]">
            {isAdmin
              ? "Add links to forms, documents, and resources for your team."
              : "Your admin hasn't added any links yet."}
          </p>
          {isAdmin && (
            <button
              onClick={() => setShowAdd(true)}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Link
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((link) => (
            <div key={link.id} className="relative group">
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-4 bg-white rounded-2xl shadow-sm p-5 hover:shadow-md transition-shadow h-full"
              >
                <div className="w-10 h-10 rounded-xl bg-[#ECE3DF] flex items-center justify-center flex-shrink-0 group-hover:bg-[#223149] transition-colors">
                  <ExternalLink className="w-4 h-4 text-[#223149] group-hover:text-white transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#223149] leading-tight">{link.label}</p>
                  {link.description && (
                    <p className="text-xs text-[#9BADB7] mt-1 line-clamp-2">{link.description}</p>
                  )}
                </div>
              </a>

              {/* Admin actions — appear on hover */}
              {isAdmin && (
                <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.preventDefault(); setEditLink(link); }}
                    className="p-1.5 bg-white rounded-lg shadow-sm border border-[#ECE3DF] hover:bg-[#F8F6F4] transition-colors"
                    title="Edit link"
                  >
                    <Pencil className="w-3.5 h-3.5 text-[#5F7C84]" />
                  </button>
                  <button
                    onClick={(e) => { e.preventDefault(); handleDelete(link.id); }}
                    disabled={deletingId === link.id}
                    className="p-1.5 bg-white rounded-lg shadow-sm border border-[#ECE3DF] hover:bg-rose-50 transition-colors disabled:opacity-50"
                    title="Remove link"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showAdd && (
        <LinkModal onClose={() => setShowAdd(false)} onSave={handleAdd} />
      )}
      {editLink && (
        <LinkModal
          initial={editLink}
          onClose={() => setEditLink(null)}
          onSave={handleEdit}
        />
      )}
    </div>
  );
}
