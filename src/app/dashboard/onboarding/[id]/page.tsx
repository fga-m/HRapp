"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Circle,
  ExternalLink,
  Plus,
  Star,
  Trash2,
  X,
  User,
  ClipboardList,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { useConfirm } from "@/components/ui/ConfirmDialog";

// ─── Types ────────────────────────────────────────────────────────────────────

type StaffInfo = {
  id: string;
  full_name: string;
  email: string;
  position?: string | null;
  department?: string | null;
};

type ChecklistItem = {
  id: string;
  staff_checklist_id: string;
  title: string;
  description: string | null;
  section: string | null;
  link_url: string | null;
  is_required: boolean;
  order_index: number;
};

type Completion = {
  id: string;
  staff_checklist_item_id: string;
  completed_by: string;
  completed_at: string;
  notes: string | null;
  completed_by_staff: { id: string; full_name: string; email: string } | null;
};

type Checklist = {
  id: string;
  staff_id: string;
  title: string;
  is_offboarding: boolean;
  due_date: string | null;
  created_at: string;
  staff: StaffInfo;
  assigned_by_staff: StaffInfo | null;
  items: ChecklistItem[];
  items_by_section: Record<string, ChecklistItem[]>;
  completions: Completion[];
  role: string;
  is_assigned_staff: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

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

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const complete = pct === 100 && max > 0;
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-[#9BADB7] mb-1.5">
        <span>
          {value} of {max} required{complete ? " — all done!" : ""}
        </span>
        <span className={complete ? "text-emerald-600 font-semibold" : ""}>{pct}%</span>
      </div>
      <div className="w-full bg-[#ECE3DF] rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${
            complete ? "bg-emerald-500" : "bg-[#223149]"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Add Item Modal ────────────────────────────────────────────────────────────

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

function AddItemModal({
  checklistId,
  onClose,
  onSuccess,
}: {
  checklistId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [section, setSection] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [isRequired, setIsRequired] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required."); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/checklists/assigned/${checklistId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          section: section.trim() || "General",
          link_url: linkUrl.trim() || null,
          is_required: isRequired,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Failed to add item");
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-xl w-full md:max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#223149]">Add Item</h2>
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
              placeholder="e.g. Complete ID verification"
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

          <div className="flex items-center justify-between px-1">
            <span className="text-sm font-semibold text-[#223149]">Required</span>
            <button
              type="button"
              onClick={() => setIsRequired((v) => !v)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                isRequired ? "bg-[#223149]" : "bg-[#ECE3DF]"
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  isRequired ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {error && <p className="text-sm text-rose-500">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50"
            >
              {saving ? "Adding..." : "Add Item"}
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ChecklistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const confirm = useConfirm();

  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [deletingChecklist, setDeletingChecklist] = useState(false);

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/checklists/assigned/${id}`);
    if (!res.ok) { setError("Checklist not found."); setLoading(false); return; }
    const d = await res.json();
    setChecklist(d);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleToggle = async (itemId: string) => {
    if (!checklist || togglingId) return;
    setTogglingId(itemId);
    try {
      const res = await fetch(`/api/checklists/assigned/${id}/items/${itemId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        // Optimistically update completion state
        const { completed } = await res.json();
        setChecklist((prev) => {
          if (!prev) return prev;
          if (completed) {
            return {
              ...prev,
              completions: [
                ...prev.completions,
                {
                  id: `tmp-${itemId}`,
                  staff_checklist_item_id: itemId,
                  completed_by: "",
                  completed_at: new Date().toISOString(),
                  notes: null,
                  completed_by_staff: null,
                },
              ],
            };
          } else {
            return {
              ...prev,
              completions: prev.completions.filter(
                (c) => c.staff_checklist_item_id !== itemId
              ),
            };
          }
        });
      }
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!(await confirm({ title: "Remove this item from the checklist?", danger: true }))) return;
    setDeletingItemId(itemId);
    await fetch(`/api/checklists/assigned/${id}/items/${itemId}`, { method: "DELETE" });
    setDeletingItemId(null);
    fetchData();
  };

  const handleDeleteChecklist = async () => {
    if (!(await confirm({ title: "Delete this checklist?", message: "This cannot be undone.", danger: true }))) return;
    setDeletingChecklist(true);
    await fetch(`/api/checklists/assigned/${id}`, { method: "DELETE" });
    router.push("/dashboard/onboarding");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#223149] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !checklist) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard/onboarding"
          className="inline-flex items-center gap-2 text-sm text-[#5F7C84] hover:text-[#223149] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Checklists
        </Link>
        <p className="text-[#9BADB7]">{error || "Checklist not found."}</p>
      </div>
    );
  }

  const isAdmin = checklist.role === "admin";

  // Build completion lookup: itemId → Completion
  const completionMap = new Map(
    checklist.completions.map((c) => [c.staff_checklist_item_id, c])
  );

  const allItems = checklist.items ?? [];
  const requiredItems = allItems.filter((i) => i.is_required);
  const completedRequired = requiredItems.filter((i) => completionMap.has(i.id));

  // Group by section, preserving insertion order
  const sectionMap = new Map<string, ChecklistItem[]>();
  for (const item of allItems) {
    const key = item.section || "General";
    if (!sectionMap.has(key)) sectionMap.set(key, []);
    sectionMap.get(key)!.push(item);
  }
  const sortedSections = Array.from(sectionMap.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  const allRequiredDone =
    requiredItems.length > 0 && completedRequired.length === requiredItems.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link
          href="/dashboard/onboarding"
          aria-label="Back to Checklists"
          className="p-2 rounded-xl hover:bg-[#ECE3DF] transition-colors mt-0.5 flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5 text-[#223149]" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-bold text-[#223149] truncate">
              {checklist.title}
            </h1>
            <TypeBadge isOffboarding={checklist.is_offboarding} />
          </div>
          {checklist.due_date && (
            <p className="text-sm text-[#9BADB7] mt-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Due {format(parseISO(checklist.due_date), "d MMMM yyyy")}
            </p>
          )}
        </div>
      </div>

      {/* Staff card + progress */}
      <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
        {/* Staff info */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-[#223149] flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-bold">
              {initials(checklist.staff?.full_name ?? "?")}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[#223149]">{checklist.staff?.full_name}</p>
            <p className="text-xs text-[#9BADB7]">{checklist.staff?.email}</p>
            {(checklist.staff?.position || checklist.staff?.department) && (
              <p className="text-xs text-[#9BADB7]">
                {[checklist.staff.position, checklist.staff.department]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
          {allRequiredDone && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Complete
            </div>
          )}
        </div>

        {/* Progress */}
        <ProgressBar value={completedRequired.length} max={requiredItems.length} />

        {/* Meta */}
        <div className="flex flex-wrap gap-4 text-xs text-[#9BADB7] pt-1 border-t border-[#ECE3DF]">
          <span className="flex items-center gap-1">
            <ClipboardList className="w-3.5 h-3.5" />
            {allItems.length} item{allItems.length !== 1 ? "s" : ""}
          </span>
          {checklist.assigned_by_staff && (
            <span className="flex items-center gap-1">
              <User className="w-3.5 h-3.5" />
              Assigned by {checklist.assigned_by_staff.full_name}
            </span>
          )}
          <span>
            Started {format(parseISO(checklist.created_at), "d MMM yyyy")}
          </span>
        </div>
      </div>

      {/* Non-admin note */}
      {!isAdmin && allItems.length > 0 && (
        <p className="text-xs text-[#9BADB7] -mb-2">
          Your HR admin marks items complete as they&apos;re done.
        </p>
      )}

      {/* Checklist items */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {allItems.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <ClipboardList className="w-12 h-12 text-[#ECE3DF] mx-auto" />
            <p className="font-semibold text-[#223149]">No items yet</p>
            {isAdmin && (
              <p className="text-sm text-[#9BADB7]">
                Add items to this checklist using the button below.
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[#ECE3DF]">
            {sortedSections.map(([sectionKey, items]) => (
              <div key={sectionKey}>
                {/* Section heading */}
                <div className="px-6 pt-4 pb-1">
                  <p className="text-xs font-semibold text-[#9BADB7] uppercase tracking-widest">
                    {sectionKey}
                  </p>
                </div>

                {items
                  .slice()
                  .sort((a, b) => a.order_index - b.order_index)
                  .map((item) => {
                    const completion = completionMap.get(item.id);
                    const isDone = !!completion;
                    const isToggling = togglingId === item.id;

                    return (
                      <div
                        key={item.id}
                        className={`flex items-start gap-4 px-6 py-4 transition-colors group/item ${
                          isDone
                            ? "bg-[#F8F6F4]/60"
                            : isAdmin
                              ? "hover:bg-[#F8F6F4]/40"
                              : ""
                        }`}
                      >
                        {/* Checkbox */}
                        <button
                          onClick={() => isAdmin && handleToggle(item.id)}
                          disabled={!isAdmin || isToggling}
                          className={`mt-0.5 flex-shrink-0 transition-all ${
                            isAdmin
                              ? "cursor-pointer hover:scale-110"
                              : "cursor-default"
                          } ${isToggling ? "opacity-50" : ""}`}
                          title={
                            isAdmin
                              ? isDone
                                ? "Mark as incomplete"
                                : "Mark as complete"
                              : undefined
                          }
                        >
                          {isDone ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          ) : (
                            <Circle className="w-5 h-5 text-[#ECE3DF]" />
                          )}
                        </button>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p
                              className={`text-sm font-semibold transition-colors ${
                                isDone
                                  ? "text-[#9BADB7] line-through"
                                  : "text-[#223149]"
                              }`}
                            >
                              {item.title}
                            </p>
                            {item.is_required && !isDone && (
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
                                View doc
                              </a>
                            )}
                          </div>

                          {item.description && (
                            <p className="text-xs text-[#9BADB7] mt-0.5">
                              {item.description}
                            </p>
                          )}

                          {/* Admin delete button */}
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              disabled={deletingItemId === item.id}
                              className="opacity-100 md:opacity-0 md:group-hover/item:opacity-100 transition-opacity mt-1 p-1 rounded-lg hover:bg-rose-50 disabled:opacity-50"
                              title="Remove item"
                              aria-label="Remove item"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                            </button>
                          )}

                        {/* Completion meta */}
                          {isDone && completion && (
                            <p className="text-xs text-emerald-600 mt-1">
                              {completion.completed_by_staff?.full_name
                                ? `Completed by ${completion.completed_by_staff.full_name}`
                                : "Completed"}{" "}
                              · {format(parseISO(completion.completed_at), "d MMM yyyy")}
                              {completion.notes && (
                                <span className="text-[#9BADB7]"> — {completion.notes}</span>
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            ))}
          </div>
        )}

        {/* Add item footer — admin only */}
        {isAdmin && (
          <div className="px-6 py-3 border-t border-[#ECE3DF]">
            <button
              onClick={() => setShowAddItem(true)}
              className="flex items-center gap-2 text-sm font-semibold text-[#223149] hover:text-[#5F7C84] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Item
            </button>
          </div>
        )}
      </div>

      {/* Danger zone — admin only */}
      {isAdmin && (
        <div className="border border-rose-100 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-rose-600 mb-2">Delete this checklist</h3>
          <p className="text-xs text-[#9BADB7] mb-3">
            Deleting this checklist removes all items and completion records.
          </p>
          <button
            onClick={handleDeleteChecklist}
            disabled={deletingChecklist}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-rose-200 text-sm font-semibold text-rose-500 hover:bg-rose-50 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {deletingChecklist ? "Deleting..." : "Delete Checklist"}
          </button>
        </div>
      )}

      {/* Modals */}
      {showAddItem && (
        <AddItemModal
          checklistId={id}
          onClose={() => setShowAddItem(false)}
          onSuccess={() => {
            setShowAddItem(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}
