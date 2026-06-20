"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, X, Eye, Code, AlertTriangle } from "lucide-react";
import { MarkdownContent } from "@/components/MarkdownContent";
import { useConfirm } from "@/components/ui/ConfirmDialog";

const MEETING_TYPES = [
  { value: "1on1",               label: "1-on-1" },
  { value: "team",               label: "Team Meeting" },
  { value: "performance_review", label: "Performance Review" },
  { value: "projects_goals",     label: "Projects & Goals" },
];

const DEFAULT_TEMPLATES: Record<string, string> = {
  "1on1": `## Check-in

How are you going personally and professionally?

## Key Discussion Points

-
-

## Action Items

- [ ]

## Prayer Points

## Notes`,

  "team": `## Agenda

## Discussion

## Decisions Made

## Action Items

- [ ]

## Next Steps`,

  "performance_review": `## Goals Review

## Achievements

## Areas for Growth

## Goals for Next Period

## Notes`,

  "projects_goals": `## Project Status

## Key Milestones

## Blockers

## Action Items

- [ ]

## Next Review Date`,
};

type Template = {
  id: string;
  title: string;
  meeting_type: string;
  content: string;
  created_at: string;
  created_by_staff?: { full_name: string };
};

type EditorState = {
  id?: string;
  title: string;
  meeting_type: string;
  content: string;
};

