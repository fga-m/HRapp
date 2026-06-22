"use client";

import { useEffect, useState } from "react";
import { Lock, Plus, Pencil, Trash2, Check, X, Loader2 } from "lucide-react";
import { FEATURES } from "@/lib/permissions";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import PageSubtitle from "@/components/PageSubtitle";

interface RoleRow {
  key: string;
  label: string;
  sort_order: number;
  is_system: boolean;
  is_admin: boolean;
}

interface RolePermission {
  role: string;
  feature: string;
  enabled: boolean;
}

type PermissionsMap = Record<string, Record<string, boolean>>;

function buildMap(permissions: RolePermission[]): PermissionsMap {
  const map: PermissionsMap = {};
  for (const p of permissions) {
    if (!map[p.role]) map[p.role] = {};
    map[p.role][p.feature] = p.enabled;
  }
  return map;
}

// Stable-ish badge colour per role.
const PALETTE = ["bg-[#5F7C84]", "bg-[#2E7D52]", "bg-[#9BADB7]", "bg-[#7A6CA8]", "bg-[#B5743F]", "bg-[#3F73B5]"];
function badgeColor(role: RoleRow, index: number): string {
  if (role.key === "manager") return "bg-[#5F7C84]";
  if (role.key === "finance") return "bg-[#2E7D52]";
  if (role.key === "staff") return "bg-[#9BADB7]";
  return PALETTE[index % PALETTE.length];
}

