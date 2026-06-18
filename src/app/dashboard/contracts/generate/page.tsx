"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Wand2,
  Plus,
  Search,
  X,
  Loader2,
  ExternalLink,
  Download,
  Send,
  CheckCircle,
  FileText,
} from "lucide-react";
import {
  fieldSetting,
  fieldLabel,
  formatFieldValue,
  prefillKeyFor,
  type ContractFieldConfig,
} from "@/lib/contract-fields";
import { markEdited, markSent, type DraftRowStatus } from "@/lib/contract-draft-status";

type Template = { id: string; title: string; fields: string[]; field_config: ContractFieldConfig };
type Staff = { id: string; full_name: string; email: string; position: string | null; department: string | null; avatar_url: string | null; is_active: boolean };

// A persisted roster row. `status` is derived server-side and transitioned
// locally on edit/send so the badge updates without a round-trip.
type Row = {
  id: string;
  staff_id: string | null;
  recipient_name: string;
  values: Record<string, string>;
  status: DraftRowStatus;
  generated_contract_id: string | null;
  google_doc_url: string | null;
  contract_id: string | null;
};

// A generated copy, returned by the generate endpoint and by recent batches.
type GenRow = {
  id: string;
  recipient_name: string;
  staff_id: string | null;
  google_doc_url: string | null;
  contract_id: string | null;
  draft_row_id?: string | null;
};

type Batch = { batch_id: string; batch_label: string | null; created_at: string; items: GenRow[] };

// The minimal shape the per-row actions (open / download / send) need.
type ActionTarget = { genId: string; recipient_name: string; staff_id: string | null; google_doc_url: string | null; contract_id: string | null };