export default function MeetingTemplatesPage() {
  const confirm = useConfirm();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("1on1");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");

  const fetchTemplates = useCallback(() => {
    setLoading(true);
    setLoadError("");
    fetch("/api/meetings/templates")
      .then((r) => { if (!r.ok) throw new Error("Failed to load"); return r.json(); })
      .then((d) => {
        setTemplates(d.templates || []);
        setLoading(false);
      })
      .catch(() => { setLoadError("Could not load templates. Please try again."); setLoading(false); });
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const openNew = () => {
    setEditor({
      title: "",
      meeting_type: activeTab,
      content: DEFAULT_TEMPLATES[activeTab] ?? "",
    });
    setPreview(false);
    setError("");
  };

  const openEdit = (t: Template) => {
    setEditor({ id: t.id, title: t.title, meeting_type: t.meeting_type, content: t.content });
    setPreview(false);
    setError("");
  };

  const handleSave = async () => {
    if (!editor) return;
    if (!editor.title.trim()) { setError("Title is required"); return; }
    setSaving(true);
    setError("");
    try {
      const isEdit = !!editor.id;
      const res = await fetch(
        isEdit ? `/api/meetings/templates/${editor.id}` : "/api/meetings/templates",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: editor.title,
            meeting_type: editor.meeting_type,
            content: editor.content,
          }),
        }
      );
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      setEditor(null);
      fetchTemplates();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm({ title: "Delete this template?", danger: true }))) return;
    setDeleting(id);
    setError("");
    try {
      const res = await fetch(`/api/meetings/templates/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to delete template.");
      }
      fetchTemplates();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeleting(null);
    }
  };

  const typeTemplates = templates.filter((t) => t.meeting_type === activeTab);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-[#223149]">Meeting Templates</h1>
          <p className="text-[#50676E] mt-1 text-sm">
            Define reusable note structures for each meeting type
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Template
        </button>
      </div>

      {/* Type tabs */}
      <div className="flex gap-1 bg-[#F8F6F4] p-1 rounded-xl w-full overflow-x-auto no-scrollbar">
        {MEETING_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setActiveTab(t.value)}
            className={`flex-1 min-w-max px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
              activeTab === t.value
                ? "bg-white text-[#223149] shadow-sm"
                : "text-[#50676E] hover:text-[#223149]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Template list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-[#223149] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : loadError ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{loadError}</p>
          </div>
          <button
            onClick={fetchTemplates}
            className="px-4 py-2 border border-[#ECE3DF] text-[#50676E] rounded-xl text-sm font-semibold hover:bg-[#F8F6F4] transition-colors"
          >
            Try again
          </button>
        </div>
      ) : typeTemplates.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm p-12 text-center">
          <p className="text-[#50676E] font-medium">No templates yet for this meeting type</p>
          <button onClick={openNew} className="text-sm text-[#223149] underline mt-2 inline-block">
            Create the first one
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {typeTemplates.map((t) => (
            <div key={t.id} className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm p-5 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#223149]">{t.title}</p>
                <p className="text-xs text-[#50676E] mt-0.5">
                  {t.content
                    ? t.content.split("\n").find((l) => l.trim())?.replace(/^#+\s*/, "") ?? ""
                    : "No content"}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => openEdit(t)}
                  className="p-2 rounded-lg hover:bg-[#F8F6F4] transition-colors"
                  title="Edit"
                >
                  <Pencil className="w-4 h-4 text-[#50676E]" />
                </button>
                <button
                  onClick={() => handleDelete(t.id)}
                  disabled={deleting === t.id}
                  className="p-2 rounded-lg hover:bg-rose-50 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4 text-rose-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor modal */}
      {editor && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/30 p-0 md:p-4"
          onClick={() => setEditor(null)}
        >
          <div
            className="bg-white rounded-t-2xl md:rounded-2xl shadow-xl w-full md:max-w-4xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#ECE3DF] flex-shrink-0">
              <h2 className="text-lg font-bold text-[#223149]">
                {editor.id ? "Edit Template" : "New Template"}
              </h2>
              <div className="flex items-center gap-2">
                {/* Preview toggle */}
                <button
                  onClick={() => setPreview(!preview)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                    preview
                      ? "bg-[#223149] text-white border-[#223149]"
                      : "border-[#ECE3DF] text-[#50676E] hover:bg-[#F8F6F4]"
                  }`}
                >
                  {preview ? <Code className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {preview ? "Edit" : "Preview"}
                </button>
                <button onClick={() => setEditor(null)} className="p-1.5 rounded-lg hover:bg-[#F8F6F4]">
                  <X className="w-5 h-5 text-[#50676E]" />
                </button>
              </div>
            </div>

            {/* Form fields */}
            <div className="px-6 pt-4 pb-2 flex-shrink-0 space-y-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label htmlFor="template-name" className="block text-xs font-semibold text-[#223149] mb-1">Template Name</label>
                  <input id="template-name"
                    type="text"
                    value={editor.title}
                    onChange={(e) => setEditor({ ...editor, title: e.target.value })}
                    placeholder="e.g. Standard 1-on-1, Pastoral Check-in..."
                    className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#6E8189] text-sm focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
                  />
                </div>
                <div>
                  <label htmlFor="meeting-type" className="block text-xs font-semibold text-[#223149] mb-1">Meeting Type</label>
                  <select id="meeting-type"
                    value={editor.meeting_type}
                    onChange={(e) => setEditor({ ...editor, meeting_type: e.target.value })}
                    className="px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] text-sm focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors bg-white"
                  >
                    {MEETING_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Editor / Preview */}
            <div className="flex-1 min-h-0 overflow-hidden px-6 pb-4">
              {preview ? (
                <div className="h-full overflow-y-auto border border-[#ECE3DF] rounded-xl p-5 bg-[#FAFAF9]">
                  {editor.content.trim() ? (
                    <MarkdownContent content={editor.content} />
                  ) : (
                    <p className="text-[#50676E] text-sm italic">Nothing to preview yet.</p>
                  )}
                </div>
              ) : (
                <div className="h-full flex flex-col gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-[#50676E]">Markdown:</span>
                    {[
                      ["## Heading", "## "],
                      ["**Bold**", "**bold**"],
                      ["- List", "- "],
                      ["- [ ] Task", "- [ ] "],
                    ].map(([label, insert]) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setEditor((prev) => prev ? { ...prev, content: prev.content + (prev.content.endsWith("\n") ? "" : "\n") + insert } : prev)}
                        className="px-2 py-0.5 text-xs rounded border border-[#ECE3DF] text-[#50676E] hover:bg-[#F8F6F4] font-mono transition-colors"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={editor.content}
                    onChange={(e) => setEditor({ ...editor, content: e.target.value })}
                    placeholder={`Use ## for section headings, - for bullets, - [ ] for action items, **bold** for emphasis...`}
                    className="flex-1 w-full px-4 py-3 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#6E8189] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors resize-none leading-relaxed"
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[#ECE3DF] flex-shrink-0 flex items-center justify-between gap-3">
              {error && <p className="text-sm text-rose-500 flex-1">{error}</p>}
              <div className="flex gap-3 ml-auto">
                <button
                  onClick={() => setEditor(null)}
                  className="px-4 py-2.5 border border-[#ECE3DF] text-[#50676E] rounded-xl text-sm font-semibold hover:bg-[#F8F6F4] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Template"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
