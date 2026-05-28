"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const DEPARTMENTS = [
  "Administration",
  "Worship",
  "Youth",
  "Children",
  "Connect Groups",
  "Media & Communications",
  "Outreach",
  "Finance",
  "Operations",
];

export default function NewStaffPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    role: "staff",
    position: "",
    department: "",
    google_calendar_id: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create staff");

      router.push("/dashboard/staff");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/staff"
          className="p-2 rounded-xl hover:bg-[#ECE3DF] transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-[#223149]" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-[#223149]">Add Staff Member</h1>
          <p className="text-[#5F7C84] mt-1 text-sm">
            They'll be able to sign in with their @fgam.org.au Google account
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-[#223149] mb-1.5">
              Full Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="e.g. Sarah Johnson"
              className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-[#223149] mb-1.5">
              Email <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="name@fgam.org.au"
              className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
            />
            <p className="text-xs text-[#9BADB7] mt-1">Must be an @fgam.org.au address</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#223149] mb-1.5">
              Position / Title
            </label>
            <input
              type="text"
              value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value })}
              placeholder="e.g. Youth Pastor"
              className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#223149] mb-1.5">
              Department / Ministry
            </label>
            <select
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors bg-white"
            >
              <option value="">Select department</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#223149] mb-1.5">
              Role
            </label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors bg-white"
            >
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#223149] mb-1.5">
              Google Calendar ID
            </label>
            <input
              type="text"
              value={form.google_calendar_id}
              onChange={(e) => setForm({ ...form, google_calendar_id: e.target.value })}
              placeholder="name@fgam.org.au"
              className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
            />
            <p className="text-xs text-[#9BADB7] mt-1">Usually same as email</p>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-6 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Adding..." : "Add Staff Member"}
          </button>
          <Link
            href="/dashboard/staff"
            className="px-6 py-2.5 border border-[#ECE3DF] text-[#5F7C84] rounded-xl text-sm font-semibold hover:bg-[#F8F6F4] transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
