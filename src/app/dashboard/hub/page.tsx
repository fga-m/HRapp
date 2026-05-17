"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  BookOpen,
  ExternalLink,
  FolderPlus,
  GripHorizontal,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type HubGroup = { id: string; label: string; order_index: number };
type HubLink  = { id: string; label: string; url: string; description: string | null; group_id: string | null; order_index: number };

// ── Link modal ────────────────────────────────────────────────────────────────

function LinkModal({
  initial,
  groups,
  defaultGroupId,
  onClose,
  onSave,
}: {
  initial?: HubLink;
  groups: HubGroup[];
  defaultGroupId?: string | null;
  onClose: () => void;
  onSave: (data: { label: string; url: string; description: string; group_id: string | null }) => Promise<void>;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [groupId, setGroupId] = useState<string | null>(initial?.group_id ?? defaultGroupId ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) { setError("Label is required."); return; }
    if (!url.trim()) { setError("URL is required."); return; }
    const finalUrl = url.trim().match(/^https?:\/\//) ? url.trim() : `https://${url.trim()}`;
    setSaving(true);
    setError("");
    try {
      await onSave({ label: label.trim(), url: finalUrl, description: description.trim(), group_id: groupId });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-xl w-full md:max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#223149]">{initial ? "Edit Link" : "Add Link"}</h2>
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
              Description <span className="text-xs font-normal text-[#9BADB7]">(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what this link is for"
              className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
            />
          </div>
          {groups.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-[#223149] mb-1.5">
                Group <span className="text-xs font-normal text-[#9BADB7]">(optional)</span>
              </label>
              <select
                value={groupId ?? ""}
                onChange={(e) => setGroupId(e.target.value || null)}
                className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] bg-white focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
              >
                <option value="">No group</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.label}</option>
                ))}
              </select>
            </div>
          )}
          {error && <p className="text-sm text-rose-500">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50">
              {saving ? "Saving..." : initial ? "Save Changes" : "Add Link"}
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

// ── Group modal ───────────────────────────────────────────────────────────────

function GroupModal({
  initial,
  onClose,
  onSave,
}: {
  initial?: HubGroup;
  onClose: () => void;
  onSave: (label: string) => Promise<void>;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) { setError("Name is required."); return; }
    setSaving(true);
    setError("");
    try {
      await onSave(label.trim());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-xl w-full md:max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#223149]">{initial ? "Rename Group" : "New Group"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F8F6F4] transition-colors">
            <X className="w-5 h-5 text-[#9BADB7]" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            autoFocus
            placeholder="e.g. Ministry Resources"
            className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
          />
          {error && <p className="text-sm text-rose-500">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50">
              {saving ? "Saving..." : initial ? "Save" : "Create Group"}
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

// ── Sortable link card ────────────────────────────────────────────────────────

function SortableLinkCard({
  link,
  isAdmin,
  onEdit,
  onDelete,
  deleting,
}: {
  link: HubLink;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: link.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="relative group/card w-52">
      {/* Admin drag handle */}
      {isAdmin && (
        <button
          ref={setActivatorNodeRef}
          {...listeners}
          className="absolute -top-2 left-1/2 -translate-x-1/2 p-1 bg-white rounded-lg shadow border border-[#ECE3DF] cursor-grab active:cursor-grabbing opacity-0 group-hover/card:opacity-100 transition-opacity z-10"
          title="Drag to reorder"
          onClick={(e) => e.preventDefault()}
        >
          <GripHorizontal className="w-3 h-3 text-[#9BADB7]" />
        </button>
      )}

      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-start gap-2.5 px-4 py-3 bg-white rounded-xl shadow-sm border border-[#ECE3DF] hover:border-[#223149]/30 hover:shadow-md transition-all h-full"
      >
        <ExternalLink className="w-3.5 h-3.5 text-[#9BADB7] flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#223149]">{link.label}</p>
          {link.description && (
            <p className="text-xs text-[#9BADB7] leading-relaxed">{link.description}</p>
          )}
        </div>
      </a>

      {/* Admin edit/delete */}
      {isAdmin && (
        <div className="absolute -bottom-2 -right-2 flex items-center gap-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity z-10">
          <button
            onClick={(e) => { e.preventDefault(); onEdit(); }}
            className="p-1 bg-white rounded-lg shadow border border-[#ECE3DF] hover:bg-[#F8F6F4] transition-colors"
          >
            <Pencil className="w-3 h-3 text-[#5F7C84]" />
          </button>
          <button
            onClick={(e) => { e.preventDefault(); onDelete(); }}
            disabled={deleting}
            className="p-1 bg-white rounded-lg shadow border border-[#ECE3DF] hover:bg-rose-50 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-3 h-3 text-rose-400" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Sortable group row ────────────────────────────────────────────────────────

function SortableGroupSection({
  group,
  groupLinks,
  isAdmin,
  sensors,
  deletingGroupId,
  deletingLinkId,
  onAddLink,
  onEditGroup,
  onDeleteGroup,
  onEditLink,
  onDeleteLink,
  onLinksReorder,
}: {
  group: HubGroup;
  groupLinks: HubLink[];
  isAdmin: boolean;
  sensors: ReturnType<typeof useSensors>;
  deletingGroupId: string | null;
  deletingLinkId: string | null;
  onAddLink: () => void;
  onEditGroup: () => void;
  onDeleteGroup: () => void;
  onEditLink: (link: HubLink) => void;
  onDeleteLink: (id: string) => void;
  onLinksReorder: (groupId: string, newOrder: HubLink[]) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: group.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const handleLinkDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = groupLinks.findIndex((l) => l.id === active.id);
    const newIndex = groupLinks.findIndex((l) => l.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onLinksReorder(group.id, arrayMove(groupLinks, oldIndex, newIndex));
  };

  return (
    <div ref={setNodeRef} style={style} className="space-y-3">
      {/* Group heading */}
      <div className="flex items-center gap-2">
        {isAdmin && (
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            className="p-1 rounded cursor-grab active:cursor-grabbing text-[#C5CDD0] hover:text-[#9BADB7] transition-colors flex-shrink-0"
            title="Drag to reorder group"
          >
            <GripVertical className="w-4 h-4" />
          </button>
        )}
        <h2 className="text-sm font-bold text-[#223149] uppercase tracking-widest">{group.label}</h2>
        <div className="flex-1 h-px bg-[#ECE3DF]" />
        {isAdmin && (
          <div className="flex items-center gap-1">
            <button
              onClick={onAddLink}
              className="p-1.5 rounded-lg hover:bg-[#ECE3DF] transition-colors"
              title="Add link to group"
            >
              <Plus className="w-3.5 h-3.5 text-[#9BADB7]" />
            </button>
            <button
              onClick={onEditGroup}
              className="p-1.5 rounded-lg hover:bg-[#ECE3DF] transition-colors"
              title="Rename group"
            >
              <Pencil className="w-3.5 h-3.5 text-[#9BADB7]" />
            </button>
            <button
              onClick={onDeleteGroup}
              disabled={deletingGroupId === group.id}
              className="p-1.5 rounded-lg hover:bg-rose-50 transition-colors disabled:opacity-50"
              title="Delete group"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-300" />
            </button>
          </div>
        )}
      </div>

      {/* Links row with its own DnD context */}
      {groupLinks.length === 0 ? (
        <p className="text-sm text-[#9BADB7] italic pl-1">
          No links yet.{isAdmin && " Click + to add one."}
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleLinkDragEnd}>
          <SortableContext items={groupLinks.map((l) => l.id)} strategy={horizontalListSortingStrategy}>
            <div className="flex flex-wrap gap-2 pt-2">
              {groupLinks.map((link) => (
                <SortableLinkCard
                  key={link.id}
                  link={link}
                  isAdmin={isAdmin}
                  onEdit={() => onEditLink(link)}
                  onDelete={() => onDeleteLink(link.id)}
                  deleting={deletingLinkId === link.id}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function StaffHubPage() {
  const [groups, setGroups] = useState<HubGroup[]>([]);
  const [links, setLinks] = useState<HubLink[]>([]);
  const [role, setRole] = useState("staff");
  const [loading, setLoading] = useState(true);

  const [showAddLink, setShowAddLink] = useState(false);
  const [addLinkGroupId, setAddLinkGroupId] = useState<string | null>(null);
  const [editLink, setEditLink] = useState<HubLink | null>(null);
  const [deletingLinkId, setDeletingLinkId] = useState<string | null>(null);

  const [showAddGroup, setShowAddGroup] = useState(false);
  const [editGroup, setEditGroup] = useState<HubGroup | null>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const fetchAll = async () => {
    const [linksRes, groupsRes] = await Promise.all([
      fetch("/api/hub/links").then((r) => r.json()),
      fetch("/api/hub/groups").then((r) => r.json()),
    ]);
    setLinks(linksRes.links ?? []);
    setGroups(groupsRes.groups ?? []);
    setRole(linksRes.role ?? groupsRes.role ?? "staff");
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const isAdmin = role === "admin";

  // ── Link handlers ─────────────────────────────────────────────────────────
  const handleAddLink = async (body: { label: string; url: string; description: string; group_id: string | null }) => {
    const res = await fetch("/api/hub/links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Failed"); }
    setShowAddLink(false);
    fetchAll();
  };

  const handleEditLink = async (body: { label: string; url: string; description: string; group_id: string | null }) => {
    if (!editLink) return;
    const res = await fetch(`/api/hub/links/${editLink.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Failed"); }
    setEditLink(null);
    fetchAll();
  };

  const handleDeleteLink = async (id: string) => {
    if (!confirm("Remove this link?")) return;
    setDeletingLinkId(id);
    await fetch(`/api/hub/links/${id}`, { method: "DELETE" });
    setDeletingLinkId(null);
    fetchAll();
  };

  // ── Group handlers ────────────────────────────────────────────────────────
  const handleAddGroup = async (label: string) => {
    const res = await fetch("/api/hub/groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label }) });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Failed"); }
    setShowAddGroup(false);
    fetchAll();
  };

  const handleEditGroup = async (label: string) => {
    if (!editGroup) return;
    const res = await fetch(`/api/hub/groups/${editGroup.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label }) });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Failed"); }
    setEditGroup(null);
    fetchAll();
  };

  const handleDeleteGroup = async (id: string) => {
    if (!confirm("Delete this group? Links inside will become ungrouped.")) return;
    setDeletingGroupId(id);
    await fetch(`/api/hub/groups/${id}`, { method: "DELETE" });
    setDeletingGroupId(null);
    fetchAll();
  };

  // ── Reorder handlers ──────────────────────────────────────────────────────
  const handleGroupDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = groups.findIndex((g) => g.id === active.id);
    const newIndex = groups.findIndex((g) => g.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const newGroups = arrayMove(groups, oldIndex, newIndex);
    setGroups(newGroups);
    fetch("/api/hub/groups/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: newGroups.map((g) => g.id) }),
    });
  };

  const handleLinksReorder = (groupId: string, newOrderedLinks: HubLink[]) => {
    // Update local state for this group's links
    setLinks((prev) => {
      const otherLinks = prev.filter((l) => l.group_id !== groupId);
      return [...otherLinks, ...newOrderedLinks];
    });
    fetch("/api/hub/links/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: newOrderedLinks.map((l) => l.id) }),
    });
  };

  const handleUngroupedLinksReorder = (newOrderedLinks: HubLink[]) => {
    setLinks((prev) => {
      const grouped = prev.filter((l) => l.group_id !== null);
      return [...grouped, ...newOrderedLinks];
    });
    fetch("/api/hub/links/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: newOrderedLinks.map((l) => l.id) }),
    });
  };

  // ── Partition links ───────────────────────────────────────────────────────
  const linksInGroup = (groupId: string) => links.filter((l) => l.group_id === groupId);
  const ungroupedLinks = links.filter((l) => !l.group_id);
  const hasAnything = links.length > 0 || groups.length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#223149] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#223149]">Staff Hub</h1>
          <p className="text-[#5F7C84] mt-1 text-sm">Quick links and resources for the team</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddGroup(true)}
              className="flex items-center gap-2 px-3 py-2.5 border border-[#ECE3DF] text-[#5F7C84] rounded-xl text-sm font-semibold hover:bg-[#F8F6F4] transition-colors"
            >
              <FolderPlus className="w-4 h-4" />
              <span className="hidden sm:inline">New Group</span>
            </button>
            <button
              onClick={() => { setAddLinkGroupId(null); setShowAddLink(true); }}
              className="flex items-center gap-2 px-3 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Link</span>
            </button>
          </div>
        )}
      </div>

      {/* Empty state */}
      {!hasAnything && (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center space-y-3">
          <BookOpen className="w-12 h-12 text-[#ECE3DF] mx-auto" />
          <p className="font-semibold text-[#223149]">No links yet</p>
          <p className="text-sm text-[#9BADB7]">
            {isAdmin ? "Create a group or add links for your team." : "Your admin hasn't added any links yet."}
          </p>
          {isAdmin && (
            <div className="flex justify-center gap-2 mt-2">
              <button onClick={() => setShowAddGroup(true)} className="inline-flex items-center gap-2 px-4 py-2 border border-[#ECE3DF] text-[#5F7C84] rounded-xl text-sm font-semibold hover:bg-[#F8F6F4] transition-colors">
                <FolderPlus className="w-4 h-4" /> New Group
              </button>
              <button onClick={() => { setAddLinkGroupId(null); setShowAddLink(true); }} className="inline-flex items-center gap-2 px-4 py-2 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors">
                <Plus className="w-4 h-4" /> Add Link
              </button>
            </div>
          )}
        </div>
      )}

      {/* Groups — outer DnD context for group reordering */}
      {groups.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleGroupDragEnd}>
          <SortableContext items={groups.map((g) => g.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-8">
              {groups.map((group) => (
                <SortableGroupSection
                  key={group.id}
                  group={group}
                  groupLinks={linksInGroup(group.id)}
                  isAdmin={isAdmin}
                  sensors={sensors}
                  deletingGroupId={deletingGroupId}
                  deletingLinkId={deletingLinkId}
                  onAddLink={() => { setAddLinkGroupId(group.id); setShowAddLink(true); }}
                  onEditGroup={() => setEditGroup(group)}
                  onDeleteGroup={() => handleDeleteGroup(group.id)}
                  onEditLink={setEditLink}
                  onDeleteLink={handleDeleteLink}
                  onLinksReorder={handleLinksReorder}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Ungrouped links */}
      {ungroupedLinks.length > 0 && (
        <div className="space-y-3">
          {groups.length > 0 && (
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-bold text-[#223149] uppercase tracking-widest">General</h2>
              <div className="flex-1 h-px bg-[#ECE3DF]" />
            </div>
          )}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(event) => {
              const { active, over } = event;
              if (!over || active.id === over.id) return;
              const oldIndex = ungroupedLinks.findIndex((l) => l.id === active.id);
              const newIndex = ungroupedLinks.findIndex((l) => l.id === over.id);
              if (oldIndex === -1 || newIndex === -1) return;
              handleUngroupedLinksReorder(arrayMove(ungroupedLinks, oldIndex, newIndex));
            }}
          >
            <SortableContext items={ungroupedLinks.map((l) => l.id)} strategy={horizontalListSortingStrategy}>
              <div className="flex flex-wrap gap-2 pt-2">
                {ungroupedLinks.map((link) => (
                  <SortableLinkCard
                    key={link.id}
                    link={link}
                    isAdmin={isAdmin}
                    onEdit={() => setEditLink(link)}
                    onDelete={() => handleDeleteLink(link.id)}
                    deleting={deletingLinkId === link.id}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* Modals */}
      {showAddLink && (
        <LinkModal
          groups={groups}
          defaultGroupId={addLinkGroupId}
          onClose={() => setShowAddLink(false)}
          onSave={handleAddLink}
        />
      )}
      {editLink && (
        <LinkModal
          initial={editLink}
          groups={groups}
          onClose={() => setEditLink(null)}
          onSave={handleEditLink}
        />
      )}
      {showAddGroup && (
        <GroupModal onClose={() => setShowAddGroup(false)} onSave={handleAddGroup} />
      )}
      {editGroup && (
        <GroupModal initial={editGroup} onClose={() => setEditGroup(null)} onSave={handleEditGroup} />
      )}
    </div>
  );
}
