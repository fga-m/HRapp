"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, RotateCcw, Mail } from "lucide-react";

interface Template {
  subject: string;
  html: string;
  fromName: string;
  replyTo: string;
}

const PLACEHOLDERS = ["{{name}}", "{{leave_type}}", "{{period}}", "{{reason}}", "{{app_url}}"];

// Fill placeholders with realistic sample values for the live preview.
function renderSample(text: string, kind: "decline" | "approve"): string {
  const sample: Record<string, string> = {
    name: "Megan",
    leave_type: "Annual Leave",
    period: "1 Jun 2026 to 5 Jun 2026",
    reason:
      kind === "decline"
        ? "We're short-staffed that week — happy to look at other dates."
        : "",
    app_url: typeof window !== "undefined" ? window.location.origin : "",
  };
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, k: string) => sample[k] ?? "");
}

interface Props {
  kind: "decline" | "approve";
  title: string;
  description: string;
}

export default function LeaveEmailTemplateEditor({ kind, title, description }: Props) {
  const [tpl, setTpl] = useState<Template | null>(null);
  const [def, setDef] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [error, setError] = useState("");
  const [showPreview, setShowPreview] = useState(true);

  useEffect(() => {
    fetch(`/api/settings/email-template?kind=${kind}`)
      .then((r) => r.json())
      .then((d) => {
        setTpl(d.template ?? null);
        setDef(d.default ?? null);
        setLoading(false);
      })
      .catch(() => { setError("Couldn't load the template."); setLoading(false); });
  }, [kind]);

  const set = (k: keyof Template, v: string) => setTpl((t) => (t ? { ...t, [k]: v } : t));

  const save = async () => {
    if (!tpl) return;
    setSaving(true);
    setError("");
    setSavedMsg("");
    try {
      const res = await fetch("/api/settings/email-template", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...tpl, kind }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed to save");
      setTpl(d.template ?? tpl);
      setSavedMsg("Template saved.");
      setTimeout(() => setSavedMsg(""), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#6E8189] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors";

  return (
    <div className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm p-6">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-xl bg-[#223149]/10 flex items-center justify-center flex-shrink-0">
          <Mail className="w-5 h-5 text-[#223149]" />
        </div>
        <div>
          <h2 className="font-semibold text-[#223149]">{title}</h2>
          <p className="text-sm text-[#50676E]">{description}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[#50676E] mt-4">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : !tpl ? (
        <p className="text-sm text-red-500 mt-4">{error || "Unavailable."}</p>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-[#223149] mb-1.5">From name</label>
              <input className={inputCls} value={tpl.fromName} onChange={(e) => set("fromName", e.target.value)} placeholder="FGA Melbourne HR (no-reply)" />
              <p className="text-xs text-[#50676E] mt-1">Sent from your connected Gmail address; this is just the display name.</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#223149] mb-1.5">Forward replies to <span className="font-normal text-[#50676E]">(Reply-To)</span></label>
              <input className={inputCls} type="email" value={tpl.replyTo} onChange={(e) => set("replyTo", e.target.value)} placeholder="e.g. hr@fgam.org.au" />
              <p className="text-xs text-[#50676E] mt-1">If someone replies anyway, it goes here. Leave blank for none.</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#223149] mb-1.5">Subject</label>
            <input className={inputCls} value={tpl.subject} onChange={(e) => set("subject", e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#223149] mb-1.5">Body (HTML)</label>
            <textarea
              value={tpl.html}
              onChange={(e) => set("html", e.target.value)}
              rows={12}
              spellCheck={false}
              className={inputCls + " font-mono text-xs leading-relaxed resize-y"}
            />
            <p className="text-xs text-[#50676E] mt-1.5">
              Placeholders you can use:{" "}
              {PLACEHOLDERS.map((p) => (
                <code key={p} className="mx-0.5 px-1 py-0.5 bg-[#F8F6F4] rounded border border-[#ECE3DF]">{p}</code>
              ))}
            </p>
          </div>

          {/* Live preview */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-semibold text-[#223149]">Preview</label>
              <button
                type="button"
                onClick={() => setShowPreview((v) => !v)}
                className="text-xs font-semibold text-[#50676E] hover:text-[#223149] underline"
              >
                {showPreview ? "Hide" : "Show"}
              </button>
            </div>
            {showPreview && (
              <div className="rounded-xl border border-[#ECE3DF] overflow-hidden">
                <div className="px-4 py-2 bg-[#F8F6F4] border-b border-[#ECE3DF] text-xs text-[#50676E]">
                  <span className="font-semibold text-[#223149]">Subject:</span> {renderSample(tpl.subject, kind)}
                </div>
                <iframe
                  title="Email preview"
                  sandbox=""
                  className="w-full h-96 bg-white"
                  srcDoc={renderSample(tpl.html, kind)}
                />
              </div>
            )}
            <p className="text-xs text-[#50676E] mt-1.5">Preview fills the placeholders with sample values.</p>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
          {savedMsg && <p className="text-sm text-green-600">{savedMsg}</p>}

          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save template
            </button>
            {def && (
              <button
                onClick={() => setTpl({ ...def })}
                className="inline-flex items-center gap-2 px-4 py-2.5 border border-[#ECE3DF] text-[#50676E] rounded-xl text-sm font-semibold hover:bg-[#F8F6F4] transition-colors"
                title="Reset the fields to the default template (not saved until you click Save)"
              >
                <RotateCcw className="w-4 h-4" /> Reset to default
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
