"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, Plus, CheckCircle, Clock, X } from "lucide-react";
import PageSubtitle from "@/components/PageSubtitle";

const DEFAULT_TEMPLATE = `## Position Overview

[Brief summary of the role, its purpose within the organisation, and how it contributes to the ministry's mission.]

## Reporting Structure

**Reports to:** [Manager / Supervisor Name & Title]
**Direct Reports:** [None]

## Key Responsibilities

### Primary Duties
- [Responsibility 1]
- [Responsibility 2]
- [Responsibility 3]

### Ministry & Pastoral Duties
- [Ministry responsibility 1]
- [Ministry responsibility 2]

### Administrative Duties
- [Administrative task 1]
- [Administrative task 2]

## Qualifications & Experience

### Required
- [Required qualification or experience]
- [Required qualification or experience]

### Preferred
- [Preferred qualification or experience]

## Skills & Competencies

- [Skill or competency]
- [Skill or competency]
- [Skill or competency]

## Working Conditions

**Employment Type:** [Full-time / Part-time / Casual]
**Hours per Week:** [e.g. 38 hours]
**Location:** [Primary work location]
**Travel Requirements:** [None / Occasional / Frequent]

## Performance Expectations

Performance will be reviewed annually and assessed against the key responsibilities listed above, as well as alignment with organisational values and culture.

## Values Alignment

All staff are expected to uphold and model the core values of FGA Melbourne in their work and interactions.`;

function AvatarInitial({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className="w-10 h-10 rounded-full object-cover"
      />
    );
  }
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return (
    <div className="w-10 h-10 rounded-full bg-[#223149] flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
      {initials}
    </div>
  );
}

export default function PositionDescriptionsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [allStaff, setAllStaff] = useState<any[]>([]);
  const [staffPickerId, setStaffPickerId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState(DEFAULT_TEMPLATE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchData = () => {
    setLoading(true);
    fetch("/api/position-descriptions")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openModal = async () => {
    setShowModal(true);
    setError("");
    setNewTitle("");
    setNewContent(DEFAULT_TEMPLATE);
    setStaffPickerId("");
    if (allStaff.length === 0) {
      const res = await fetch("/api/staff");
      const staffList = await res.json();
      setAllStaff(Array.isArray(staffList) ? staffList.filter((s: any) => s.is_active) : []);
    }
  };

  const handleCreate = async () => {
    if (!staffPickerId || !newTitle.trim()) {
      setError("Please select a staff member and enter a title.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/position-descriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staff_id: staffPickerId,
          title: newTitle.trim(),
          content: newContent,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#223149] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { pds, role } = data || { pds: [], role: "staff" };
  const isAdmin = role === "admin";

  // Staff view: no PD
  if (!isAdmin && (!pds || pds.length === 0)) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <Briefcase className="w-6 h-6 text-[#223149]" />
          <h1 className="text-2xl font-bold text-[#223149]">My Position</h1>
        </div>
        <PageSubtitle pageKey="position-descriptions" defaultDescription="Your job description and the key responsibilities of your role." />
        <div className="bg-white rounded-2xl shadow-sm p-10 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#ECE3DF] flex items-center justify-center">
            <Briefcase className="w-8 h-8 text-[#9BADB7]" />
          </div>
          <h2 className="text-lg font-semibold text-[#223149]">Not set up yet</h2>
          <p className="text-sm text-[#9BADB7] max-w-sm">
            Your position description hasn&apos;t been set up yet. Your manager will share it with you once it&apos;s ready.
          </p>
        </div>
      </div>
    );
  }

  // Staff view: single PD
  if (!isAdmin && pds && pds.length > 0) {
    const pd = pds[0];
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <Briefcase className="w-6 h-6 text-[#223149]" />
          <h1 className="text-2xl font-bold text-[#223149]">My Position</h1>
        </div>
        <PageSubtitle pageKey="position-descriptions" defaultDescription="Your job description and the key responsibilities of your role." />
        <Link href={`/dashboard/position-descriptions/${pd.id}`}>
          <div className="bg-white rounded-2xl shadow-sm p-5 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-[#223149] flex items-center justify-center text-white font-semibold flex-shrink-0">
                <Briefcase className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-[#223149] text-base">{pd.title}</h2>
                <p className="text-xs text-[#9BADB7] mt-0.5">Version {pd.version}</p>
              </div>
              <div className="flex-shrink-0">
                {pd.acknowledged ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    <CheckCircle className="w-3 h-3" />
                    Acknowledged
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                    <Clock className="w-3 h-3" />
                    Pending
                  </span>
                )}
              </div>
            </div>
          </div>
        </Link>
      </div>
    );
  }

  // Admin view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Briefcase className="w-6 h-6 text-[#223149]" />
          <h1 className="text-2xl font-bold text-[#223149]">Position Descriptions</h1>
        </div>
        <button
          onClick={openModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Position Description
        </button>
      </div>
      <PageSubtitle pageKey="position-descriptions" defaultDescription="Manage and maintain job descriptions and role responsibilities for all staff." />

      {/* PD List */}
      {pds.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-10 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#ECE3DF] flex items-center justify-center">
            <Briefcase className="w-8 h-8 text-[#9BADB7]" />
          </div>
          <h2 className="text-lg font-semibold text-[#223149]">No position descriptions yet</h2>
          <p className="text-sm text-[#9BADB7]">Create one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pds.map((pd: any) => (
            <Link key={pd.id} href={`/dashboard/position-descriptions/${pd.id}`}>
              <div className="bg-white rounded-2xl shadow-sm p-5 hover:shadow-md transition-shadow cursor-pointer h-full">
                <div className="flex items-start gap-4">
                  <AvatarInitial
                    name={pd.assigned_staff?.full_name || "?"}
                    avatarUrl={pd.assigned_staff?.avatar_url}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#223149] text-sm leading-tight truncate">
                      {pd.assigned_staff?.full_name || "Unknown"}
                    </p>
                    <p className="text-xs text-[#9BADB7] truncate">{pd.assigned_staff?.email}</p>
                    <p className="text-sm font-medium text-[#5F7C84] mt-1.5 truncate">{pd.title}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-xs text-[#9BADB7] bg-[#F8F6F4] px-2 py-0.5 rounded-full">
                        v{pd.version}
                      </span>
                      {pd.acknowledged ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          <CheckCircle className="w-3 h-3" />
                          Acknowledged
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                          <Clock className="w-3 h-3" />
                          Pending
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* New PD Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:pb-6 w-full md:max-w-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#223149]">New Position Description</h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg hover:bg-[#F8F6F4] transition-colors"
              >
                <X className="w-4 h-4 text-[#9BADB7]" />
              </button>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#223149] mb-1.5">
                Assign to Staff Member
              </label>
              <select
                value={staffPickerId}
                onChange={(e) => setStaffPickerId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors bg-white"
              >
                <option value="">Select staff member...</option>
                {allStaff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} ({s.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#223149] mb-1.5">
                Position Title
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Youth Pastor"
                className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#223149] mb-1.5">
                Content
              </label>
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={16}
                className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] font-mono text-xs placeholder:text-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors resize-y"
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="flex-1 px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50"
              >
                {submitting ? "Creating..." : "Create Position Description"}
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2.5 border border-[#ECE3DF] text-[#5F7C84] rounded-xl text-sm font-semibold hover:bg-[#F8F6F4] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
