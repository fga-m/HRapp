"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  UserPlus, Loader2, CheckCircle2, XCircle, AlertTriangle, Copy, Check,
  ChevronDown, ChevronRight,
} from "lucide-react";

// Mirrors the GET /api/staff/[id]/provision response.
interface ProvisionStatus {
  googleConnected: boolean;
  googleConnectedEmail: string | null;
  xeroConnected: boolean;
  google: { provisioned: boolean; provisionedAt: string | null; missing: string[] };
  xero: { provisioned: boolean; employeeId: string | null; missing: string[] };
  staff: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    recovery_email: string | null;
    mobile_phone: string | null;
    position: string | null;
    department: string | null;
    birthdate: string | null;
    start_date: string | null;
    address_line1: string | null;
    address_line2: string | null;
    suburb: string | null;
    state: string | null;
    postcode: string | null;
    country: string | null;
  };
}

interface ServiceResult {
  service: "google" | "xero";
  status: "success" | "skipped" | "error";
  detail: string;
  externalId?: string;
  tempPassword?: string;
}

const AU_STATES = ["VIC", "NSW", "QLD", "SA", "WA", "TAS", "ACT", "NT"];

function StatusPill({ done, label }: { done: boolean; label: string }) {
  return done ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
      <CheckCircle2 className="w-3 h-3" /> {label}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
      Not yet
    </span>
  );
}

