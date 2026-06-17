"use client";

import { useEffect, useMemo, useState } from "react";
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

type Template = { id: string; title: string; fields: string[]; field_config: ContractFieldConfig };
type Staff = { id: string; full_name: string; email: string; position: string | null; department: string | null; avatar_url: string | null; is_active: boolean };

type Row = {
  key: string;
  staff_id: string | null;
  recipient_name: string;
  values: Record<string, string>;
};

type GenRow = {
  id: string;
  recipient_name: string;
  staff_id: string | null;
  google_doc_url: string | null;
  contract_id: string | null;
};

type Batch = { batch_id: string; batch_label: string | null; created_at: string; items: GenRow[] };

// Pre-fill from staff: map common field names to known staff columns.
function prefillFor(staff: Staff, fields: string[]): Record<string, string> {
  const v: Record<string, string> = {};
  for (const f of fields) {
    const key = prefillKeyFor(f);
    v[f] = key ? (staff[key] ?? "") : "";
  }
  return v;
}

let rowSeq = 0;

export default function GenerateContractsPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const [templateId, setTemplateId] = useState("");
  const [batchLabel, setBatchLabel] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [staffSearch, setStaffSearch] = useState("");
  const [showStaffPicker, setShowStaffPicker] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [result, setResult] = useState<{ generated: GenRow[]; failed: { recipient_name: string; error: string }[] } | null>(null);

  const [batches, setBatches] = useState<Batch[]>([]);
  const [busy, setBusy] = useState<Record<string, "download" | "send">>({});
  const [sent, setSent] = useState<Record<string, string>>({}); // genId -> contractId
  const [rowError, setRowError] = useState<string | null>(null);

  const template = useMemo(() => templates.find((t) => t.id === templateId) ?? null, [templates, templateId]);
  const fields = template?.fields ?? [];

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
    // Load recent batches inline (kept out of loadBatches so the effect calls
    // no setState-bearing function directly).
    fetch("/api/generated-contracts")
      .then((r) => (r.ok ? r.json() : { batches: [] }))
      .then((d) => { if (!cancelled) setBatches(d.batches ?? []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const loadBatches = () => {
    fetch("/api/generated-contracts")
      .then((r) => (r.ok ? r.json() : { batches: [] }))
      .then((d) => setBatches(d.batches ?? []))
      .catch(() => {});
  };

  // Switching template resets the grid (fields differ).
  const onTemplateChange = (id: string) => {
    setTemplateId(id);
    setRows([]);
    setResult(null);
    setGenError(null);
  };

  const addStaffRow = (s: Staff) => {
    if (rows.some((r) => r.staff_id === s.id)) return;
    setRows((prev) => [
      ...prev,
      { key: `r${rowSeq++}`, staff_id: s.id, recipient_name: s.full_name, values: prefillFor(s, fields) },
    ]);
  };

  const addBlankRow = () => {
    const v: Record<string, string> = {};
    for (const f of fields) v[f] = "";
    setRows((prev) => [...prev, { key: `r${rowSeq++}`, staff_id: null, recipient_name: "", values: v }]);
  };

  const removeRow = (key: string) => setRows((prev) => prev.filter((r) => r.key !== key));
  const setRecipient = (key: string, name: string) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, recipient_name: name } : r)));
  const setValue = (key: string, field: string, value: string) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, values: { ...r.values, [field]: value } } : r)));

  const generate = async () => {
    setGenError(null);
    setResult(null);
    const valid = rows.filter((r) => r.recipient_name.trim());
    if (valid.length === 0) {
      setGenError("Add at least one employee with a name.");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch(`/api/contract-templates/${templateId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchLabel: batchLabel.trim() || undefined,
          rows: valid.map((r) => ({
            staff_id: r.staff_id,
            recipient_name: r.recipient_name.trim(),
            // Format each value for the doc (e.g. a date field → DD/MM/YYYY).
            values: Object.fromEntries(
              fields.map((f) => [f, formatFieldValue(r.values[f] ?? "", fieldSetting(template?.field_config, f).type)])
            ),
          })),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Generation failed");
      setResult({ generated: d.generated ?? [], failed: d.failed ?? [] });
      setRows([]);
      loadBatches();
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const downloadPdf = async (row: GenRow) => {
    setRowError(null);
    setBusy((b) => ({ ...b, [row.id]: "download" }));
    try {
      const res = await fetch(`/api/generated-contracts/${row.id}/pdf`);
      if (!res.ok) throw new Error("Couldn't export the PDF.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(row.recipient_name || "contract").replace(/[^a-zA-Z0-9.-]/g, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setBusy((b) => { const c = { ...b }; delete c[row.id]; return c; });
    }
  };

  const sendForSign = async (row: GenRow) => {
    setRowError(null);
    setBusy((b) => ({ ...b, [row.id]: "send" }));
    try {
      const res = await fetch(`/api/generated-contracts/${row.id}/send`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Couldn't send for signing.");
      setSent((s) => ({ ...s, [row.id]: d.contract_id }));
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Couldn't send for signing.");
    } finally {
      setBusy((b) => { const c = { ...b }; delete c[row.id]; return c; });
    }
  };

  const renderActions = (row: GenRow) => {
    const contractId = row.contract_id ?? sent[row.id];
    return (
      <div className="flex items-center gap-1 flex-shrink-0">
        {row.google_doc_url && (
          <a
            href={row.google_doc_url}
            target="_blank"
            rel="noopener noreferrer"
            title="Open & edit in Google Docs"
            className="p-2 rounded-xl text-[#5F7C84] hover:bg-[#F8F6F4] transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
        <button
          onClick={() => downloadPdf(row)}
          disabled={!!busy[row.id]}
          title="Download PDF"
          className="p-2 rounded-xl text-[#5F7C84] hover:bg-[#F8F6F4] transition-colors disabled:opacity-50"
        >
          {busy[row.id] === "download" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        </button>
        {contractId ? (
          <Link
            href={`/dashboard/contracts/${contractId}`}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Sent
          </Link>
        ) : row.staff_id ? (
          <button
            onClick={() => sendForSign(row)}
            disabled={!!busy[row.id]}
            title="Send to the employee for e-signature"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#223149] text-white hover:bg-[#1a2638] transition-colors disabled:opacity-50"
          >
            {busy[row.id] === "send" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
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
          Fill a template with each employee&apos;s details, then download the PDFs or send them for signing.
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
              </div>

              {/* Grid */}
              {rows.length > 0 && (
                <div className="border border-[#ECE3DF] rounded-xl overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#F8F6F4] text-left">
                        <th className="px-3 py-2 font-semibold text-[#223149] whitespace-nowrap">Employee</th>
                        {fields.map((f) => (
                          <th key={f} className="px-3 py-2 font-semibold text-[#5F7C84] text-xs whitespace-nowrap">
                            {fieldLabel(template?.field_config, f)}
                          </th>
                        ))}
                        <th className="px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#ECE3DF]">
                      {rows.map((r) => (
                        <tr key={r.key}>
                          <td className="px-3 py-2 align-top">
                            <input
                              value={r.recipient_name}
                              onChange={(e) => setRecipient(r.key, e.target.value)}
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
                                  <select value={r.values[f] ?? ""} onChange={(e) => setValue(r.key, f, e.target.value)} className={cls}>
                                    <option value="">—</option>
                                    {(setting.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                                  </select>
                                ) : setting.type === "date" ? (
                                  <input type="date" value={r.values[f] ?? ""} onChange={(e) => setValue(r.key, f, e.target.value)} className={cls} />
                                ) : (
                                  <input value={r.values[f] ?? ""} onChange={(e) => setValue(r.key, f, e.target.value)} className={cls} />
                                )}
                              </td>
                            );
                          })}
                          <td className="px-2 py-2 align-top">
                            <button
                              onClick={() => removeRow(r.key)}
                              title="Remove row"
                              className="p-1.5 rounded-lg text-[#9BADB7] hover:bg-[#F8F6F4] hover:text-red-500 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {genError && <p className="text-sm text-red-500">{genError}</p>}

              <button
                onClick={generate}
                disabled={generating || rows.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                {generating ? "Generating…" : `Generate ${rows.length || ""} contract${rows.length === 1 ? "" : "s"}`}
              </button>
            </>
          )}
        </div>
      )}

      {/* Fresh result */}
      {result && (
        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
          <p className="font-semibold text-[#223149]">
            Generated {result.generated.length} contract{result.generated.length === 1 ? "" : "s"}
          </p>
          {rowError && <p className="text-sm text-red-500">{rowError}</p>}
          {result.failed.length > 0 && (
            <p className="text-sm text-red-500">
              {result.failed.length} failed: {result.failed.map((f) => f.recipient_name).join(", ")}
            </p>
          )}
          <div className="divide-y divide-[#ECE3DF]">
            {result.generated.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-4 py-2.5">
                <span className="text-sm font-medium text-[#223149] truncate">{row.recipient_name}</span>
                {renderActions(row)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent batches */}
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
                      {renderActions(row)}
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
