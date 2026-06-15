"use client";

import { useState, useEffect, useRef } from "react";
import { Pencil, Check, X } from "lucide-react";
import { useAppContext } from "@/context/AppContext";

interface Props {
  pageKey: string;
  defaultDescription: string;
}

export default function PageSubtitle({ pageKey, defaultDescription }: Props) {
  const { isAdmin } = useAppContext();
  const [description, setDescription] = useState(defaultDescription);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch(`/api/settings/page-description?key=${encodeURIComponent(pageKey)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.description) setDescription(d.description); })
      .catch(() => {});
  }, [pageKey]);

  function startEdit() {
    setDraft(description);
    setEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 10);
  }

  async function save() {
    if (!draft.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/settings/page-description", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: pageKey, description: draft.trim() }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setDescription(draft.trim());
      setEditing(false);
    } catch {
      setError("Couldn't save — please try again.");
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setEditing(false);
    setDraft("");
    setError("");
  }

  if (editing) {
    return (
      <div className="mt-1.5">
        <div className="flex items-start gap-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); }
              if (e.key === "Escape") cancel();
            }}
            rows={2}
            className="flex-1 text-sm text-[#5F7C84] bg-white border border-[#223149]/30 rounded-lg px-3 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-[#223149]/20"
          />
          <div className="flex gap-1 mt-0.5">
            <button
              onClick={save}
              disabled={saving}
              className="p-1.5 rounded-lg bg-[#223149] text-white hover:bg-[#223149]/90 disabled:opacity-50 transition-colors"
              title="Save"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={cancel}
              className="p-1.5 rounded-lg border border-[#ECE3DF] text-[#5F7C84] hover:bg-[#F8F6F4] transition-colors"
              title="Cancel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 mt-1 group">
      <p className="text-[#5F7C84] text-sm leading-relaxed">{description}</p>
      {isAdmin && (
        <button
          onClick={startEdit}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-[#ECE3DF] text-[#9BADB7] hover:text-[#5F7C84] flex-shrink-0"
          title="Edit page description"
        >
          <Pencil className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
