"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Plus, Edit, ClipboardList, LayoutTemplate, Calendar,
  ChevronRight, X, Users, ToggleLeft, ToggleRight
} from "lucide-react";
import { format, parseISO } from "date-fns";
import PageSubtitle from "@/components/PageSubtitle";

// ─── Types ───────────────────────────────────────────────────────────────────

type Template = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  ministry: string | null;
  is_offboarding: boolean;
  created_at: string;
  item_count?: number;
};

type AssignedChecklist = {
  id: string;
  staff_id: string;
  title: string;
  is_offboarding: boolean;
  due_date: string | null;
  created_at: string;
  staff: { full_name: string; email: string };
  completions_count: number;
  total_items: number;
  required_items: number;
  completed_required: number;
};

type StaffMember = { id: string; full_name: string; email: string };

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-[#50676E] mb-1">
        <span>{value} / {max} required</span>
        <span>{pct}%</span>
      </div>
      <div className="w-full bg-[#ECE3DF] rounded-full h-2">
        <div
          className="bg-[#223149] h-2 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
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
        <ToggleLeft className="w-6 h-6 text-[#50676E]" />
      )}
      <span>{value ? labelOn : labelOff}</span>
    </button>
  );
}

// ─── Assign Checklist Modal ───────────────────────────────────────────────────