const STATUS_BADGE: Record<DraftRowStatus, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-[#F8F6F4] text-[#5F7C84] border-[#ECE3DF]" },
  generated: { label: "Generated", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  generated_changed: { label: "Edited · regenerate", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  sent: { label: "Sent", cls: "bg-green-50 text-green-700 border-green-200" },
  sent_changed: { label: "Sent · changed", cls: "bg-amber-50 text-amber-700 border-amber-200" },
};

// Pre-fill from staff: map common field names to known staff columns.
function prefillFor(staff: Staff, fields: string[]): Record<string, string> {
  const v: Record<string, string> = {};
  for (const f of fields) {
    const key = prefillKeyFor(f);
    v[f] = key ? (staff[key] ?? "") : "";
  }
  return v;
}

export default function GenerateContractsPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const [templateId, setTemplateId] = useState("");
  const [batchLabel, setBatchLabel] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [staffSearch, setStaffSearch] = useState("");
  const [showStaffPicker, setShowStaffPicker] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const [batches, setBatches] = useState<Batch[]>([]);
  const [busy, setBusy] = useState<Record<string, "download" | "send">>({});
  const [sentMap, setSentMap] = useState<Record<string, string>>({}); // genId -> contractId
  const [rowError, setRowError] = useState<string | null>(null);

  // Autosave plumbing: debounce timers + in-flight saves per row id.
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const inFlight = useRef<Map<string, Promise<unknown>>>(new Map());
  const rowsRef = useRef<Row[]>([]);
  const [savingCount, setSavingCount] = useState(0);
  const [everSaved, setEverSaved] = useState(false);

  useEffect(() => { rowsRef.current = rows; }, [rows]);

  const template = useMemo(() => templates.find((t) => t.id === templateId) ?? null, [templates, templateId]);
  const fields = template?.fields ?? [];

  // Initial load: templates, staff, recent batches.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/contract-templates").then(async (r) => {
        if (r.status === 403) { if (!cancelled) setForbidden(true); return { templates: [] }; }
        return r.json();
      }),
      fetch("/api/staff").then((r) => r.json()),
    ])
      .then(([t, s]) => {
        if (cancelled) return;
        setTemplates(t.templates ?? []);
        setStaff(Array.isArray(s) ? s.filter((x: Staff) => x.is_active) : []);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    fetch("/api/generated-contracts")
      .then((r) => (r.ok ? r.json() : { batches: [] }))
      .then((d) => { if (!cancelled) setBatches(d.batches ?? []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Load the persisted roster whenever the template changes. Synchronous
  // resets live in onTemplateChange (an event handler), not here, so the
  // effect only does the async fetch — avoiding cascading renders.
  useEffect(() => {
    if (!templateId) return;
    let cancelled = false;
    fetch(`/api/contract-templates/${templateId}/draft-rows`)
      .then((r) => (r.ok ? r.json() : { rows: [] }))
      .then((d) => { if (!cancelled) setRows(d.rows ?? []); })
      .catch(() => { if (!cancelled) setRows([]); })
      .finally(() => { if (!cancelled) setRowsLoading(false); });
    return () => { cancelled = true; };
  }, [templateId]);

  // Switching template clears the grid and selection; the effect above then
  // loads the new template's saved roster.
  const onTemplateChange = (id: string) => {
    setTemplateId(id);
    setRows([]);
    setSelected(new Set());
    setGenError(null);
    setRowsLoading(!!id);
  };

  // Clear any pending timers on unmount.
  useEffect(() => {
    const timers = saveTimers.current;
    return () => { timers.forEach((t) => clearTimeout(t)); timers.clear(); };
  }, []);

  const loadBatches = () => {
    fetch("/api/generated-contracts")
      .then((r) => (r.ok ? r.json() : { batches: [] }))
      .then((d) => setBatches(d.batches ?? []))
      .catch(() => {});
  };

  // --- autosave ---------------------------------------------------------
  const doSave = (id: string): Promise<unknown> => {
    const row = rowsRef.current.find((r) => r.id === id);
    if (!row) return Promise.resolve();
    setSavingCount((c) => c + 1);
    const p = fetch(`/api/contract-draft-rows/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient_name: row.recipient_name, staff_id: row.staff_id, values: row.values }),
    })
      .then(() => setEverSaved(true))
      .catch(() => {})
      .finally(() => {
        setSavingCount((c) => Math.max(0, c - 1));
        if (inFlight.current.get(id) === p) inFlight.current.delete(id);
      });
    inFlight.current.set(id, p);
    return p;
  };

  const scheduleSave = (id: string) => {
    const timers = saveTimers.current;
    const existing = timers.get(id);
    if (existing) clearTimeout(existing);
    timers.set(id, setTimeout(() => { timers.delete(id); void doSave(id); }, 700));
  };

  // Flush every pending edit (debounced + in-flight) and wait for it. Called
  // before generating so the stored values match what we generate.
  const flushAll = async () => {
    const timers = saveTimers.current;
    Array.from(timers.keys()).forEach((id) => {
      const t = timers.get(id);
      if (t) clearTimeout(t);
      timers.delete(id);
      void doSave(id);
    });
    await Promise.all(Array.from(inFlight.current.values()));
  };

  // --- row edits --------------------------------------------------------
  const setRecipient = (id: string, name: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, recipient_name: name, status: markEdited(r.status) } : r)));
    scheduleSave(id);
  };
  const setValue = (id: string, field: string, value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, values: { ...r.values, [field]: value }, status: markEdited(r.status) } : r))
    );
    scheduleSave(id);
  };

  const addStaffRow = async (s: Staff) => {
    if (rows.some((r) => r.staff_id === s.id)) return;
    const res = await fetch(`/api/contract-templates/${templateId}/draft-rows`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staff_id: s.id, recipient_name: s.full_name, values: prefillFor(s, fields) }),
    });
    const d = await res.json();
    if (res.ok && d.row) setRows((prev) => [...prev, d.row]);
  };

  const addBlankRow = async () => {
    const values: Record<string, string> = {};
    for (const f of fields) values[f] = "";
    const res = await fetch(`/api/contract-templates/${templateId}/draft-rows`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    });
    const d = await res.json();
    if (res.ok && d.row) setRows((prev) => [...prev, d.row]);
  };

  const removeRow = async (id: string) => {
    const timer = saveTimers.current.get(id);
    if (timer) { clearTimeout(timer); saveTimers.current.delete(id); }
    setRows((prev) => prev.filter((r) => r.id !== id));
    setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
    await fetch(`/api/contract-draft-rows/${id}`, { method: "DELETE" }).catch(() => {});
  };

  // --- selection --------------------------------------------------------
  const toggleRow = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  const selectedRows = rows.filter((r) => selected.has(r.id));

  // --- generate ---------------------------------------------------------
  const generate = async () => {
    setGenError(null);
    setRowError(null);
    const chosen = selectedRows.filter((r) => r.recipient_name.trim());
    if (chosen.length === 0) {
      setGenError("Tick at least one person (with a name) to generate.");
      return;
    }
    setGenerating(true);
    try {
      await flushAll(); // persist edits so the stored values match what we generate
      const res = await fetch(`/api/contract-templates/${templateId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchLabel: batchLabel.trim() || undefined,
          rows: chosen.map((r) => ({
            draft_row_id: r.id,
            staff_id: r.staff_id,
            recipient_name: r.recipient_name.trim(),
            values: Object.fromEntries(
              fields.map((f) => [f, formatFieldValue(r.values[f] ?? "", fieldSetting(template?.field_config, f).type)])
            ),
          })),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Generation failed");

      // Update the generated rows in place (keeps unsaved edits on other rows).
      const byDraftId = new Map<string, GenRow>();
      for (const g of (d.generated ?? []) as GenRow[]) if (g.draft_row_id) byDraftId.set(g.draft_row_id, g);
      setRows((prev) =>
        prev.map((r) => {
          const g = byDraftId.get(r.id);
          if (!g) return r;
          return {
            ...r,
            status: "generated" as DraftRowStatus,
            generated_contract_id: g.id,
            google_doc_url: g.google_doc_url,
            contract_id: g.contract_id ?? null,
          };
        })
      );
      setSelected(new Set());
      if ((d.failed ?? []).length > 0) {
        setGenError(`${d.failed.length} couldn't be generated: ${d.failed.map((f: { recipient_name: string }) => f.recipient_name).join(", ")}`);
      }
      loadBatches();
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  // --- per-row actions --------------------------------------------------
  const downloadPdf = async (genId: string, name: string) => {
    setRowError(null);
    setBusy((b) => ({ ...b, [genId]: "download" }));
    try {
      const res = await fetch(`/api/generated-contracts/${genId}/pdf`);
      if (!res.ok) throw new Error("Couldn't export the PDF.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(name || "contract").replace(/[^a-zA-Z0-9.-]/g, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setBusy((b) => { const c = { ...b }; delete c[genId]; return c; });
    }
  };

  const sendForSign = async (genId: string, onSent?: (contractId: string) => void) => {
    setRowError(null);
    setBusy((b) => ({ ...b, [genId]: "send" }));
    try {
      const res = await fetch(`/api/generated-contracts/${genId}/send`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Couldn't send for signing.");
      setSentMap((s) => ({ ...s, [genId]: d.contract_id }));
      onSent?.(d.contract_id);
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Couldn't send for signing.");
    } finally {
      setBusy((b) => { const c = { ...b }; delete c[genId]; return c; });
    }
  };

  const renderActions = (t: ActionTarget, onSent?: (contractId: string) => void) => {
    const contractId = t.contract_id ?? sentMap[t.genId];
    return (
      <div className="flex items-center gap-1 flex-shrink-0">
        {t.google_doc_url && (
          <a
            href={t.google_doc_url}
            target="_blank"
            rel="noopener noreferrer"
            title="Open & edit in Google Docs"
            className="p-2 rounded-xl text-[#5F7C84] hover:bg-[#F8F6F4] transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
        <button
          onClick={() => downloadPdf(t.genId, t.recipient_name)}
          disabled={!!busy[t.genId]}
          title="Download PDF"
          className="p-2 rounded-xl text-[#5F7C84] hover:bg-[#F8F6F4] transition-colors disabled:opacity-50"
        >
          {busy[t.genId] === "download" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        </button>
        {contractId ? (
          <Link
            href={`/dashboard/contracts/${contractId}`}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Sent
          </Link>
        ) : t.staff_id ? (
          <button
            onClick={() => sendForSign(t.genId, onSent)}
            disabled={!!busy[t.genId]}
            title="Send to the employee for e-signature"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#223149] text-white hover:bg-[#1a2638] transition-colors disabled:opacity-50"
          >
            {busy[t.genId] === "send" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Send for signing
          </button>
        ) : (
          <span className="text-xs text-[#9BADB7] px-2" title="Link this person to a staff member to enable signing">
            Not linked
          </span>
        )}
      </div>
    );
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
        <p className="text-[#5F7C84] font-medium">Contract generation is available to admins only.</p>
      </div>
    );
  }

  const filteredStaff = staff.filter(
    (s) =>
      s.full_name.toLowerCase().includes(staffSearch.toLowerCase()) ||
      s.email.toLowerCase().includes(staffSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/contracts"
          className="inline-flex items-center gap-1.5 text-sm text-[#5F7C84] hover:text-[#223149] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to contracts
        </Link>
        <h1 className="text-3xl font-bold text-[#223149] mt-2">Generate contracts</h1>
        <p className="text-[#5F7C84] mt-1 text-sm">
          Build a roster of employees and their details, tick who&apos;s ready, then generate &amp; send. Your list is
          saved automatically.
        </p>
      </div>

      {templates.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 shadow-sm text-center">
          <FileText className="w-10 h-10 text-[#9BADB7] mx-auto mb-3" />
          <p className="text-[#5F7C84] font-medium">No templates yet</p>
          <Link href="/dashboard/contracts/templates" className="text-sm text-[#223149] underline mt-1 inline-block">
            Add a contract template first
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
          {/* Template + batch label */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-[#223149] mb-1.5">Template</label>
              <select
                value={templateId}
                onChange={(e) => onTemplateChange(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] bg-white focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
              >
                <option value="">Choose a template…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#223149] mb-1.5">
                Batch name <span className="ml-1 text-xs font-normal text-[#9BADB7]">(optional)</span>
              </label>
              <input
                type="text"
                value={batchLabel}
                onChange={(e) => setBatchLabel(e.target.value)}
                placeholder="e.g. June 2026 new starters"
                className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
              />
            </div>
          </div>

          {template && fields.length === 0 && (
            <p className="text-sm text-amber-600">
              This template has no {"{{fields}}"} detected. Open it on the{" "}
              <Link href="/dashboard/contracts/templates" className="underline">Templates</Link> page and re-scan.
            </p>
          )}

          {template && fields.length > 0 && (
            <>
              {/* Add employees */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowStaffPicker((v) => !v)}
                    className="flex items-center gap-2 px-4 py-2.5 border border-[#ECE3DF] text-[#223149] rounded-xl text-sm font-semibold hover:bg-[#F8F6F4] transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add employees
                  </button>
                  {showStaffPicker && (
                    <div className="absolute z-10 mt-2 w-72 bg-white rounded-xl border border-[#ECE3DF] shadow-lg overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#ECE3DF]">
                        <Search className="w-3.5 h-3.5 text-[#9BADB7] flex-shrink-0" />
                        <input
                          autoFocus
                          value={staffSearch}
                          onChange={(e) => setStaffSearch(e.target.value)}
                          placeholder="Search staff…"
                          className="flex-1 text-sm text-[#223149] placeholder:text-[#9BADB7] focus:outline-none bg-transparent"
                        />
                      </div>
                      <div className="max-h-56 overflow-y-auto divide-y divide-[#F8F6F4]">
                        {filteredStaff.map((s) => {
                          const added = rows.some((r) => r.staff_id === s.id);
                          return (
                            <button
                              key={s.id}
                              type="button"
                              disabled={added}
                              onClick={() => addStaffRow(s)}
                              className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors ${added ? "opacity-50" : "hover:bg-[#F8F6F4]"}`}
                            >
                              <span className="text-sm font-medium text-[#223149] truncate">{s.full_name}</span>
                              {added && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />}
                            </button>
                          );
                        })}
                        {filteredStaff.length === 0 && (
                          <p className="text-sm text-[#9BADB7] px-3 py-3">No staff found.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={addBlankRow}
                  className="px-4 py-2.5 border border-[#ECE3DF] text-[#5F7C84] rounded-xl text-sm font-semibold hover:bg-[#F8F6F4] transition-colors"
                >
                  Add blank row
                </button>
                <span className="ml-auto text-xs text-[#9BADB7]">
                  {savingCount > 0 ? "Saving…" : everSaved ? "All changes saved" : ""}
                </span>
              </div>

              {/* Grid */}
              {rowsLoading ? (
                <div className="flex items-center gap-2 text-sm text-[#9BADB7] py-6">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading your list…
                </div>
              ) : rows.length === 0 ? (
                <p className="text-sm text-[#9BADB7] py-6">No one on this list yet — add employees above.</p>
              ) : (
                <div className="border border-[#ECE3DF] rounded-xl overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#F8F6F4] text-left">
                        <th className="px-3 py-2 w-10">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={toggleAll}
                            className="w-4 h-4 rounded border-[#ECE3DF] text-[#223149] focus:ring-[#223149]/20"
                            title="Select all"
                          />
                        </th>
                        <th className="px-3 py-2 font-semibold text-[#223149] whitespace-nowrap">Employee</th>
                        {fields.map((f) => {
                          const s = fieldSetting(template?.field_config, f);
                          return (
                            <th key={f} className="px-3 py-2 align-bottom text-[#5F7C84]">
                              <div className="font-semibold text-xs">{fieldLabel(template?.field_config, f)}</div>
                              {s.description && (
                                <div className="text-[11px] font-normal text-[#9BADB7] whitespace-normal max-w-[11rem] mt-0.5">
                                  {s.description}
                                </div>
                              )}
                            </th>
                          );
                        })}
                        <th className="px-3 py-2 font-semibold text-[#223149]">Status</th>
                        <th className="px-3 py-2" />
                        <th className="px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#ECE3DF]">
                      {rows.map((r) => {
                        const badge = STATUS_BADGE[r.status];
                        return (
                          <tr key={r.id} className={selected.has(r.id) ? "bg-[#F8F6F4]/60" : ""}>
                            <td className="px-3 py-2 align-top">
                              <input
                                type="checkbox"
                                checked={selected.has(r.id)}
                                onChange={() => toggleRow(r.id)}
                                className="w-4 h-4 mt-1.5 rounded border-[#ECE3DF] text-[#223149] focus:ring-[#223149]/20"
                              />
                            </td>
                            <td className="px-3 py-2 align-top">
                              <input
                                value={r.recipient_name}
                                onChange={(e) => setRecipient(r.id, e.target.value)}
                                placeholder="Full name"
                                className="w-40 px-2 py-1.5 rounded-lg border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20"
                              />
                            </td>
                            {fields.map((f) => {
                              const setting = fieldSetting(template?.field_config, f);
                              const cls = "w-40 px-2 py-1.5 rounded-lg border border-[#ECE3DF] text-[#223149] bg-white focus:outline-none focus:ring-2 focus:ring-[#223149]/20";
                              return (
                                <td key={f} className="px-3 py-2 align-top">
                                  {setting.type === "select" ? (
                                    <select value={r.values[f] ?? ""} onChange={(e) => setValue(r.id, f, e.target.value)} className={cls}>
                                      <option value="">—</option>
                                      {(setting.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                  ) : setting.type === "date" ? (
                                    <input type="date" value={r.values[f] ?? ""} onChange={(e) => setValue(r.id, f, e.target.value)} className={cls} />
                                  ) : (
                                    <input value={r.values[f] ?? ""} onChange={(e) => setValue(r.id, f, e.target.value)} placeholder={setting.example ?? ""} className={`${cls} placeholder:text-[#9BADB7]`} />
                                  )}
                                </td>
                              );
                            })}
                            <td className="px-3 py-2 align-top">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${badge.cls}`}>
                                {badge.label}
                              </span>
                            </td>
                            <td className="px-3 py-2 align-top">
                              {r.generated_contract_id &&
                                renderActions(
                                  {
                                    genId: r.generated_contract_id,
                                    recipient_name: r.recipient_name,
                                    staff_id: r.staff_id,
                                    google_doc_url: r.google_doc_url,
                                    contract_id: r.contract_id,
                                  },
                                  (contractId) =>
                                    setRows((prev) =>
                                      prev.map((x) => (x.id === r.id ? { ...x, contract_id: contractId, status: markSent(x.status) } : x))
                                    )
                                )}
                            </td>
                            <td className="px-2 py-2 align-top">
                              <button
                                onClick={() => removeRow(r.id)}
                                title="Remove from list"
                                className="p-1.5 rounded-lg text-[#9BADB7] hover:bg-[#F8F6F4] hover:text-red-500 transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {genError && <p className="text-sm text-red-500">{genError}</p>}
              {rowError && <p className="text-sm text-red-500">{rowError}</p>}

              <button
                onClick={generate}
                disabled={generating || selectedRows.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                {generating
                  ? "Generating…"
                  : `Generate ${selectedRows.length || ""} selected contract${selectedRows.length === 1 ? "" : "s"}`}
              </button>
            </>
          )}
        </div>
      )}

      {/* Recent batches (historical log across templates) */}
      {batches.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-[#9BADB7] uppercase tracking-wide mb-3">Recent batches</h2>
          <div className="space-y-3">
            {batches.map((b) => (
              <div key={b.batch_id} className="bg-white rounded-2xl shadow-sm p-5">
                <p className="font-semibold text-[#223149]">{b.batch_label ?? "Batch"}</p>
                <div className="divide-y divide-[#ECE3DF] mt-2">
                  {b.items.map((row) => (
                    <div key={row.id} className="flex items-center justify-between gap-4 py-2.5">
                      <span className="text-sm font-medium text-[#223149] truncate">{row.recipient_name}</span>
                      {renderActions({
                        genId: row.id,
                        recipient_name: row.recipient_name,
                        staff_id: row.staff_id,
                        google_doc_url: row.google_doc_url,
                        contract_id: row.contract_id,
                      })}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
