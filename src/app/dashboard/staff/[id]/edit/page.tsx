"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";

const DEPARTMENTS = [
  "Administration", "Worship", "Youth", "Children", "Connect Groups",
  "Media & Communications", "Outreach", "Finance", "Operations",
];

export default function EditStaffPage() {
  const { id } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    full_name: "",
    role: "staff",
    position: "",
    department: "",
    google_calendar_id: "",
    is_active: true,
  });

  useEffect(() => {
    fetch(`/api/staff/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setForm({
          full_name: d.full_name || "",
          role: d.role || "staff",
          position: d.position || "",
          department: d.department || "",
          google_calendar_id: d.google_calendar_id || "",
          is_active: d.is_active ?? true,
        });
        setLoading(false);
      });
  }, [id]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#223149] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
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
              className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
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
            <label className="block text-sm font-semibold text-[#223149] mb-1.5">Google Calendar ID</label>
            <input
              type="text"
              value={form.google_calendar_id}
              onChange={(e) => setForm({ ...form, google_calendar_id: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
            />
          </div>

          {/* Role — highlighted section */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-[#223149] mb-2">Role</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setForm({ ...form, role: "staff" })}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-colors text-left ${
                  form.role === "staff"
                    ? "border-[#223149] bg-[#223149]/5"
                    : "border-[#ECE3DF] hover:border-[#9BADB7]"
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${form.role === "staff" ? "bg-[#223149]" : "bg-[#ECE3DF]"}`}>
                  <span className={`text-xs font-bold ${form.role === "staff" ? "text-white" : "text-[#9BADB7]"}`}>S</span>
                </div>
                <div>
                  <p className="font-semibold text-sm text-[#223149]">Staff</p>
                  <p className="text-xs text-[#9BADB7]">Standard access</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, role: "admin" })}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-colors text-left ${
                  form.role === "admin"
                    ? "border-[#223149] bg-[#223149]/5"
                    : "border-[#ECE3DF] hover:border-[#9BADB7]"
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${form.role === "admin" ? "bg-[#223149]" : "bg-[#ECE3DF]"}`}>
                  <Shield className={`w-4 h-4 ${form.role === "admin" ? "text-white" : "text-[#9BADB7]"}`} />
                </div>
                <div>
                  <p className="font-semibold text-sm text-[#223149]">Admin</p>
                  <p className="text-xs text-[#9BADB7]">Full access</p>
                </div>
              </button>
            </div>
            {form.role === "admin" && (
              <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                ⚠️ Admins can manage all staff, policies, meeting notes and onboarding.
              </p>
            )}
          </div>

          {/* Active status */}
          <div className="sm:col-span-2 flex items-center justify-between p-4 bg-[#F8F6F4] rounded-xl">
            <div>
              <p className="text-sm font-semibold text-[#223149]">Active Staff Member</p>
              <p className="text-xs text-[#9BADB7]">Inactive staff won't be able to sign in</p>
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
            className="px-6 py-2.5 border border-[#ECE3DF] text-[#5F7C84] rounded-xl text-sm font-semibold hover:bg-[#F8F6F4] transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