export default function ProvisioningPanel({ staffId }: { staffId: string }) {
  const [status, setStatus] = useState<ProvisionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [expanded, setExpanded] = useState(false);

  const [selGoogle, setSelGoogle] = useState(false);
  const [selXero, setSelXero] = useState(false);
  const [fields, setFields] = useState({
    first_name: "", last_name: "", recovery_email: "", mobile_phone: "",
    birthdate: "", start_date: "", address_line1: "", address_line2: "",
    suburb: "", state: "", postcode: "", country: "AU",
  });

  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [results, setResults] = useState<ServiceResult[]>([]);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError("");
    fetch(`/api/staff/${staffId}/provision`)
      .then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); })
      .then((d: ProvisionStatus) => {
        setStatus(d);
        setFields({
          first_name: d.staff.firstName || "",
          last_name: d.staff.lastName || "",
          recovery_email: d.staff.recovery_email || "",
          mobile_phone: d.staff.mobile_phone || "",
          birthdate: d.staff.birthdate || "",
          start_date: d.staff.start_date || "",
          address_line1: d.staff.address_line1 || "",
          address_line2: d.staff.address_line2 || "",
          suburb: d.staff.suburb || "",
          state: d.staff.state || "",
          postcode: d.staff.postcode || "",
          country: d.staff.country || "AU",
        });
        // Pre-select services that aren't done yet and are connected.
        setSelGoogle(!d.google.provisioned && d.googleConnected);
        setSelXero(!d.xero.provisioned && d.xeroConnected);
        setLoading(false);
      })
      .catch(() => { setLoadError("Couldn't load provisioning status."); setLoading(false); });
  }, [staffId]);

  useEffect(() => { load(); }, [load]);

  const set = (k: keyof typeof fields, v: string) => setFields((f) => ({ ...f, [k]: v }));

  const run = async () => {
    setRunning(true);
    setRunError("");
    setResults([]);
    setCopied(false);
    try {
      const res = await fetch(`/api/staff/${staffId}/provision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          services: { google: selGoogle, xero: selXero },
          fields,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Provisioning failed");
      setResults(data.results ?? []);
      load(); // refresh provisioned flags
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Provisioning failed");
    } finally {
      setRunning(false);
    }
  };

  const tempPassword = results.find((r) => r.service === "google" && r.tempPassword)?.tempPassword;

  const copyPassword = async () => {
    if (!tempPassword) return;
    try { await navigator.clipboard.writeText(tempPassword); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm p-6 flex items-center gap-2 text-sm text-[#50676E]">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading account provisioning…
      </div>
    );
  }
  if (loadError || !status) {
    return (
      <div className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-red-500">{loadError || "Unavailable."}</p>
          <button onClick={load} className="text-sm font-semibold text-[#223149] hover:underline">Retry</button>
        </div>
      </div>
    );
  }

  const nothingToDo = (!selGoogle && !selXero) || running;

  return (
    <div className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm p-6 space-y-5">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-[#50676E]" />
          <h3 className="text-sm font-semibold text-[#223149]">Account Provisioning</h3>
        </div>
        {expanded ? <ChevronDown className="w-4 h-4 text-[#50676E]" /> : <ChevronRight className="w-4 h-4 text-[#50676E]" />}
      </button>

      {/* Summary row (always visible) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex items-center justify-between p-3 bg-[#F8F6F4] rounded-xl">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-[#4285F4]/10 flex items-center justify-center text-[#4285F4] text-xs font-bold">G</span>
            <span className="text-sm font-medium text-[#223149]">Google account</span>
          </div>
          <StatusPill done={status.google.provisioned} label="Created" />
        </div>
        <div className="flex items-center justify-between p-3 bg-[#F8F6F4] rounded-xl">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-[#13B5EA]/10 flex items-center justify-center text-[#13B5EA] text-xs font-bold">X</span>
            <span className="text-sm font-medium text-[#223149]">Xero payroll</span>
          </div>
          <StatusPill done={status.xero.provisioned} label="Added" />
        </div>
      </div>

      {expanded && (
        <div className="space-y-5 pt-1">
          {/* Connection warnings */}
          {(!status.googleConnected || !status.xeroConnected) && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                {!status.googleConnected && "Google Workspace isn't connected. "}
                {!status.xeroConnected && "Xero isn't connected. "}
                Connect under{" "}
                <Link href="/dashboard/settings" className="font-semibold underline">Settings</Link>.
              </span>
            </div>
          )}

          {/* Service selection */}
          <div className="space-y-2">
            <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${selGoogle ? "border-[#4285F4] bg-[#4285F4]/5" : "border-[#ECE3DF]"} ${(!status.googleConnected || status.google.provisioned) ? "opacity-60" : ""}`}>
              <input type="checkbox" checked={selGoogle} disabled={!status.googleConnected}
                onChange={(e) => setSelGoogle(e.target.checked)} className="w-4 h-4 accent-[#4285F4]" />
              <div className="flex-1">
                <p className="text-sm font-medium text-[#223149]">Create Google Workspace account</p>
                <p className="text-xs text-[#50676E]">
                  {status.google.provisioned ? "Already created — re-running will detect & skip." : `Creates ${status.staff.email} with a temporary password.`}
                </p>
              </div>
            </label>
            <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${selXero ? "border-[#13B5EA] bg-[#13B5EA]/5" : "border-[#ECE3DF]"} ${(!status.xeroConnected || status.xero.provisioned) ? "opacity-60" : ""}`}>
              <input type="checkbox" checked={selXero} disabled={!status.xeroConnected}
                onChange={(e) => setSelXero(e.target.checked)} className="w-4 h-4 accent-[#13B5EA]" />
              <div className="flex-1">
                <p className="text-sm font-medium text-[#223149]">Add to Xero payroll</p>
                <p className="text-xs text-[#50676E]">
                  {status.xero.provisioned ? "Already linked — re-running will detect & skip." : "Creates an AU payroll employee record."}
                </p>
              </div>
            </label>
          </div>

          {/* Editable fields (single source of truth) */}
          <div className="space-y-4">
            <p className="text-xs text-[#50676E]">These values are saved to the staff record and used for Google, Xero and contracts — edit once here.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="First name" value={fields.first_name} onChange={(v) => set("first_name", v)} />
              <Field label="Last name" value={fields.last_name} onChange={(v) => set("last_name", v)} />
              <Field label="Personal / recovery email" type="email" value={fields.recovery_email} onChange={(v) => set("recovery_email", v)} placeholder="for Google recovery + welcome" />
              <Field label="Mobile" value={fields.mobile_phone} onChange={(v) => set("mobile_phone", v)} placeholder="+61 4xx xxx xxx" />
              <Field label="Date of birth" type="date" value={fields.birthdate} onChange={(v) => set("birthdate", v)} hint={selXero ? "Required for Xero" : undefined} />
              <Field label="Start date" type="date" value={fields.start_date} onChange={(v) => set("start_date", v)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Address line 1" value={fields.address_line1} onChange={(v) => set("address_line1", v)} hint={selXero ? "Required for Xero" : undefined} />
              <Field label="Address line 2" value={fields.address_line2} onChange={(v) => set("address_line2", v)} />
              <Field label="Suburb / city" value={fields.suburb} onChange={(v) => set("suburb", v)} hint={selXero ? "Required for Xero" : undefined} />
              <div>
                <label className="block text-sm font-semibold text-[#223149] mb-1.5">State {selXero && <span className="text-xs font-normal text-[#50676E]">(required for Xero)</span>}</label>
                <select value={fields.state} onChange={(e) => set("state", e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] bg-white focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors">
                  <option value="">Select…</option>
                  {AU_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <Field label="Postcode" value={fields.postcode} onChange={(v) => set("postcode", v)} hint={selXero ? "Required for Xero" : undefined} />
            </div>
          </div>

          {runError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{runError}</div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-2">
              {results.map((r) => (
                <div key={r.service} className={`flex items-start gap-2 p-3 rounded-xl border text-sm ${
                  r.status === "error" ? "bg-red-50 border-red-200 text-red-700"
                    : r.status === "skipped" ? "bg-[#F8F6F4] border-[#ECE3DF] text-[#50676E]"
                    : "bg-green-50 border-green-200 text-green-700"}`}>
                  {r.status === "error" ? <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                  <div>
                    <span className="font-semibold capitalize">{r.service}:</span> {r.detail}
                  </div>
                </div>
              ))}
              {tempPassword && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                  <p className="text-xs text-blue-700 font-medium mb-1">Temporary Google password — shown once. Send it to the new starter&apos;s personal email; they&apos;ll be asked to change it at first sign-in.</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm font-mono bg-white px-3 py-2 rounded-lg border border-blue-200 text-[#223149]">{tempPassword}</code>
                    <button onClick={copyPassword} className="flex items-center gap-1 px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors">
                      {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={run}
              disabled={nothingToDo}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              {running ? "Provisioning…" : "Provision selected"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", placeholder, hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-[#223149] mb-1.5">
        {label} {hint && <span className="text-xs font-normal text-[#50676E]">({hint})</span>}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#6E8189] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
      />
    </div>
  );
}
