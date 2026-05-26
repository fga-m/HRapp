"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Network,
  Pencil,
  Plus,
  Trash2,
  X,
  ChevronRight,
  UserMinus,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StaffMember {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string | null;
  position?: string | null;
}

interface OrgRole {
  id: string;
  title: string;
  description?: string | null;
  parent_id?: string | null;
  order_index: number;
  org_role_staff: { staff: StaffMember }[];
}

interface OrgData {
  roles: OrgRole[];
  role: "admin" | "staff";
  pdMap: Record<string, string>;
}

// ─── Helper: Avatar ────────────────────────────────────────────────────────────

function Avatar({ member, size = "sm" }: { member: StaffMember; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "w-7 h-7 text-xs" : "w-8 h-8 text-sm";
  const initials = member.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (member.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={member.avatar_url}
        alt={member.full_name}
        className={`${dim} rounded-full object-cover border-2 border-[#ECE3DF] flex-shrink-0`}
      />
    );
  }

  return (
    <div
      className={`${dim} rounded-full bg-[#5F7C84] text-white font-semibold flex items-center justify-center flex-shrink-0`}
    >
      {initials}
    </div>
  );
}

// ─── Role Card ─────────────────────────────────────────────────────────────────

function RoleCard({
  role,
  pdMap,
  isEditMode,
  onEdit,
  onAddChild,
  onDelete,
  allRoles,
  router,
}: {
  role: OrgRole;
  pdMap: Record<string, string>;
  isEditMode: boolean;
  onEdit: (role: OrgRole) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (role: OrgRole) => void;
  allRoles: OrgRole[];
  router: ReturnType<typeof useRouter>;
}) {
  const staffList = role.org_role_staff?.map((ors) => ors.staff).filter(Boolean) ?? [];
  const hasChildren = allRoles.some((r) => r.parent_id === role.id);

  return (
    <div className="relative bg-white rounded-2xl shadow-sm border border-[#ECE3DF] p-4 min-w-[180px] max-w-[220px] text-center select-none">
      {/* Edit mode controls — top right */}
      {isEditMode && (
        <div className="absolute top-2 right-2 flex items-center gap-1">
          <button
            onClick={() => onEdit(role)}
            className="w-6 h-6 rounded-lg flex items-center justify-center bg-[#F8F6F4] hover:bg-[#ECE3DF] text-[#5F7C84] transition-colors"
            title="Edit role"
          >
            <Pencil className="w-3 h-3" />
          </button>
          {!hasChildren && (
            <button
              onClick={() => onDelete(role)}
              className="w-6 h-6 rounded-lg flex items-center justify-center bg-[#F8F6F4] hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
              title="Delete role"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* Title */}
      <p className="font-bold text-[#223149] text-sm leading-tight pr-10">{role.title}</p>

      {/* Description */}
      {role.description && (
        <p className="text-xs text-[#9BADB7] mt-0.5 line-clamp-2">{role.description}</p>
      )}

      {/* Divider */}
      <div className="my-2 h-px bg-[#ECE3DF]" />

      {/* Staff */}
      {staffList.length === 0 ? (
        <span className="inline-block px-2 py-0.5 rounded-full bg-[#F8F6F4] text-[#9BADB7] text-xs">
          Vacant
        </span>
      ) : (
        <div className="flex flex-col items-center gap-2">
          {staffList.map((member) => {
            const pdId = pdMap[member.id];
            const content = (
              <div className="flex flex-col items-center gap-0.5">
                <Avatar member={member} size="sm" />
                <span className="text-xs text-[#5F7C84] leading-tight max-w-[160px] truncate">
                  {member.full_name}
                </span>
              </div>
            );

            return pdId ? (
              <button
                key={member.id}
                onClick={() => router.push(`/dashboard/position-descriptions/${pdId}`)}
                className="group flex flex-col items-center gap-0.5 hover:opacity-80 transition-opacity"
                title={`View ${member.full_name}'s position description`}
              >
                <Avatar member={member} size="sm" />
                <span className="text-xs text-[#223149] font-medium underline underline-offset-2 decoration-[#9BADB7] group-hover:decoration-[#5F7C84] leading-tight max-w-[160px] truncate">
                  {member.full_name}
                </span>
              </button>
            ) : (
              <div key={member.id} className="flex flex-col items-center gap-0.5">
                <Avatar member={member} size="sm" />
                <span className="text-xs text-[#5F7C84] leading-tight max-w-[160px] truncate">
                  {member.full_name}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Add child button (edit mode) */}
      {isEditMode && (
        <button
          onClick={() => onAddChild(role.id)}
          className="mt-3 w-full flex items-center justify-center gap-1 px-2 py-1 rounded-xl border border-dashed border-[#9BADB7] text-[#9BADB7] hover:border-[#5F7C84] hover:text-[#5F7C84] text-xs transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add child role
        </button>
      )}
    </div>
  );
}

// ─── Recursive Org Node ────────────────────────────────────────────────────────

function OrgNode({
  role,
  allRoles,
  pdMap,
  isEditMode,
  onEdit,
  onAddChild,
  onDelete,
  router,
}: {
  role: OrgRole;
  allRoles: OrgRole[];
  pdMap: Record<string, string>;
  isEditMode: boolean;
  onEdit: (role: OrgRole) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (role: OrgRole) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const children = allRoles
    .filter((r) => r.parent_id === role.id)
    .sort((a, b) => a.order_index - b.order_index);

  return (
    <div className="flex flex-col items-center">
      <RoleCard
        role={role}
        pdMap={pdMap}
        isEditMode={isEditMode}
        onEdit={onEdit}
        onAddChild={onAddChild}
        onDelete={onDelete}
        allRoles={allRoles}
        router={router}
      />

      {children.length > 0 && (
        <>
          {/* Vertical line down from parent */}
          <div className="w-px h-8 bg-[#ECE3DF]" />

          <div className="relative flex items-start">
            {/* Horizontal spanning bar for multiple children */}
            {children.length > 1 && (
              <div
                className="absolute top-0 h-px bg-[#ECE3DF]"
                style={{
                  left: "50%",
                  right: "50%",
                  width: "calc(100% - 110px)",
                  transform: "translateX(-50%)",
                }}
              />
            )}

            {children.map((child) => (
              <div key={child.id} className="flex flex-col items-center px-4">
                {/* Vertical drop to child */}
                <div className="w-px h-8 bg-[#ECE3DF]" />
                <OrgNode
                  role={child}
                  allRoles={allRoles}
                  pdMap={pdMap}
                  isEditMode={isEditMode}
                  onEdit={onEdit}
                  onAddChild={onAddChild}
                  onDelete={onDelete}
                  router={router}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Modals ────────────────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#ECE3DF]">
          <h2 className="font-bold text-[#223149] text-base">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[#F8F6F4] text-[#9BADB7] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function OrgChartPage() {
  const router = useRouter();

  const [data, setData] = useState<OrgData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);

  // Add role modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addParentId, setAddParentId] = useState<string | null>(null);
  const [addTitle, setAddTitle] = useState("");
  const [addDescription, setAddDescription] = useState("");
  const [addStaffIds, setAddStaffIds] = useState<string[]>([]);
  const [addLoading, setAddLoading] = useState(false);

  // Edit role modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editRole, setEditRole] = useState<OrgRole | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // Staff management within edit modal
  const [allStaff, setAllStaff] = useState<StaffMember[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [staffLoading, setStaffLoading] = useState(false);

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/org");
    if (res.ok) {
      const json = await res.json();
      setData(json);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch all active staff for the add-staff dropdown
  const fetchAllStaff = useCallback(async () => {
    const res = await fetch("/api/staff");
    if (res.ok) {
      const json = await res.json();
      const list: StaffMember[] = Array.isArray(json) ? json : json.staff ?? [];
      // Only show active staff in the assignment dropdown
      setAllStaff(list.filter((s: any) => s.is_active !== false));
    }
  }, []);

  const openEditModal = (role: OrgRole) => {
    setEditRole(role);
    setEditTitle(role.title);
    setEditDescription(role.description ?? "");
    setSelectedStaffId("");
    setShowEditModal(true);
    fetchAllStaff();
  };

  const openAddModal = (parentId: string | null) => {
    setAddParentId(parentId);
    setAddTitle("");
    setAddDescription("");
    setAddStaffIds([]);
    setShowAddModal(true);
    fetchAllStaff();
  };

  // ─── Add role ──────────────────────────────────────────────────────────────

  const handleAddRole = async () => {
    if (!addTitle.trim()) return;
    setAddLoading(true);
    const res = await fetch("/api/org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: addTitle.trim(),
        description: addDescription.trim() || null,
        parent_id: addParentId,
      }),
    });
    if (res.ok) {
      const newRole = await res.json();
      // Assign any selected staff in parallel
      if (addStaffIds.length > 0) {
        await Promise.all(
          addStaffIds.map((staffId) =>
            fetch(`/api/org/${newRole.id}/staff`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ staff_id: staffId }),
            })
          )
        );
      }
      setShowAddModal(false);
      await fetchData();
    }
    setAddLoading(false);
  };

  // ─── Save edits ────────────────────────────────────────────────────────────

  const handleSaveEdit = async () => {
    if (!editRole || !editTitle.trim()) return;
    setEditLoading(true);
    const res = await fetch(`/api/org/${editRole.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editTitle.trim(),
        description: editDescription.trim() || null,
      }),
    });
    if (res.ok) {
      setShowEditModal(false);
      await fetchData();
    }
    setEditLoading(false);
  };

  // ─── Delete role ───────────────────────────────────────────────────────────

  const handleDeleteRole = async (role: OrgRole) => {
    if (!confirm(`Delete "${role.title}"? Its child roles will become top-level roles.`)) return;
    const res = await fetch(`/api/org/${role.id}`, { method: "DELETE" });
    if (res.ok) await fetchData();
  };

  // ─── Staff assignment ──────────────────────────────────────────────────────

  const handleAssignStaff = async () => {
    if (!editRole || !selectedStaffId) return;
    setStaffLoading(true);
    const res = await fetch(`/api/org/${editRole.id}/staff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staff_id: selectedStaffId }),
    });
    if (res.ok) {
      setSelectedStaffId("");
      await fetchData();
      // Refresh editRole from updated data
      const refreshed = await fetch("/api/org");
      if (refreshed.ok) {
        const json: OrgData = await refreshed.json();
        setData(json);
        const updated = json.roles.find((r) => r.id === editRole.id);
        if (updated) setEditRole(updated);
      }
    }
    setStaffLoading(false);
  };

  const handleRemoveStaff = async (staffId: string) => {
    if (!editRole) return;
    setStaffLoading(true);
    const res = await fetch(`/api/org/${editRole.id}/staff?staff_id=${staffId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      const refreshed = await fetch("/api/org");
      if (refreshed.ok) {
        const json: OrgData = await refreshed.json();
        setData(json);
        const updated = json.roles.find((r) => r.id === editRole.id);
        if (updated) setEditRole(updated);
      }
    }
    setStaffLoading(false);
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#5F7C84] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isAdmin = data?.role === "admin";
  const allRoles = data?.roles ?? [];
  const pdMap = data?.pdMap ?? {};
  const rootRoles = allRoles.filter((r) => !r.parent_id).sort((a, b) => a.order_index - b.order_index);

  // Derive currently assigned staff IDs for the dropdown exclusion
  const assignedStaffIds = new Set(
    (editRole?.org_role_staff ?? []).map((ors) => ors.staff?.id).filter(Boolean)
  );
  const availableStaff = allStaff.filter((s) => !assignedStaffIds.has(s.id));

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#223149] flex items-center justify-center">
            <Network className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#223149]">Org Chart</h1>
            <p className="text-[#5F7C84] text-sm">
              {allRoles.length} role{allRoles.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            {isEditMode && (
              <button
                onClick={() => openAddModal(null)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#223149] text-[#223149] text-sm font-medium hover:bg-[#F8F6F4] transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add top-level role
              </button>
            )}
            <button
              onClick={() => setIsEditMode((v) => !v)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                isEditMode
                  ? "bg-[#223149] text-white hover:bg-[#1a2638]"
                  : "border border-[#223149] text-[#223149] hover:bg-[#F8F6F4]"
              }`}
            >
              <Pencil className="w-4 h-4" />
              {isEditMode ? "Done editing" : "Edit Chart"}
            </button>
          </div>
        )}
      </div>

      {/* ── Org tree ── */}
      {allRoles.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-[#ECE3DF] p-16 text-center">
          <Network className="w-10 h-10 text-[#9BADB7] mx-auto mb-4" />
          {isAdmin ? (
            <>
              <p className="text-[#223149] font-semibold text-lg mb-1">Build your org chart</p>
              <p className="text-[#9BADB7] text-sm mb-6">
                Add your first role to get started.
              </p>
              <button
                onClick={() => openAddModal(null)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add first role
              </button>
            </>
          ) : (
            <p className="text-[#9BADB7] text-sm">The org chart hasn&apos;t been set up yet.</p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto pb-6">
          <div className="inline-flex justify-center min-w-full pt-4">
            {rootRoles.length === 1 ? (
              <OrgNode
                role={rootRoles[0]}
                allRoles={allRoles}
                pdMap={pdMap}
                isEditMode={isEditMode}
                onEdit={openEditModal}
                onAddChild={openAddModal}
                onDelete={handleDeleteRole}
                router={router}
              />
            ) : (
              <div className="flex items-start gap-8 flex-wrap justify-center">
                {rootRoles.map((role) => (
                  <OrgNode
                    key={role.id}
                    role={role}
                    allRoles={allRoles}
                    pdMap={pdMap}
                    isEditMode={isEditMode}
                    onEdit={openEditModal}
                    onAddChild={openAddModal}
                    onDelete={handleDeleteRole}
                    router={router}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Add Role Modal ── */}
      {showAddModal && (
        <Modal
          title={addParentId ? "Add child role" : "Add top-level role"}
          onClose={() => setShowAddModal(false)}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#223149] mb-1">
                Role title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
                placeholder="e.g. Senior Pastor"
                className="w-full border border-[#ECE3DF] rounded-xl px-3 py-2 text-sm text-[#223149] placeholder-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#5F7C84]/30 focus:border-[#5F7C84]"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#223149] mb-1">
                Description{" "}
                <span className="text-[#9BADB7] font-normal">(optional)</span>
              </label>
              <textarea
                value={addDescription}
                onChange={(e) => setAddDescription(e.target.value)}
                placeholder="Brief description of this role..."
                rows={3}
                className="w-full border border-[#ECE3DF] rounded-xl px-3 py-2 text-sm text-[#223149] placeholder-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#5F7C84]/30 focus:border-[#5F7C84] resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#223149] mb-1">
                Assign staff{" "}
                <span className="text-[#9BADB7] font-normal">(optional)</span>
              </label>
              {/* Selected staff chips */}
              {addStaffIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {addStaffIds.map((sid) => {
                    const member = allStaff.find((s) => s.id === sid);
                    if (!member) return null;
                    return (
                      <span key={sid} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#223149] text-white text-xs font-medium">
                        {member.full_name}
                        <button
                          onClick={() => setAddStaffIds((prev) => prev.filter((id) => id !== sid))}
                          className="ml-0.5 hover:opacity-70 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value && !addStaffIds.includes(e.target.value)) {
                    setAddStaffIds((prev) => [...prev, e.target.value]);
                  }
                }}
                className="w-full border border-[#ECE3DF] rounded-xl px-3 py-2 text-sm text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#5F7C84]/30 focus:border-[#5F7C84]"
              >
                <option value="">Select staff member…</option>
                {allStaff
                  .filter((s) => !addStaffIds.includes(s.id))
                  .map((s) => (
                    <option key={s.id} value={s.id}>{s.full_name}</option>
                  ))}
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#5F7C84] text-sm font-medium hover:bg-[#F8F6F4] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddRole}
                disabled={!addTitle.trim() || addLoading}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#223149] text-white text-sm font-semibold hover:bg-[#1a2638] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {addLoading ? "Adding…" : "Add role"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Edit Role Modal ── */}
      {showEditModal && editRole && (
        <Modal title="Edit role" onClose={() => setShowEditModal(false)}>
          <div className="space-y-5">
            {/* Title / description fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#223149] mb-1">
                  Role title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full border border-[#ECE3DF] rounded-xl px-3 py-2 text-sm text-[#223149] placeholder-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#5F7C84]/30 focus:border-[#5F7C84]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#223149] mb-1">
                  Description{" "}
                  <span className="text-[#9BADB7] font-normal">(optional)</span>
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full border border-[#ECE3DF] rounded-xl px-3 py-2 text-sm text-[#223149] placeholder-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#5F7C84]/30 focus:border-[#5F7C84] resize-none"
                />
              </div>
            </div>

            {/* Staff assignment */}
            <div>
              <p className="text-sm font-medium text-[#223149] mb-2">Assigned staff</p>

              {/* Currently assigned */}
              {editRole.org_role_staff?.length > 0 ? (
                <div className="space-y-1 mb-3">
                  {editRole.org_role_staff.map((ors) => {
                    const member = ors.staff;
                    if (!member) return null;
                    return (
                      <div
                        key={member.id}
                        className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#F8F6F4]"
                      >
                        <div className="flex items-center gap-2">
                          <Avatar member={member} size="sm" />
                          <span className="text-sm text-[#223149]">{member.full_name}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveStaff(member.id)}
                          disabled={staffLoading}
                          className="w-6 h-6 flex items-center justify-center rounded-lg text-[#9BADB7] hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                          title="Remove from role"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-[#9BADB7] mb-3 italic">No staff assigned yet.</p>
              )}

              {/* Add staff dropdown */}
              {availableStaff.length > 0 && (
                <div className="flex gap-2">
                  <select
                    value={selectedStaffId}
                    onChange={(e) => setSelectedStaffId(e.target.value)}
                    className="flex-1 border border-[#ECE3DF] rounded-xl px-3 py-2 text-sm text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#5F7C84]/30 focus:border-[#5F7C84]"
                  >
                    <option value="">Select staff member…</option>
                    {availableStaff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAssignStaff}
                    disabled={!selectedStaffId || staffLoading}
                    className="px-3 py-2 rounded-xl bg-[#5F7C84] text-white text-sm font-medium hover:bg-[#4e6b72] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#5F7C84] text-sm font-medium hover:bg-[#F8F6F4] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={!editTitle.trim() || editLoading}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#223149] text-white text-sm font-semibold hover:bg-[#1a2638] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {editLoading ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