export default function AccessLevelsPage() {
  const confirm = useConfirm();
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [permMap, setPermMap] = useState<PermissionsMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [newLabel, setNewLabel] = useState("");
  const [addingRole, setAddingRole] = useState(false);

  const load = () => {
    fetch("/api/permissions")
      .then((r) => r.json())
      .then((d) => {
        setRoles(d.roles ?? []);
        setPermMap(buildMap(d.permissions ?? []));
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load permissions");
        setLoading(false);
      });
  };

  useEffect(() => { load(); }, []);

  const toggle = async (role: string, feature: string) => {
    const current = permMap[role]?.[feature] ?? false;
    const next = !current;
    const key = `${role}:${feature}`;

    setPermMap((prev) => ({ ...prev, [role]: { ...(prev[role] ?? {}), [feature]: next } }));
    setSaving(key);
    setError("");

    try {
      const res = await fetch("/api/permissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, feature, enabled: next }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to save");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setPermMap((prev) => ({ ...prev, [role]: { ...(prev[role] ?? {}), [feature]: current } }));
    } finally {
      setSaving(null);
    }
  };

  const addRole = async () => {
    const label = newLabel.trim();
    if (!label) return;
    setAddingRole(true);
    setError("");
    try {
      const res = await fetch("/api/permissions/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to add role");
      setNewLabel("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add role");
    } finally {
      setAddingRole(false);
    }
  };

  const renameRole = async (key: string, label: string) => {
    setError("");
    const res = await fetch("/api/permissions/roles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, label }),
    });
    if (!res.ok) {
      setError((await res.json()).error || "Failed to rename role");
      return false;
    }
    load();
    return true;
  };

  const deleteRole = async (role: RoleRow) => {
    const ok = await confirm({
      title: `Delete the "${role.label}" role?`,
      message: "Anyone who only had this role will fall back to Staff. This can't be undone.",
      danger: true,
      confirmLabel: "Delete role",
    });
    if (!ok) return;
    setError("");
    try {
      const res = await fetch(`/api/permissions/roles?key=${encodeURIComponent(role.key)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to delete role");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete role");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#223149] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const adminRole = roles.find((r) => r.is_admin);
  const otherRoles = roles.filter((r) => !r.is_admin);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-[#223149]">Roles & Permissions</h1>
          <PageSubtitle pageKey="access" defaultDescription="Control what each role can access and do within the portal." />
          <p className="text-xs text-[#50676E] mt-1">Turning a feature off hides it from that role entirely. A person can hold more than one role and gets the combined access.</p>
        </div>

        {/* Add role */}
        <div className="flex items-end gap-2">
          <div>
            <label className="block text-xs font-semibold text-[#50676E] mb-1">New role name</label>
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addRole(); }}
              placeholder="e.g. Pastor"
              className="px-3 py-2 rounded-xl border border-[#ECE3DF] text-sm text-[#223149] placeholder:text-[#6E8189] focus:outline-none focus:ring-2 focus:ring-[#223149]/20"
            />
          </div>
          <button
            onClick={addRole}
            disabled={addingRole || !newLabel.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50"
          >
            {addingRole ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add role
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Admin card — locked, always full access */}
        {adminRole && (
          <div className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-[#223149] text-white">
                {adminRole.label}
              </span>
              <Lock className="w-4 h-4 text-[#50676E]" />
            </div>
            <p className="text-xs text-[#50676E] mb-5 italic">
              Admins always have full access and cannot be restricted.
            </p>
            <div className="space-y-0">
              {FEATURES.map((feature, i) => (
                <div key={feature.key} className={`py-3.5 ${i < FEATURES.length - 1 ? "border-b border-[#ECE3DF]" : ""}`}>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-[#ECE3DF] text-[#223149] flex-shrink-0">
                      Always on
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#223149] truncate">{feature.label}</p>
                      <p className="text-xs text-[#50676E] leading-tight mt-0.5">{feature.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {otherRoles.map((role, idx) => (
          <RoleCard
            key={role.key}
            role={role}
            badge={badgeColor(role, idx)}
            permMap={permMap}
            saving={saving}
            onToggle={toggle}
            onRename={renameRole}
            onDelete={deleteRole}
          />
        ))}
      </div>
    </div>
  );
}

interface RoleCardProps {
  role: RoleRow;
  badge: string;
  permMap: PermissionsMap;
  saving: string | null;
  onToggle: (role: string, feature: string) => void;
  onRename: (key: string, label: string) => Promise<boolean>;
  onDelete: (role: RoleRow) => void;
}

function RoleCard({ role, badge, permMap, saving, onToggle, onRename, onDelete }: RoleCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(role.label);
  const [busy, setBusy] = useState(false);

  const saveName = async () => {
    const label = draft.trim();
    if (!label || label === role.label) { setEditing(false); return; }
    setBusy(true);
    const ok = await onRename(role.key, label);
    setBusy(false);
    if (ok) setEditing(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm p-6">
      <div className="flex items-center justify-between gap-2 mb-5">
        {editing ? (
          <div className="flex items-center gap-1.5 flex-1">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { setEditing(false); setDraft(role.label); } }}
              className="px-2.5 py-1 rounded-lg border border-[#ECE3DF] text-sm text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 w-full"
            />
            <button onClick={saveName} disabled={busy} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg disabled:opacity-50" aria-label="Save name">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            </button>
            <button onClick={() => { setEditing(false); setDraft(role.label); }} className="p-1.5 text-[#50676E] hover:bg-[#F8F6F4] rounded-lg" aria-label="Cancel">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${badge} text-white`}>
              {role.label}
            </span>
            <div className="flex items-center gap-1">
              {role.is_system ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[#50676E]">
                  <Lock className="w-3 h-3" /> Built-in
                </span>
              ) : (
                <>
                  <button onClick={() => { setDraft(role.label); setEditing(true); }} className="p-1.5 text-[#50676E] hover:text-[#223149] hover:bg-[#F8F6F4] rounded-lg" aria-label="Rename role">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => onDelete(role)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg" aria-label="Delete role">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      <div className="space-y-0">
        {FEATURES.map((feature, i) => {
          const enabled = permMap[role.key]?.[feature.key] ?? false;
          const key = `${role.key}:${feature.key}`;
          const isSaving = saving === key;
          return (
            <div key={feature.key} className={`py-3.5 ${i < FEATURES.length - 1 ? "border-b border-[#ECE3DF]" : ""}`}>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => onToggle(role.key, feature.key)}
                  className={`relative w-9 h-5 rounded-full flex-shrink-0 transition-colors ${enabled ? "bg-[#223149]" : "bg-[#ECE3DF]"} ${isSaving ? "opacity-50 cursor-not-allowed" : ""}`}
                  style={{ touchAction: "manipulation" }}
                  aria-label={`${enabled ? "Disable" : "Enable"} ${feature.label} for ${role.label}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${enabled ? "right-0.5" : "left-0.5"}`} />
                </button>
                <span className={`text-[10px] font-semibold uppercase tracking-wide w-7 flex-shrink-0 ${enabled ? "text-[#223149]" : "text-[#50676E]"}`}>
                  {enabled ? "On" : "Off"}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#223149] truncate">{feature.label}</p>
                  <p className="text-xs text-[#50676E] leading-tight mt-0.5">{feature.description}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