function AssignModal({
  templates,
  initialTemplateId,
  onClose,
  onSuccess,
}: {
  templates: Template[];
  initialTemplateId?: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [staffId, setStaffId] = useState("");
  const [templateId, setTemplateId] = useState(initialTemplateId ?? "");
  const [title, setTitle] = useState("");
  const [isOffboarding, setIsOffboarding] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/staff")
      .then((r) => r.json())
      .then((d) => setStaffList(d.staff ?? d ?? []));
  }, []);

  useEffect(() => {
    if (templateId) {
      const tpl = templates.find((t) => t.id === templateId);
      if (tpl) {
        setTitle(tpl.title);
        setIsOffboarding(tpl.is_offboarding);
      }
    }
  }, [templateId, templates]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffId || !title.trim()) {
      setError("Staff member and title are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/checklists/assigned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staff_id: staffId,
          template_id: templateId || null,
          title: title.trim(),
          is_offboarding: isOffboarding,
          due_date: dueDate || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Failed to assign checklist");
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-xl w-full md:max-w-md p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#223149]">Assign Checklist</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#F8F6F4] transition-colors"
          >
            <X className="w-5 h-5 text-[#50676E]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Staff */}
          <div>
            <label htmlFor="staff-member" className="block text-sm font-semibold text-[#223149] mb-1.5">
              Staff Member <span className="text-rose-500">*</span>
            </label>
            <select id="staff-member"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] bg-white focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
            >
              <option value="">Select staff member...</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Template */}
          <div>
            <label htmlFor="template" className="block text-sm font-semibold text-[#223149] mb-1.5">
              Template{" "}
              <span className="text-xs font-normal text-[#50676E]">(optional)</span>
            </label>
            <select id="template"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] bg-white focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
            >
              <option value="">No template (blank checklist)</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} {t.is_offboarding ? "(Offboarding)" : "(Onboarding)"}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-semibold text-[#223149] mb-1.5">
              Title <span className="text-rose-500">*</span>
            </label>
            <input id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g. New Staff Onboarding"
              className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#6E8189] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
            />
          </div>

          {/* Type toggle */}
          <div>
            <label className="block text-sm font-semibold text-[#223149] mb-2">Type</label>
            <Toggle
              value={isOffboarding}
              onChange={setIsOffboarding}
              labelOff="Onboarding"
              labelOn="Offboarding"
            />
          </div>

          {/* Due date */}
          <div>
            <label htmlFor="due-date" className="block text-sm font-semibold text-[#223149] mb-1.5">
              Due Date{" "}
              <span className="text-xs font-normal text-[#50676E]">(optional)</span>
            </label>
            <input id="due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
            />
          </div>

          {error && <p className="text-sm text-rose-500">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50"
            >
              {saving ? "Assigning..." : "Assign Checklist"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-[#ECE3DF] text-[#50676E] rounded-xl text-sm font-semibold hover:bg-[#F8F6F4] transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── New Template Modal ───────────────────────────────────────────────────────

function NewTemplateModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (id: string) => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isOffboarding, setIsOffboarding] = useState(false);
  const [category, setCategory] = useState<"generic" | "ministry">("generic");
  const [ministry, setMinistry] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/checklists/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          is_offboarding: isOffboarding,
          category: category,
          ministry: category === "ministry" ? ministry.trim() || null : null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Failed to create template");
      }
      const d = await res.json();
      onSuccess(d.template?.id ?? d.id);
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-xl w-full md:max-w-md p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#223149]">New Template</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#F8F6F4] transition-colors"
          >
            <X className="w-5 h-5 text-[#50676E]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="title-2" className="block text-sm font-semibold text-[#223149] mb-1.5">
              Title <span className="text-rose-500">*</span>
            </label>
            <input id="title-2"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
              placeholder="e.g. Standard Onboarding"
              className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#6E8189] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-semibold text-[#223149] mb-1.5">
              Description{" "}
              <span className="text-xs font-normal text-[#50676E]">(optional)</span>
            </label>
            <textarea id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Brief description of this template..."
              className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#6E8189] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#223149] mb-2">Type</label>
            <Toggle
              value={isOffboarding}
              onChange={setIsOffboarding}
              labelOff="Onboarding"
              labelOn="Offboarding"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#223149] mb-1.5">Category</label>
            <div className="flex gap-3">
              {(["generic", "ministry"] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`flex-1 px-4 py-2 rounded-xl border text-sm font-medium transition-colors capitalize ${
                    category === cat
                      ? "bg-[#223149] text-white border-[#223149]"
                      : "border-[#ECE3DF] text-[#50676E] hover:bg-[#F8F6F4]"
                  }`}
                >
                  {cat === "generic" ? "Generic" : "Ministry-Specific"}
                </button>
              ))}
            </div>
          </div>

          {category === "ministry" && (
            <div>
              <label htmlFor="ministry-name" className="block text-sm font-semibold text-[#223149] mb-1.5">
                Ministry Name
              </label>
              <input id="ministry-name"
                type="text"
                value={ministry}
                onChange={(e) => setMinistry(e.target.value)}
                placeholder="e.g. Youth Ministry"
                className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#6E8189] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
              />
            </div>
          )}

          {error && <p className="text-sm text-rose-500">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create Template"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-[#ECE3DF] text-[#50676E] rounded-xl text-sm font-semibold hover:bg-[#F8F6F4] transition-colors"
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

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const assignTemplateId = searchParams.get("assign");

  const [tab, setTab] = useState<"active" | "templates">("active");
  const [role, setRole] = useState<string>("staff");
  const [checklists, setChecklists] = useState<AssignedChecklist[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [assignedRes, templatesRes] = await Promise.all([
        fetch("/api/checklists/assigned"),
        fetch("/api/checklists/templates"),
      ]);
      if (!assignedRes.ok || !templatesRes.ok) {
        throw new Error("Failed to load checklists");
      }
      const assignedData = await assignedRes.json();
      const templatesData = await templatesRes.json();
      setRole(assignedData.role ?? templatesData.role ?? "staff");
      setChecklists(assignedData.checklists ?? []);
      setTemplates(templatesData.templates ?? []);
    } catch {
      setLoadError("We couldn't load your checklists. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const isAdmin = role === "admin";

  // Deep-link from a template editor: open the Assign modal pre-selected
  useEffect(() => {
    if (!loading && isAdmin && assignTemplateId) {
      setTab("active");
      setShowAssignModal(true);
    }
  }, [loading, isAdmin, assignTemplateId]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#223149] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm p-12 text-center space-y-3">
        <ClipboardList className="w-12 h-12 text-[#ECE3DF] mx-auto" />
        <p className="font-semibold text-[#223149]">Something went wrong</p>
        <p className="text-sm text-[#50676E]">{loadError}</p>
        <button
          onClick={fetchData}
          className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  // ── Staff view ─────────────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-[#223149]">My Checklists</h1>
          <PageSubtitle pageKey="onboarding" defaultDescription="Track task progress for checklists assigned to you." />
        </div>

        {checklists.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm p-12 text-center space-y-3">
            <ClipboardList className="w-12 h-12 text-[#ECE3DF] mx-auto" />
            <p className="font-semibold text-[#223149]">No checklist assigned yet</p>
            <p className="text-sm text-[#50676E]">
              Your HR admin will assign an onboarding checklist when ready.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {checklists.map((cl) => (
              <Link
                key={cl.id}
                href={`/dashboard/onboarding/${cl.id}`}
                className="block bg-white rounded-2xl border border-[#ECE3DF] shadow-sm p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="font-semibold text-[#223149]">{cl.title}</p>
                    {cl.due_date && (
                      <p className="text-xs text-[#50676E] mt-0.5 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Due {format(parseISO(cl.due_date), "d MMM yyyy")}
                      </p>
                    )}
                  </div>
                  <TypeBadge isOffboarding={cl.is_offboarding} />
                </div>
                <ProgressBar value={cl.completed_required} max={cl.required_items} />
                <div className="mt-3 flex items-center justify-end text-xs text-[#50676E]">
                  <span>View checklist</span>
                  <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Admin view ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#223149]">Checklists</h1>
          <PageSubtitle pageKey="onboarding" defaultDescription="Track checklist progress for staff joining or leaving the organisation." />
        </div>
        {tab === "active" ? (
          <button
            onClick={() => setShowAssignModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="sm:hidden">Assign</span>
            <span className="hidden sm:inline">Assign Checklist</span>
          </button>
        ) : (
          <button
            onClick={() => setShowTemplateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="sm:hidden">New</span>
            <span className="hidden sm:inline">New Template</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#ECE3DF] gap-6">
        {(["active", "templates"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-3 text-sm font-semibold flex items-center gap-1.5 border-b-2 -mb-px transition-colors ${
              tab === t
                ? "border-[#223149] text-[#223149]"
                : "border-transparent text-[#50676E] hover:text-[#50676E]"
            }`}
          >
            {t === "active" ? (
              <>
                <ClipboardList className="w-4 h-4" />
                Active Checklists
              </>
            ) : (
              <>
                <LayoutTemplate className="w-4 h-4" />
                Templates
              </>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "active" ? (
        <div>
          {checklists.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm p-12 text-center space-y-3">
              <Users className="w-12 h-12 text-[#ECE3DF] mx-auto" />
              <p className="font-semibold text-[#223149]">No active checklists</p>
              <p className="text-sm text-[#50676E]">
                Assign a checklist to a staff member to get started.
              </p>
              <button
                onClick={() => setShowAssignModal(true)}
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors"
              >
                <Plus className="w-4 h-4" />
                Assign Checklist
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {checklists.map((cl) => {
                const pct =
                  cl.required_items > 0
                    ? Math.round((cl.completed_required / cl.required_items) * 100)
                    : 0;
                return (
                  <div
                    key={cl.id}
                    className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm p-5 flex flex-col gap-4"
                  >
                    {/* Top row */}
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-[#223149] flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-sm font-bold">
                          {initials(cl.staff?.full_name ?? "?")}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[#223149] truncate">
                          {cl.staff?.full_name}
                        </p>
                        <p className="text-xs text-[#50676E] truncate">{cl.title}</p>
                      </div>
                      <TypeBadge isOffboarding={cl.is_offboarding} />
                    </div>

                    {/* Progress */}
                    <ProgressBar value={cl.completed_required} max={cl.required_items} />

                    {/* Footer */}
                    <div className="flex items-center justify-between">
                      {cl.due_date ? (
                        <span className="flex items-center gap-1 text-xs text-[#50676E]">
                          <Calendar className="w-3 h-3" />
                          Due {format(parseISO(cl.due_date), "d MMM yyyy")}
                        </span>
                      ) : (
                        <span />
                      )}
                      <Link
                        href={`/dashboard/onboarding/${cl.id}`}
                        className="flex items-center gap-1 text-xs font-semibold text-[#223149] hover:text-[#50676E] transition-colors"
                      >
                        View
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div>
          {templates.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm p-12 text-center space-y-3">
              <LayoutTemplate className="w-12 h-12 text-[#ECE3DF] mx-auto" />
              <p className="font-semibold text-[#223149]">No templates yet</p>
              <p className="text-sm text-[#50676E]">
                Create a template to quickly assign structured checklists.
              </p>
              <button
                onClick={() => setShowTemplateModal(true)}
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Template
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm p-5 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#223149] truncate">{tpl.title}</p>
                      {tpl.description && (
                        <p className="text-xs text-[#50676E] mt-0.5 line-clamp-2">
                          {tpl.description}
                        </p>
                      )}
                    </div>
                    <TypeBadge isOffboarding={tpl.is_offboarding} />
                  </div>

                  <div className="flex items-center gap-3 text-xs text-[#50676E]">
                    {tpl.item_count !== undefined && (
                      <span>{tpl.item_count} item{tpl.item_count !== 1 ? "s" : ""}</span>
                    )}
                    {tpl.ministry && (
                      <>
                        <span>·</span>
                        <span>{tpl.ministry}</span>
                      </>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <Link
                      href={`/dashboard/onboarding/templates/${tpl.id}`}
                      className="flex items-center gap-1.5 text-xs font-semibold text-[#223149] hover:text-[#50676E] transition-colors"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      Edit
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showAssignModal && (
        <AssignModal
          templates={templates}
          initialTemplateId={assignTemplateId ?? undefined}
          onClose={() => setShowAssignModal(false)}
          onSuccess={() => {
            setShowAssignModal(false);
            fetchData();
          }}
        />
      )}

      {showTemplateModal && (
        <NewTemplateModal
          onClose={() => setShowTemplateModal(false)}
          onSuccess={(id) => {
            setShowTemplateModal(false);
            router.push(`/dashboard/onboarding/templates/${id}`);
          }}
        />
      )}
    </div>
  );
}
