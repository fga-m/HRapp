"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Lock } from "lucide-react";
import { FEATURES } from "@/lib/permissions";

interface RolePermission {
  id: string;
  role: string;
  feature: string;
  enabled: boolean;
  updated_at: string;
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

export default function AccessLevelsPage() {
  const [permMap, setPermMap] = useState<PermissionsMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/permissions")
      .then((r) => r.json())
      .then((d) => {
        setPermMap(buildMap(d.permissions ?? []));
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load permissions");
        setLoading(false);
      });
  }, []);

  const toggle = async (role: "manager" | "finance" | "staff", feature: string) => {
    const current = permMap[role]?.[feature] ?? false;
    const next = !current;
    const key = `${role}:${feature}`;

    // Optimistic update
    setPermMap((prev) => ({
      ...prev,
      [role]: { ...(prev[role] ?? {}), [feature]: next },
    }));
    setSaving(key);
    setError("");

    try {
      const res = await fetch("/api/permissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, feature, enabled: next }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to save");
      }
    } catch (err: any) {
      setError(err.message);
      // Revert on failure
      setPermMap((prev) => ({
        ...prev,
        [role]: { ...(prev[role] ?? {}), [feature]: current },
      }));
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#223149] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#223149] flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#223149]">Access Levels</h1>
          <p className="text-sm text-[#9BADB7] mt-0.5">
            Configure which features each role can access
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {/* Admin card — locked */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-[#223149] text-white">
                Admin
              </span>
            </div>
            <Lock className="w-4 h-4 text-[#9BADB7]" />
          </div>
          <p className="text-xs text-[#9BADB7] mb-5 italic">
            Admins always have full access and cannot be restricted.
          </p>
          <div className="space-y-0">
            {FEATURES.map((feature, i) => (
              <div
                key={feature.key}
                className={`py-3.5 ${i < FEATURES.length - 1 ? "border-b border-[#ECE3DF]" : ""}`}
              >
                <div className="flex items-center gap-3">
                  {/* Always-on toggle indicator */}
                  <div className="relative w-9 h-5 rounded-full bg-[#223149] flex-shrink-0">
                    <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-white rounded-full shadow" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#223149] truncate">
                      {feature.label}
                    </p>
                    <p className="text-xs text-[#9BADB7] leading-tight mt-0.5">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Manager card */}
        <RoleCard
          role="manager"
          label="Manager"
          badgeColor="bg-[#5F7C84]"
          permMap={permMap}
          saving={saving}
          onToggle={toggle}
        />

        {/* Finance card */}
        <RoleCard
          role="finance"
          label="Finance"
          badgeColor="bg-[#2E7D52]"
          permMap={permMap}
          saving={saving}
          onToggle={toggle}
        />

        {/* Staff card */}
        <RoleCard
          role="staff"
          label="Staff"
          badgeColor="bg-[#9BADB7]"
          permMap={permMap}
          saving={saving}
          onToggle={toggle}
        />
      </div>
    </div>
  );
}

interface RoleCardProps {
  role: "manager" | "finance" | "staff";
  label: string;
  badgeColor: string;
  permMap: PermissionsMap;
  saving: string | null;
  onToggle: (role: "manager" | "staff", feature: string) => void;
}

function RoleCard({ role, label, badgeColor, permMap, saving, onToggle }: RoleCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <div className="mb-5">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${badgeColor} text-white`}>
          {label}
        </span>
      </div>
      <div className="space-y-0">
        {FEATURES.map((feature, i) => {
          const enabled = permMap[role]?.[feature.key] ?? false;
          const key = `${role}:${feature.key}`;
          const isSaving = saving === key;
          return (
            <div
              key={feature.key}
              className={`py-3.5 ${i < FEATURES.length - 1 ? "border-b border-[#ECE3DF]" : ""}`}
            >
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => onToggle(role, feature.key)}
                  className={`relative w-9 h-5 rounded-full flex-shrink-0 transition-colors ${
                    enabled ? "bg-[#223149]" : "bg-[#ECE3DF]"
                  } ${isSaving ? "opacity-50 cursor-not-allowed" : ""}`}
                  style={{ touchAction: "manipulation" }}
                  aria-label={`${enabled ? "Disable" : "Enable"} ${feature.label} for ${label}`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                      enabled ? "right-0.5" : "left-0.5"
                    }`}
                  />
                </button>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#223149] truncate">
                    {feature.label}
                  </p>
                  <p className="text-xs text-[#9BADB7] leading-tight mt-0.5">
                    {feature.description}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
