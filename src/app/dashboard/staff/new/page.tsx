"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, CheckCircle2, XCircle, AlertTriangle, Copy, Check } from "lucide-react";

const DEPARTMENTS = [
  "Administration", "Worship", "Youth", "Children", "Connect Groups",
  "Media & Communications", "Outreach", "Finance", "Operations",
];

const AU_STATES = ["VIC", "NSW", "QLD", "SA", "WA", "TAS", "ACT", "NT"];

interface ServiceResult {
  service: "google" | "xero";
  status: "success" | "skipped" | "error";
  detail: string;
  externalId?: string;
  tempPassword?: string;
}

export default function NewStaffPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [googleConnected, setGoogleConnected] = useState(false);
  const [xeroConnected, setXeroConnected] = useState(false);

  const [availableRoles, setAvailableRoles] = useState<{ key: string; label: string; is_admin: boolean }[]>([]);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    role: "staff",
    roles: ["staff"] as string[],
    position: "",
    department: "",
    google_calendar_id: "",
    contracted_hours: "37.5",
    birthdate: "",
    recovery_email: "",
    mobile_phone: "",
    start_date: "",
    address_line1: "",
    address_line2: "",
    suburb: "",
    state: "",
    postcode: "",
    country: "AU",
  });

  const [provGoogle, setProvGoogle] = useState(false);
  const [provXero, setProvXero] = useState(false);

  // Outcome view (shown after a create that also provisioned)
  const [results, setResults] = useState<ServiceResult[] | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/google-workspace/status").then((r) => r.json()).then((d) => setGoogleConnected(!!d.connected)).catch(() => {});
    fetch("/api/xero/status").then((r) => r.json()).then((d) => setXeroConnected(!!d.connected)).catch(() => {});
    fetch("/api/permissions").then((r) => r.json()).then((d) => setAvailableRoles(d.roles ?? [])).catch(() => {});
  }, []);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const toggleRole = (key: string) => {
    setForm((f) => {
      const has = f.roles.includes(key);
      let next = has ? f.roles.filter((r) => r !== key) : [...f.roles, key];
      if (next.length === 0) next = ["staff"];
      return { ...f, roles: next };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResults(null);

    try {
      // 1. Create the staff record (the single source of truth).
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create staff");

      const id: string = data.id;
      setCreatedId(id);

      // 2. Optionally provision accounts from that record.
      if (provGoogle || provXero) {
        const provRes = await fetch(`/api/staff/${id}/provision`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            services: { google: provGoogle, xero: provXero },
            // record already holds the values; no overrides needed
          }),
        });
        const provData = await provRes.json();
        if (!provRes.ok) throw new Error(provData.error || "Staff created, but provisioning failed");
        setResults(provData.results ?? []);
        setLoading(false);
        return; // stay on page to show results / temp password
      }

      router.push("/dashboard/staff");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  const tempPassword = results?.find((r) => r.service === "google" && r.tempPassword)?.tempPassword;
  const copyPassword = async () => {
    if (!tempPassword) return;
    try { await navigator.clipboard.writeText(tempPassword); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  };

  // ── Results view ────────────────────────────────────────────────────────
  if (results && createdId) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/staff" className="p-2 rounded-xl hover:bg-[#ECE3DF] transition-colors">
            <ArrowLeft className="w-5 h-5 text-[#223149]" />
          </Link>
          <h1 className="text-3xl font-bold text-[#223149]">Staff member added</h1>
        </div>

        <div className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm p-6 space-y-3">
          {results.map((r) => (
            <div key={r.service} className={`flex items-start gap-2 p-3 rounded-xl border text-sm ${
              r.status === "error" ? "bg-red-50 border-red-200 text-red-700"
                : r.status === "skipped" ? "bg-[#F8F6F4] border-[#ECE3DF] text-[#50676E]"
                : "bg-green-50 border-green-200 text-green-700"}`}>
              {r.status === "error" ? <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />}
              <div><span className="font-semibold capitalize">{r.service}:</span> {r.detail}</div>
            </div>
          ))}

          {tempPassword && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
              <p className="text-xs text-blue-700 font-medium mb-1">Temporary Google password — shown once. Send it to the new starter&apos;s personal email; they&apos;ll change it at first sign-in.</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm font-mono bg-white px-3 py-2 rounded-lg border border-blue-200 text-[#223149]">{tempPassword}</code>
                <button onClick={copyPassword} className="flex items-center gap-1 px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors">
                  {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Link href={`/dashboard/staff/${createdId}`} className="flex-1 text-center px-6 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors">
              View profile
            </Link>
            <Link href="/dashboard/staff" className="px-6 py-2.5 border border-[#ECE3DF] text-[#50676E] rounded-xl text-sm font-semibold hover:bg-[#F8F6F4] transition-colors">
              Back to staff
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Form view ─────────────────────────────────────────────────────────────
  const inputCls = "w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#6E8189] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors";
  const labelCls = "block text-sm font-semibold text-[#223149] mb-1.5";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/staff" className="p-2 rounded-xl hover:bg-[#ECE3DF] transition-colors">
          <ArrowLeft className="w-5 h-5 text-[#223149]" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-[#223149]">Add Staff Member</h1>
          <p className="text-[#50676E] mt-1 text-sm">Create the record once — then provision their Google &amp; Xero accounts from it.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm p-6 space-y-5">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label htmlFor="first-name" className={labelCls}>First Name <span className="text-red-400">*</span></label>
            <input id="first-name" type="text" required value={form.first_name}
              onChange={(e) => set("first_name", e.target.value)} placeholder="e.g. Sarah" className={inputCls} />
          </div>
          <div>
            <label htmlFor="last-name" className={labelCls}>Last Name <span className="text-red-400">*</span></label>
            <input id="last-name" type="text" required value={form.last_name}
              onChange={(e) => set("last_name", e.target.value)} placeholder="e.g. Johnson" className={inputCls} />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="email" className={labelCls}>Work Email <span className="text-red-400">*</span></label>
            <input id="email" type="email" required value={form.email}
              onChange={(e) => set("email", e.target.value)} placeholder="name@fgam.org.au" className={inputCls} />
            <p className="text-xs text-[#50676E] mt-1">Must be an @fgam.org.au address — this becomes their Google login.</p>
          </div>

          <div>
            <label htmlFor="position-title" className={labelCls}>Position / Title</label>
            <input id="position-title" type="text" value={form.position}
              onChange={(e) => set("position", e.target.value)} placeholder="e.g. Youth Pastor" className={inputCls} />
          </div>
          <div>
            <label htmlFor="department" className={labelCls}>Department / Ministry</label>
            <select id="department" value={form.department} onChange={(e) => set("department", e.target.value)} className={inputCls + " bg-white"}>
              <option value="">Select department</option>
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Roles</label>
            <div className="flex flex-wrap gap-2">
              {availableRoles.map((r) => {
                const selected = form.roles.includes(r.key);
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => toggleRole(r.key)}
                    className={`px-3 py-1.5 rounded-full text-sm font-semibold border-2 transition-colors ${
                      selected ? "border-[#223149] bg-[#223149] text-white" : "border-[#ECE3DF] text-[#50676E] hover:border-[#9BADB7]"
                    }`}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-[#50676E] mt-1">Pick one or more — access is combined across roles.</p>
          </div>
          <div>
            <label htmlFor="contracted-hours" className={labelCls}>Contracted hours / week</label>
            <input id="contracted-hours" type="number" min="0" step="0.5" value={form.contracted_hours}
              onChange={(e) => set("contracted_hours", e.target.value)} className={inputCls} />
            <p className="text-xs text-[#50676E] mt-1">1 FTE = 37.5 hrs</p>
          </div>

          <div>
            <label htmlFor="recovery-email" className={labelCls}>Personal / recovery email</label>
            <input id="recovery-email" type="email" value={form.recovery_email}
              onChange={(e) => set("recovery_email", e.target.value)} placeholder="personal@example.com" className={inputCls} />
            <p className="text-xs text-[#50676E] mt-1">For Google recovery &amp; sending their welcome / temp password.</p>
          </div>
          <div>
            <label htmlFor="mobile" className={labelCls}>Mobile</label>
            <input id="mobile" type="text" value={form.mobile_phone}
              onChange={(e) => set("mobile_phone", e.target.value)} placeholder="+61 4xx xxx xxx" className={inputCls} />
          </div>

          <div>
            <label htmlFor="birthdate" className={labelCls}>Date of Birth <span className="text-xs font-normal text-[#50676E]">(required for Xero)</span></label>
            <input id="birthdate" type="date" value={form.birthdate}
              onChange={(e) => set("birthdate", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="start-date" className={labelCls}>Start date</label>
            <input id="start-date" type="date" value={form.start_date}
              onChange={(e) => set("start_date", e.target.value)} className={inputCls} />
          </div>
        </div>

        {/* Home address */}
        <div className="pt-2 border-t border-[#ECE3DF]">
          <p className="text-sm font-semibold text-[#223149] mt-3 mb-3">Home address <span className="text-xs font-normal text-[#50676E]">(required for Xero payroll)</span></p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <label htmlFor="addr1" className={labelCls}>Address line 1</label>
              <input id="addr1" type="text" value={form.address_line1} onChange={(e) => set("address_line1", e.target.value)} className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="addr2" className={labelCls}>Address line 2</label>
              <input id="addr2" type="text" value={form.address_line2} onChange={(e) => set("address_line2", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label htmlFor="suburb" className={labelCls}>Suburb / city</label>
              <input id="suburb" type="text" value={form.suburb} onChange={(e) => set("suburb", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label htmlFor="state" className={labelCls}>State</label>
              <select id="state" value={form.state} onChange={(e) => set("state", e.target.value)} className={inputCls + " bg-white"}>
                <option value="">Select…</option>
                {AU_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="postcode" className={labelCls}>Postcode</label>
              <input id="postcode" type="text" value={form.postcode} onChange={(e) => set("postcode", e.target.value)} className={inputCls} />
            </div>
          </div>
        </div>

        {/* Provisioning */}
        <div className="pt-2 border-t border-[#ECE3DF]">
          <p className="text-sm font-semibold text-[#223149] mt-3 mb-3">Provision accounts now</p>
          <div className="space-y-2">
            <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${provGoogle ? "border-[#4285F4] bg-[#4285F4]/5" : "border-[#ECE3DF]"} ${!googleConnected ? "opacity-60" : ""}`}>
              <input type="checkbox" checked={provGoogle} disabled={!googleConnected} onChange={(e) => setProvGoogle(e.target.checked)} className="w-4 h-4 accent-[#4285F4]" />
              <div className="flex-1">
                <p className="text-sm font-medium text-[#223149]">Create Google Workspace account</p>
                <p className="text-xs text-[#50676E]">Creates their @fgam.org.au login with a temporary password.</p>
              </div>
            </label>
            <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${provXero ? "border-[#13B5EA] bg-[#13B5EA]/5" : "border-[#ECE3DF]"} ${!xeroConnected ? "opacity-60" : ""}`}>
              <input type="checkbox" checked={provXero} disabled={!xeroConnected} onChange={(e) => setProvXero(e.target.checked)} className="w-4 h-4 accent-[#13B5EA]" />
              <div className="flex-1">
                <p className="text-sm font-medium text-[#223149]">Add to Xero payroll</p>
                <p className="text-xs text-[#50676E]">Creates their AU payroll employee record (needs DOB + address above).</p>
              </div>
            </label>
          </div>
          {(!googleConnected || !xeroConnected) && (
            <div className="flex items-start gap-2 mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                {!googleConnected && "Google Workspace isn't connected. "}
                {!xeroConnected && "Xero isn't connected. "}
                You can still add the staff member now and provision later from their profile. Connect under{" "}
                <Link href="/dashboard/settings" className="font-semibold underline">Settings</Link>.
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading}
            className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Working…" : (provGoogle || provXero) ? "Add & Provision" : "Add Staff Member"}
          </button>
          <Link href="/dashboard/staff" className="px-6 py-2.5 border border-[#ECE3DF] text-[#50676E] rounded-xl text-sm font-semibold hover:bg-[#F8F6F4] transition-colors">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
