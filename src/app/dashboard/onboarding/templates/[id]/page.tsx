"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Plus, X, ExternalLink, GripVertical, Pencil,
  Trash2, Star, ToggleLeft, ToggleRight, Users
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Template = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  ministry: string | null;
  is_offboarding: boolean;
  created_at: string;
};

type TemplateItem = {
  id: string;
  template_id: string;
  title: string;
  description: string | null;
  section: string | null;
  link_url: string | null;
  is_required: boolean;
  order_index: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function TypeBadge({ isOffboarding }: { isOffboarding: boolean }) {
  return isOffboarding ? (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">
      Offboarding
    </span>
  ) : (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#223149]/10 text-[#223149]">
      Onboarding
    </span>
  );
}

function Toggle({
  value,
  onChange,
  labelOff,
  labelOn,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  labelOff: string;
  labelOn: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex items-center gap-2 text-sm font-medium text-[#223149] select-none"
    >
      {value ? (
        <ToggleRight className="w-6 h-6 text-rose-500" />
      ) : (
        <ToggleLeft className="w-6 h-6 text-[#9BADB7]" />
      )}
      <span>{value ? labelOn : labelOff}</span>
    </button>
  );
}

// ─── Section Heading ──────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="text-xs font-semibold text-[#9BADB7] uppercase tracking-widest px-1 pt-2 pb-1">
      {label || "General"}
    </p>
  );
}

// ─── Add / Edit Item Modal ────────────────────────────────────────────────────

const SECTION_SUGGESTIONS = [
  "Admin & HR",
  "IT Setup",
  "Orientation",
  "Training",
  "Finance",
  "Health & Safety",
  "Ministry",
  "General",
];

type ItemFormData = {
  title: string;
  description: string;
  section: string;
  link_url: string;
  is_required: boolean;
};

