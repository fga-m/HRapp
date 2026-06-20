"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  Plus,
  Trash2,
  RefreshCw,
  ExternalLink,
  Info,
  Loader2,
  Sliders,
  Check,
  Cloud,
  CheckCircle,
} from "lucide-react";
import type { ContractFieldConfig, ContractFieldType } from "@/lib/contract-fields";

type Template = {
  id: string;
  title: string;
  google_doc_id: string;
  google_doc_url: string | null;
  fields: string[];
  field_config: ContractFieldConfig;
  created_at: string;
};

export default function ContractTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const [title, setTitle] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [conn, setConn] = useState<{ connected: boolean; email: string | null } | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/contract-templates")
      .then((res) => (res.status === 403 ? { forbidden: true } : res.json()))
      .then((d) => {
        if (cancelled) return;
        if (d.forbidden) setForbidden(true);
        else setTemplates(d.templates ?? []);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });

    // Google connection status + any connect-flow result flagged in the URL.
    fetch("/api/contracts-google/status")
      .then((r) => (r.ok ? r.json() : { connected: false }))
      .then((d) => {
        if (cancelled) return;
        setConn({ connected: !!d.connected, email: d.email ?? null });
        const p = new URLSearchParams(window.location.search);
        if (p.get("google_connected")) setNotice({ kind: "ok", msg: "Google account connected." });
        else if (p.get("google_error")) setNotice({ kind: "err", msg: `Couldn't connect Google: ${p.get("google_error")}` });
      })
      .catch(() => { if (!cancelled) setConn({ connected: false, email: null }); });
    return () => { cancelled = true; };
  }, []);

  const disconnectGoogle = async () => {
    await fetch("/api/contracts-google/disconnect", { method: "POST" });
    setConn({ connected: false, email: null });
    setNotice(null);
  };

  const addTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setAdding(true);
    try {
      const res = await fetch("/api/contract-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), docUrl: docUrl.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Couldn't add template");
      setTemplates((prev) => [d, ...prev]);
      setTitle("");
      setDocUrl("");
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Couldn't add template");
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#223149] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="bg-white rounded-2xl p-12 shadow-sm text-center">
        <p className="text-[#50676E] font-medium">Contract templates are available to admins only.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/contracts"
          className="inline-flex items-center gap-1.5 text-sm text-[#50676E] hover:text-[#223149] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to contracts
        </Link>
        <h1 className="text-3xl font-bold text-[#223149] mt-2">Contract templates</h1>
        <p className="text-[#50676E] mt-1 text-sm">
          Register a Google Doc with <span className="font-mono text-xs">{"{{merge fields}}"}</span> so you can
          generate per-employee contracts from it.
        </p>
      </div>

      {/* Authoring guidance */}
      <div className="bg-[#223149]/5 rounded-2xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-[#223149] flex-shrink-0 mt-0.5" />
        <div className="text-sm text-[#50676E] space-y-1">
          <p>
            Use a <span className="font-medium text-[#223149]">Google Doc</span> (if it&apos;s a Word file, open it
            and choose <span className="font-medium text-[#223149]">File → Save as Google Docs</span> first). Write
            each blank as <span className="font-mono text-xs text-[#223149]">{"{{field_name}}"}</span> in plain text
            — e.g. <span className="font-mono text-xs text-[#223149]">{"{{employee_name}}"}</span>,{" "}
            <span className="font-mono text-xs text-[#223149]">{"{{salary}}"}</span>. Give each blank a unique name
            (don&apos;t reuse one name for two different values), and make sure the Doc is shared with you.
          </p>
          <p>
            After adding a template, use <span className="font-medium text-[#223149]">Configure fields</span> to set
            which are dropdowns or dates. Fields named{" "}
            <span className="font-mono text-xs text-[#223149]">employee_name</span>,
            <span className="font-mono text-xs text-[#223149]"> position</span>,
            <span className="font-mono text-xs text-[#223149]"> department</span>,
            <span className="font-mono text-xs text-[#223149]"> email</span> are pre-filled from staff records.
          </p>
        </div>
      </div>

      {/* Connect-flow result */}
      {notice && (
        <div className={`rounded-2xl p-4 text-sm ${notice.kind === "ok" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {notice.msg}
        </div>
      )}

      {/* Google connection */}
      <div className="bg-white rounded-2xl shadow-sm p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${conn?.connected ? "bg-emerald-50" : "bg-[#223149]/5"}`}>
            {conn?.connected ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <Cloud className="w-5 h-5 text-[#223149]" />}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-[#223149]">Google account for contracts</p>
            {conn?.connected ? (
              <p className="text-sm text-[#50676E] mt-0.5">
                Connected as <span className="font-medium text-[#223149]">{conn.email ?? "—"}</span>. Templates and
                generated contracts live in this account — no per-person sharing needed.
              </p>
            ) : (
              <p className="text-sm text-[#50676E] mt-0.5">
                Connect the account that holds your templates (e.g. hrapp@fgam.org.au). Every admin generates through
                it, and the app shares each generated contract with whoever made it.
              </p>
            )}
          </div>
        </div>
        {conn?.connected ? (
          <button
            onClick={disconnectGoogle}
            className="flex-shrink-0 px-4 py-2.5 border border-[#ECE3DF] text-[#50676E] rounded-xl text-sm font-semibold hover:bg-[#F8F6F4] transition-colors"
          >
            Disconnect
          </button>
        ) : (
          <a
            href="/api/contracts-google/connect"
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors"
          >
            <Cloud className="w-4 h-4" />
            Connect Google
          </a>
        )}
      </div>

      {/* Add template */}
      <form onSubmit={addTemplate} className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
        <p className="font-semibold text-[#223149]">Add a template</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="name" className="block text-sm font-semibold text-[#223149] mb-1.5">
              Name <span className="text-red-400">*</span>
            </label>
            <input id="name"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g. Full-time employment agreement"
              className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#6E8189] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
            />
          </div>
          <div>
            <label htmlFor="google-doc-link" className="block text-sm font-semibold text-[#223149] mb-1.5">
              Google Doc link <span className="text-red-400">*</span>
            </label>
            <input id="google-doc-link"
              type="text"
              value={docUrl}
              onChange={(e) => setDocUrl(e.target.value)}
              required
              placeholder="https://docs.google.com/document/d/…"
              className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#6E8189] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
            />
          </div>
        </div>
        {addError && <p className="text-sm text-red-500">{addError}</p>}
        {conn && !conn.connected && (
          <p className="text-sm text-amber-600">Connect a Google account above before adding a template.</p>
        )}
        <button
          type="submit"
          disabled={adding || !title.trim() || !docUrl.trim() || !conn?.connected}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {adding ? "Detecting fields…" : "Add template"}
        </button>
      </form>

      {/* Template list */}
      {templates.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 shadow-sm text-center">
          <FileText className="w-10 h-10 text-[#50676E] mx-auto mb-3" />
          <p className="text-[#50676E] font-medium">No templates yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <TemplateRow
              key={t.id}
              template={t}
              onUpdated={(u) => setTemplates((prev) => prev.map((x) => (x.id === u.id ? u : x)))}
              onRemoved={(id) => setTemplates((prev) => prev.filter((x) => x.id !== id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type DraftField = { label: string; type: ContractFieldType; optionsText: string; description: string; example: string };

function TemplateRow({
  template,
  onUpdated,
  onRemoved,
}: {
  template: Template;
  onUpdated: (t: Template) => void;
  onRemoved: (id: string) => void;
}) {
  const [configuring, setConfiguring] = useState(false);
  const [draft, setDraft] = useState<Record<string, DraftField>>({});
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<"rescan" | "delete" | null>(null);

  const openConfig = () => {
    const d: Record<string, DraftField> = {};
    for (const f of template.fields) {
      const c = template.field_config?.[f];
      d[f] = {
        label: c?.label ?? "",
        type: c?.type ?? "text",
        optionsText: (c?.options ?? []).join(", "),
        description: c?.description ?? "",
        example: c?.example ?? "",
      };
    }
    setDraft(d);
    setConfiguring(true);
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const field_config: ContractFieldConfig = {};
      for (const f of template.fields) {
        const d = draft[f] ?? { label: "", type: "text", optionsText: "", description: "", example: "" };
        const setting: ContractFieldConfig[string] = { type: d.type };
        if (d.label.trim()) setting.label = d.label.trim();
        if (d.description.trim()) setting.description = d.description.trim();
        if (d.example.trim()) setting.example = d.example.trim();
        if (d.type === "select") {
          const options = d.optionsText.split(",").map((o) => o.trim()).filter(Boolean);
          if (options.length) setting.options = options;
        }
        field_config[f] = setting;
      }
      const res = await fetch(`/api/contract-templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field_config }),
      });
      const updated = await res.json();
      if (res.ok) {
        onUpdated(updated);
        setConfiguring(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const rescan = async () => {
    setBusy("rescan");
    try {
      const res = await fetch(`/api/contract-templates/${template.id}`, { method: "PATCH" });
      const d = await res.json();
      if (res.ok) onUpdated(d);
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy("delete");
    try {
      const res = await fetch(`/api/contract-templates/${template.id}`, { method: "DELETE" });
      if (res.ok) onRemoved(template.id);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-semibold text-[#223149]">{template.title}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {template.fields.length === 0 ? (
              <span className="text-xs text-amber-600">
                No {"{{fields}}"} detected — check the Doc, then re-scan.
              </span>
            ) : (
              template.fields.map((f) => (
                <span
                  key={f}
                  className="text-xs font-mono bg-[#F8F6F4] border border-[#ECE3DF] text-[#50676E] rounded-full px-2 py-0.5"
                >
                  {f}
                </span>
              ))
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {template.fields.length > 0 && (
            <button
              onClick={() => (configuring ? setConfiguring(false) : openConfig())}
              title="Configure fields"
              className={`p-2 rounded-xl transition-colors ${configuring ? "bg-[#223149]/10 text-[#223149]" : "text-[#50676E] hover:bg-[#F8F6F4]"}`}
            >
              <Sliders className="w-4 h-4" />
            </button>
          )}
          {template.google_doc_url && (
            <a
              href={template.google_doc_url}
              target="_blank"
              rel="noopener noreferrer"
              title="Open in Google Docs"
              className="p-2 rounded-xl text-[#50676E] hover:bg-[#F8F6F4] transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
          <button
            onClick={rescan}
            disabled={busy !== null}
            title="Re-scan fields"
            className="p-2 rounded-xl text-[#50676E] hover:bg-[#F8F6F4] transition-colors disabled:opacity-50"
          >
            {busy === "rescan" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </button>
          <button
            onClick={remove}
            disabled={busy !== null}
            title="Delete template"
            className="p-2 rounded-xl text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Field config editor */}
      {configuring && (
        <div className="mt-4 border-t border-[#ECE3DF] pt-4 space-y-2">
          <p className="text-xs font-semibold text-[#50676E] uppercase tracking-wide">Configure fields</p>
          {template.fields.map((f) => {
            const d = draft[f] ?? { label: "", type: "text" as ContractFieldType, optionsText: "" };
            return (
              <div key={f} className="grid grid-cols-1 sm:grid-cols-[auto_1fr_auto] gap-2 items-center">
                <span className="font-mono text-xs text-[#223149] bg-[#F8F6F4] border border-[#ECE3DF] rounded-lg px-2 py-1.5 truncate">{f}</span>
                <input
                  type="text"
                  value={d.label}
                  onChange={(e) => setDraft((p) => ({ ...p, [f]: { ...d, label: e.target.value } }))}
                  placeholder="Label (optional)"
                  className="px-3 py-1.5 rounded-lg border border-[#ECE3DF] text-sm text-[#223149] placeholder:text-[#6E8189] focus:outline-none focus:ring-2 focus:ring-[#223149]/20"
                />
                <select
                  value={d.type}
                  onChange={(e) => setDraft((p) => ({ ...p, [f]: { ...d, type: e.target.value as ContractFieldType } }))}
                  className="px-3 py-1.5 rounded-lg border border-[#ECE3DF] text-sm text-[#223149] bg-white focus:outline-none focus:ring-2 focus:ring-[#223149]/20"
                >
                  <option value="text">Text</option>
                  <option value="date">Date</option>
                  <option value="select">Dropdown</option>
                </select>
                {d.type === "select" && (
                  <input
                    type="text"
                    value={d.optionsText}
                    onChange={(e) => setDraft((p) => ({ ...p, [f]: { ...d, optionsText: e.target.value } }))}
                    placeholder="Options, comma-separated — e.g. Full-time, Part-time, Casual"
                    className="sm:col-span-3 px-3 py-1.5 rounded-lg border border-[#ECE3DF] text-sm text-[#223149] placeholder:text-[#6E8189] focus:outline-none focus:ring-2 focus:ring-[#223149]/20"
                  />
                )}
                <input
                  type="text"
                  value={d.description}
                  onChange={(e) => setDraft((p) => ({ ...p, [f]: { ...d, description: e.target.value } }))}
                  placeholder="Help text shown under this field (optional)"
                  className="sm:col-span-3 px-3 py-1.5 rounded-lg border border-[#ECE3DF] text-sm text-[#223149] placeholder:text-[#6E8189] focus:outline-none focus:ring-2 focus:ring-[#223149]/20"
                />
                <input
                  type="text"
                  value={d.example}
                  onChange={(e) => setDraft((p) => ({ ...p, [f]: { ...d, example: e.target.value } }))}
                  placeholder="Example shown inside the box (optional) — e.g. 80000"
                  className="sm:col-span-3 px-3 py-1.5 rounded-lg border border-[#ECE3DF] text-sm text-[#223149] placeholder:text-[#6E8189] focus:outline-none focus:ring-2 focus:ring-[#223149]/20"
                />
              </div>
            );
          })}
          <div className="flex gap-2 pt-1">
            <button
              onClick={saveConfig}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save fields
            </button>
            <button
              onClick={() => setConfiguring(false)}
              className="px-4 py-2 border border-[#ECE3DF] text-[#50676E] rounded-xl text-sm font-semibold hover:bg-[#F8F6F4] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
