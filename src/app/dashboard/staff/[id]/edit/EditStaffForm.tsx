"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Shield, Search, X, Loader2, AlertTriangle } from "lucide-react";

interface XeroEmployee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
}

const DEPARTMENTS = [
  "Administration", "Worship", "Youth", "Children", "Connect Groups",
  "Media & Communications", "Outreach", "Finance", "Operations",
];

interface Props {
  id: string;
  isAdmin: boolean;
}

export default function EditStaffForm({ id, isAdmin }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState({
    full_name: "",
    role: "staff",
    position: "",
    department: "",
    google_calendar_id: "",
    contracted_hours: 37.5,
    is_active: true,
    xero_employee_id: "",
    birthdate: "",
  });

  // Xero employee lookup
  const [xeroLinked, setXeroLinked] = useState<XeroEmployee | null>(null);
  const [showXeroLookup, setShowXeroLookup] = useState(false);
  const [xeroEmployees, setXeroEmployees] = useState<XeroEmployee[]>([]);
  const [xeroLoading, setXeroLoading] = useState(false);
  const [xeroError, setXeroError] = useState("");
  const [xeroSearch, setXeroSearch] = useState("");

  const loadStaff = useCallback(() => {
    setLoading(true);
    setLoadError("");
    fetch(`/api/staff/${id}`)
      .then((r) => { if (!r.ok) throw new Error("Failed to load"); return r.json(); })
      .then((d) => {
        setForm({
          full_name: d.full_name || "",
          role: d.role || "staff",
          position: d.position || "",
          department: d.department || "",
          google_calendar_id: d.google_calendar_id || "",
          contracted_hours: d.contracted_hours ?? 37.5,
          is_active: d.is_active ?? true,
          xero_employee_id: d.xero_employee_id || "",
          birthdate: d.birthdate || "",
        });
        setLoading(false);
      })
      .catch(() => { setLoadError("Could not load this staff member. Please try again."); setLoading(false); });
  }, [id]);

  useEffect(() => { loadStaff(); }, [loadStaff]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/staff/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      router.push(`/dashboard/staff/${id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openXeroLookup = async () => {
    setShowXeroLookup(true);
    if (xeroEmployees.length > 0) return;
    setXeroLoading(true);
    setXeroError("");
    try {
      const res = await fetch("/api/xero/employees");
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed to load Xero employees");
      setXeroEmployees(d.employees ?? []);
    } catch (err: any) {
      setXeroError(err.message);
    } finally {
      setXeroLoading(false);
    }
  };

  const selectXeroEmployee = (emp: XeroEmployee) => {
    setForm({ ...form, xero_employee_id: emp.id });
    setXeroLinked(emp);
    setShowXeroLookup(false);
    setXeroSearch("");
  };

  const filteredXeroEmployees = xeroEmployees.filter((e) => {
    const q = xeroSearch.toLowerCase();
    return (
      `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#223149] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/staff/${id}`} className="p-2 rounded-xl hover:bg-[#ECE3DF] transition-colors">
            <ArrowLeft className="w-5 h-5 text-[#223149]" />
          </Link>
          <h1 className="text-3xl font-bold text-[#223149]">Edit Staff Member</h1>
        </div>
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{loadError}</p>
        </div>
        <button
          onClick={loadStaff}
          className="px-4 py-2 border border-[#ECE3DF] text-[#50676E] rounded-xl text-sm font-semibold hover:bg-[#F8F6F4] transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/staff/${id}`} className="p-2 rounded-xl hover:bg-[#ECE3DF] transition-colors">
          <ArrowLeft className="w-5 h-5 text-[#223149]" />
        </Link>
        <h1 className="text-3xl font-bold text-[#223149]">Edit Staff Member</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-[#223149] mb-1.5">Full Name</label>
            <input
              type="text"
              required
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#223149] mb-1.5">Position / Title</label>
            <input
              type="text"
              value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value })}
              placeholder="e.g. Youth Pastor"
              className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#6E8189] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#223149] mb-1.5">Department</label>
            <select
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors bg-white"
            >
              <option value="">Select department</option>
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#223149] mb-1.5">Date of Birth</label>
            <input
              type="date"
              value={form.birthdate}
              onChange={(e) => setForm({ ...form, birthdate: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#223149] mb-1.5">Google Calendar ID</label>
            <input
              type="text"
              value={form.google_calendar_id}
              onChange={(e) => setForm({ ...form, google_calendar_id: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#6E8189] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#223149] mb-1.5">
              Contracted Hours
              <span className="ml-1.5 text-xs font-normal text-[#50676E]">per week</span>
            </label>
            <div className="relative">
              <input
                type="number"
                min={0}
                max={168}
                step={0.5}
                value={form.contracted_hours}
                onChange={(e) => setForm({ ...form, contracted_hours: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors pr-14"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[#50676E] pointer-events-none">hrs</span>
            </div>
            <p className="text-xs text-[#50676E] mt-1">1 FTE = 37.5 hrs/week (7.5 hrs/day × 5 days, excl. 30 min lunch). Every block over 5 hours excludes a 30 min lunch.</p>
          </div>

          {/* Role — highlighted section */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-[#223149] mb-2">Role</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setForm({ ...form, role: "staff" })}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-colors text-left ${
                  form.role === "staff" ? "border-[#223149] bg-[#223149]/5" : "border-[#ECE3DF] hover:border-[#9BADB7]"
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${form.role === "staff" ? "bg-[#223149]" : "bg-[#ECE3DF]"}`}>
                  <span className={`text-xs font-bold ${form.role === "staff" ? "text-white" : "text-[#50676E]"}`}>S</span>
                </div>
                <div>
                  <p className="font-semibold text-sm text-[#223149]">Staff</p>
                  <p className="text-xs text-[#50676E]">Standard access</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, role: "manager" })}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-colors text-left ${
                  form.role === "manager" ? "border-[#5F7C84] bg-[#5F7C84]/5" : "border-[#ECE3DF] hover:border-[#9BADB7]"
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${form.role === "manager" ? "bg-[#5F7C84]" : "bg-[#ECE3DF]"}`}>
                  <span className={`text-xs font-bold ${form.role === "manager" ? "text-white" : "text-[#50676E]"}`}>M</span>
                </div>
                <div>
                  <p className="font-semibold text-sm text-[#223149]">Manager</p>
                  <p className="text-xs text-[#50676E]">Configurable access</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, role: "leave_approver" })}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-colors text-left ${
                  form.role === "leave_approver" ? "border-[#7C5C8A] bg-[#7C5C8A]/5" : "border-[#ECE3DF] hover:border-[#9BADB7]"
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${form.role === "leave_approver" ? "bg-[#7C5C8A]" : "bg-[#ECE3DF]"}`}>
                  <span className={`text-xs font-bold ${form.role === "leave_approver" ? "text-white" : "text-[#50676E]"}`}>LA</span>
                </div>
                <div>
                  <p className="font-semibold text-sm text-[#223149]">Leave Approver</p>
                  <p className="text-xs text-[#50676E]">Approves leave requests</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, role: "finance" })}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-colors text-left ${
                  form.role === "finance" ? "border-[#2E7D52] bg-[#2E7D52]/5" : "border-[#ECE3DF] hover:border-[#9BADB7]"
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${form.role === "finance" ? "bg-[#2E7D52]" : "bg-[#ECE3DF]"}`}>
                  <span className={`text-xs font-bold ${form.role === "finance" ? "text-white" : "text-[#50676E]"}`}>F</span>
                </div>
                <div>
                  <p className="font-semibold text-sm text-[#223149]">Finance</p>
                  <p className="text-xs text-[#50676E]">Payroll &amp; hours</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, role: "admin" })}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-colors text-left ${
                  form.role === "admin" ? "border-[#223149] bg-[#223149]/5" : "border-[#ECE3DF] hover:border-[#9BADB7]"
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${form.role === "admin" ? "bg-[#223149]" : "bg-[#ECE3DF]"}`}>
                  <Shield className={`w-4 h-4 ${form.role === "admin" ? "text-white" : "text-[#50676E]"}`} />
                </div>
                <div>
                  <p className="font-semibold text-sm text-[#223149]">Admin</p>
                  <p className="text-xs text-[#50676E]">Full access</p>
                </div>
              </button>
            </div>
            {form.role === "admin" && (
              <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                ⚠️ Admins can manage all staff, policies, meeting notes and onboarding.
              </p>
            )}
            {form.role === "manager" && (
              <p className="text-xs text-[#50676E] mt-2">
                Managers get the permissions configured on the Access Levels page.
              </p>
            )}
            {form.role === "leave_approver" && (
              <p className="text-xs text-[#7C5C8A] mt-2">
                Leave Approvers can review, approve and reject leave requests in the app before they go to Xero.
              </p>
            )}
            {form.role === "finance" && (
              <p className="text-xs text-[#2E7D52] mt-2">
                Finance gets the permissions configured on the Access Levels page.
              </p>
            )}
          </div>

          {/* Xero Employee Link — admin only */}
          {isAdmin && (
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-[#223149] mb-1.5">
                Xero Employee
                <span className="ml-1.5 text-xs font-normal text-[#50676E]">for leave requests · admin only</span>
              </label>
              {form.xero_employee_id ? (
                <div className="flex items-center gap-3 px-4 py-3 bg-[#F8F6F4] rounded-xl border border-[#ECE3DF]">
                  <div className="w-7 h-7 rounded-lg bg-[#13B5EA]/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-[#13B5EA] text-xs font-bold">X</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    {xeroLinked ? (
                      <>
                        <p className="text-sm font-semibold text-[#223149]">{xeroLinked.firstName} {xeroLinked.lastName}</p>
                        {xeroLinked.email && <p className="text-xs text-[#50676E] truncate">{xeroLinked.email}</p>}
                      </>
                    ) : (
                      <p className="text-sm text-[#223149] font-mono truncate">{form.xero_employee_id}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => { setForm({ ...form, xero_employee_id: "" }); setXeroLinked(null); }}
                    className="p-1 rounded-lg hover:bg-[#ECE3DF] text-[#50676E] hover:text-red-400 transition-colors flex-shrink-0"
                    title="Remove link"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={openXeroLookup}
                  className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-[#9BADB7] text-[#50676E] hover:border-[#13B5EA] hover:text-[#13B5EA] transition-colors text-sm"
                >
                  <Search className="w-4 h-4" />
                  Search Xero employees…
                </button>
              )}

              {/* Lookup dropdown */}
              {showXeroLookup && (
                <div className="mt-2 bg-white border border-[#ECE3DF] rounded-xl shadow-lg overflow-hidden">
                  <div className="p-3 border-b border-[#ECE3DF]">
                    <div className="flex items-center gap-2 px-3 py-2 bg-[#F8F6F4] rounded-lg">
                      <Search className="w-4 h-4 text-[#50676E] flex-shrink-0" />
                      <input
                        autoFocus
                        type="text"
                        placeholder="Search by name or email…"
                        value={xeroSearch}
                        onChange={(e) => setXeroSearch(e.target.value)}
                        className="flex-1 bg-transparent text-sm text-[#223149] placeholder:text-[#6E8189] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => { setShowXeroLookup(false); setXeroSearch(""); }}
                        className="text-[#50676E] hover:text-[#223149]"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    {xeroLoading ? (
                      <div className="flex items-center justify-center gap-2 py-6 text-sm text-[#50676E]">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading from Xero…
                      </div>
                    ) : xeroError ? (
                      <div className="p-4 text-sm text-red-500">
                        {xeroError.includes("not connected") || xeroError.includes("Xero not connected")
                          ? "Xero is not connected. Go to Settings to connect first."
                          : xeroError}
                      </div>
                    ) : filteredXeroEmployees.length === 0 ? (
                      <p className="p-4 text-sm text-[#50676E] text-center">
                        {xeroSearch ? "No employees match your search." : "No employees found in Xero."}
                      </p>
                    ) : (
                      filteredXeroEmployees
                        .filter((e) => e.status !== "TERMINATED")
                        .map((emp) => (
                          <button
                            key={emp.id}
                            type="button"
                            onClick={() => selectXeroEmployee(emp)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F8F6F4] transition-colors text-left"
                          >
                            <div className="w-8 h-8 rounded-full bg-[#223149] flex items-center justify-center flex-shrink-0">
                              <span className="text-white text-xs font-bold">
                                {emp.firstName[0]}{emp.lastName[0]}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-[#223149]">{emp.firstName} {emp.lastName}</p>
                              {emp.email && <p className="text-xs text-[#50676E] truncate">{emp.email}</p>}
                            </div>
                          </button>
                        ))
                    )}
                  </div>
                </div>
              )}
              <p className="text-xs text-[#50676E] mt-1.5">Links this staff member to their Xero Payroll record for leave requests.</p>
            </div>
          )}

          {/* Active status */}
          <div className="sm:col-span-2 flex items-center justify-between p-4 bg-[#F8F6F4] rounded-xl">
            <div>
              <p className="text-sm font-semibold text-[#223149]">Active Staff Member</p>
              <p className="text-xs text-[#50676E]">Inactive staff won't be able to sign in</p>
            </div>
            <button
              type="button"
              onClick={() => setForm({ ...form, is_active: !form.is_active })}
              className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${form.is_active ? "bg-[#223149]" : "bg-[#ECE3DF]"}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${form.is_active ? "left-5" : "left-0.5"}`} />
            </button>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 px-6 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <Link
            href={`/dashboard/staff/${id}`}
            className="px-6 py-2.5 border border-[#ECE3DF] text-[#50676E] rounded-xl text-sm font-semibold hover:bg-[#F8F6F4] transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