function ItemModal({
  initial,
  onClose,
  onSave,
  saving,
}: {
  initial?: ItemFormData;
  onClose: () => void;
  onSave: (data: ItemFormData) => Promise<void>;
  saving: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [section, setSection] = useState(initial?.section ?? "");
  const [linkUrl, setLinkUrl] = useState(initial?.link_url ?? "");
  const [isRequired, setIsRequired] = useState(initial?.is_required ?? false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setError("");
    await onSave({ title: title.trim(), description: description.trim(), section: section.trim(), link_url: linkUrl.trim(), is_required: isRequired });
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-xl w-full md:max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#223149]">
            {initial ? "Edit Item" : "Add Item"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F8F6F4] transition-colors">
            <X className="w-5 h-5 text-[#9BADB7]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[#223149] mb-1.5">
              Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
              placeholder="e.g. Complete tax file declaration"
              className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#223149] mb-1.5">
              Description{" "}
              <span className="text-xs font-normal text-[#9BADB7]">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Additional context or instructions..."
              className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors resize-none"
            />
          </div>

          {/* Section with suggestions */}
          <div className="relative">
            <label className="block text-sm font-semibold text-[#223149] mb-1.5">
              Section{" "}
              <span className="text-xs font-normal text-[#9BADB7]">(optional)</span>
            </label>
            <input
              type="text"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="e.g. IT Setup"
              className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
            />
            {showSuggestions && (
              <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-[#ECE3DF] rounded-xl shadow-lg overflow-hidden">
                {SECTION_SUGGESTIONS.filter((s) =>
                  s.toLowerCase().includes(section.toLowerCase())
                ).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onMouseDown={() => { setSection(s); setShowSuggestions(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-[#223149] hover:bg-[#F8F6F4] transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#223149] mb-1.5">
              Link URL{" "}
              <span className="text-xs font-normal text-[#9BADB7]">(optional)</span>
            </label>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
            />
          </div>

          <div className="flex items-center justify-between px-1 py-1">
            <span className="text-sm font-semibold text-[#223149]">Required item</span>
            <Toggle
              value={isRequired}
              onChange={setIsRequired}
              labelOff="Optional"
              labelOn="Required"
            />
          </div>

          {error && <p className="text-sm text-rose-500">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : initial ? "Save Changes" : "Add Item"}
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

// ─── Edit Template Modal ──────────────────────────────────────────────────────

function EditTemplateModal({
  template,
  onClose,
  onSave,
}: {
  template: Template;
  onClose: () => void;
  onSave: (data: Partial<Template>) => Promise<void>;
}) {
  const [title, setTitle] = useState(template.title);
  const [description, setDescription] = useState(template.description ?? "");
  const [isOffboarding, setIsOffboarding] = useState(template.is_offboarding);
  const [category, setCategory] = useState<"generic" | "ministry">(
    template.category === "ministry" ? "ministry" : "generic"
  );
  const [ministry, setMinistry] = useState(template.ministry ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required."); return; }
    setSaving(true);
    setError("");
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || null,
        is_offboarding: isOffboarding,
        category,
        ministry: category === "ministry" ? ministry.trim() || null : null,
      });
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-xl w-full md:max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#223149]">Edit Template</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F8F6F4] transition-colors">
            <X className="w-5 h-5 text-[#9BADB7]" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[#223149] mb-1.5">Title <span className="text-rose-500">*</span></label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
              className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#223149] mb-1.5">Description <span className="text-xs font-normal text-[#9BADB7]">(optional)</span></label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#223149] mb-2">Type</label>
            <Toggle value={isOffboarding} onChange={setIsOffboarding} labelOff="Onboarding" labelOn="Offboarding" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#223149] mb-1.5">Category</label>
            <div className="flex gap-3">
              {(["generic", "ministry"] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`flex-1 px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
                    category === cat
                      ? "bg-[#223149] text-white border-[#223149]"
                      : "border-[#ECE3DF] text-[#5F7C84] hover:bg-[#F8F6F4]"
                  }`}
                >
                  {cat === "generic" ? "Generic" : "Ministry-Specific"}
                </button>
              ))}
            </div>
          </div>
          {category === "ministry" && (
            <div>
              <label className="block text-sm font-semibold text-[#223149] mb-1.5">Ministry Name</label>
              <input
                type="text"
                value={ministry}
                onChange={(e) => setMinistry(e.target.value)}
                placeholder="e.g. Youth Ministry"
                className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
              />
            </div>
          )}
          {error && <p className="text-sm text-rose-500">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50">
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2.5 border border-[#ECE3DF] text-[#5F7C84] rounded-xl text-sm font-semibold hover:bg-[#F8F6F4] transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [template, setTemplate] = useState<Template | null>(null);
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddItem, setShowAddItem] = useState(false);
  const [editItem, setEditItem] = useState<TemplateItem | null>(null);
  const [editTemplate, setEditTemplate] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const fetchData = async () => {
    const res = await fetch(`/api/checklists/templates/${id}`);
    if (!res.ok) { setError("Template not found."); setLoading(false); return; }
    const d = await res.json();
    const { items: fetchedItems, ...templateData } = d;
    setTemplate(templateData);
    setItems(fetchedItems ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [id]);

  // Group items by section
  const sections = items.reduce<Record<string, TemplateItem[]>>((acc, item) => {
    const key = item.section || "";
    acc[key] = acc[key] ?? [];
    acc[key].push(item);
    return acc;
  }, {});

  const sortedSections = Object.keys(sections).sort((a, b) => {
    if (!a) return 1;
    if (!b) return -1;
    return a.localeCompare(b);
  });

  const handleAddItem = async (data: ItemFormData) => {
    setSavingItem(true);
    try {
      const res = await fetch(`/api/checklists/templates/${id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to add item");
      setShowAddItem(false);
      fetchData();
    } finally {
      setSavingItem(false);
    }
  };

  const handleEditItem = async (data: ItemFormData) => {
    if (!editItem) return;
    setSavingItem(true);
    try {
      const res = await fetch(`/api/checklists/templates/${id}/items/${editItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update item");
      setEditItem(null);
      fetchData();
    } finally {
      setSavingItem(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm("Delete this item?")) return;
    setDeletingId(itemId);
    await fetch(`/api/checklists/templates/${id}/items/${itemId}`, { method: "DELETE" });
    setDeletingId(null);
    fetchData();
  };

  const handleSaveTemplate = async (data: Partial<Template>) => {
    const res = await fetch(`/api/checklists/templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update template");
    setEditTemplate(false);
    fetchData();
  };

  const handleDeleteTemplate = async () => {
    if (!confirm("Delete this template? This cannot be undone.")) return;
    await fetch(`/api/checklists/templates/${id}`, { method: "DELETE" });
    router.push("/dashboard/onboarding");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#223149] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/onboarding" className="inline-flex items-center gap-2 text-sm text-[#5F7C84] hover:text-[#223149] transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Onboarding
        </Link>
        <p className="text-[#9BADB7]">{error || "Template not found."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link
            href="/dashboard/onboarding"
            className="p-2 rounded-xl hover:bg-[#ECE3DF] transition-colors mt-0.5 flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-[#223149]" />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-bold text-[#223149]">{template.title}</h1>
              <TypeBadge isOffboarding={template.is_offboarding} />
            </div>
            {template.description && (
              <p className="text-[#5F7C84] mt-1 text-sm">{template.description}</p>
            )}
            {template.ministry && (
              <p className="text-xs text-[#9BADB7] mt-0.5">{template.ministry}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setEditTemplate(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#ECE3DF] text-sm font-medium text-[#5F7C84] hover:bg-[#F8F6F4] transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Edit</span>
          </button>
          <Link
            href="/dashboard/onboarding"
            className="flex items-center gap-1.5 px-3 py-2 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors"
          >
            <Users className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Assign to Staff</span>
          </Link>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 text-sm text-[#9BADB7]">
        <span>{items.length} item{items.length !== 1 ? "s" : ""}</span>
        <span>·</span>
        <span>{items.filter((i) => i.is_required).length} required</span>
        {Object.keys(sections).length > 0 && (
          <>
            <span>·</span>
            <span>{sortedSections.length} section{sortedSections.length !== 1 ? "s" : ""}</span>
          </>
        )}
      </div>

      {/* Items list */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {items.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Plus className="w-12 h-12 text-[#ECE3DF] mx-auto" />
            <p className="font-semibold text-[#223149]">No items yet</p>
            <p className="text-sm text-[#9BADB7]">Add checklist items to this template.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#ECE3DF]">
            {sortedSections.map((sectionKey) => (
              <div key={sectionKey}>
                {sectionKey && (
                  <div className="px-6 pt-4 pb-1">
                    <SectionHeader label={sectionKey} />
                  </div>
                )}
                {sections[sectionKey]
                  .sort((a, b) => a.order_index - b.order_index)
                  .map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 px-6 py-4 hover:bg-[#F8F6F4] transition-colors group"
                    >
                      {/* Drag handle (visual only) */}
                      <GripVertical className="w-4 h-4 text-[#ECE3DF] mt-0.5 flex-shrink-0 cursor-grab" />

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-[#223149]">{item.title}</p>
                          {item.is_required && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-600">
                              <Star className="w-2.5 h-2.5" />
                              Required
                            </span>
                          )}
                          {item.link_url && (
                            <a
                              href={item.link_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium bg-[#F8F6F4] text-[#9BADB7] hover:text-[#5F7C84] transition-colors"
                            >
                              <ExternalLink className="w-2.5 h-2.5" />
                              Link
                            </a>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-xs text-[#9BADB7] mt-0.5 line-clamp-2">
                            {item.description}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button
                          onClick={() => setEditItem(item)}
                          className="p-1.5 rounded-lg hover:bg-[#ECE3DF] transition-colors"
                          title="Edit item"
                        >
                          <Pencil className="w-3.5 h-3.5 text-[#5F7C84]" />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          disabled={deletingId === item.id}
                          className="p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                          title="Delete item"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            ))}
          </div>
        )}

        {/* Add item button */}
        <div className="px-6 py-3 border-t border-[#ECE3DF]">
          <button
            onClick={() => setShowAddItem(true)}
            className="flex items-center gap-2 text-sm font-semibold text-[#223149] hover:text-[#5F7C84] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Item
          </button>
        </div>
      </div>

      {/* Danger zone */}
      <div className="border border-rose-100 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-rose-600 mb-2">Danger Zone</h3>
        <p className="text-xs text-[#9BADB7] mb-3">Deleting this template cannot be undone. Assigned checklists will not be affected.</p>
        <button
          onClick={handleDeleteTemplate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-rose-200 text-sm font-semibold text-rose-500 hover:bg-rose-50 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Delete Template
        </button>
      </div>

      {/* Modals */}
      {showAddItem && (
        <ItemModal
          onClose={() => setShowAddItem(false)}
          onSave={handleAddItem}
          saving={savingItem}
        />
      )}

      {editItem && (
        <ItemModal
          initial={{
            title: editItem.title,
            description: editItem.description ?? "",
            section: editItem.section ?? "",
            link_url: editItem.link_url ?? "",
            is_required: editItem.is_required,
          }}
          onClose={() => setEditItem(null)}
          onSave={handleEditItem}
          saving={savingItem}
        />
      )}

      {editTemplate && (
        <EditTemplateModal
          template={template}
          onClose={() => setEditTemplate(false)}
          onSave={handleSaveTemplate}
        />
      )}
    </div>
  );
}
