"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

const MEETING_TYPES = [
  { value: "1on1", label: "1-on-1" },
  { value: "team", label: "Team Meeting" },
  { value: "performance_review", label: "Performance Review" },
  { value: "projects_goals", label: "Projects & Goals" },
];

type Template = { id: string; title: string; content: string };

export default function NewMeetingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [staff, setStaff] = useState<any[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [form, setForm] = useState({
    title: "",
    meeting_type: "1on1",
    meeting_date: new Date().toISOString().split("T")[0],
    attendees: [] as string[],
    content: "",
  });

  useEffect(() => {
    fetch("/api/staff").then((r) => r.json()).then(setStaff);
  }, []);

  // Fetch templates for the selected meeting type
  useEffect(() => {
    fetch(`/api/meetings/templates?meeting_type=${form.meeting_type}`)
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates || []))
      .catch(() => setTemplates([]));
  }, [form.meeting_type]);

  const toggleAttendee = (id: string) => {
    setForm((f) => ({
      ...f,
      attendees: f.attendees.includes(id)
        ? f.attendees.filter((a) => a !== id)
        : [...f.attendees, id],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create");
      router.push(`/dashboard/meetings/${data.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Auto-set title based on type + attendee
  useEffect(() => {
    const typeLabel = MEETING_TYPES.find((t) => t.value === form.meeting_type)?.label || "";
    const firstAttendee = staff.find((s) => s.id === form.attendees[0]);
    const name = firstAttendee ? ` with ${firstAttendee.full_name.split(" ")[0]}` : "";
    setForm((f) => ({ ...f, title: `${typeLabel}${name}` }));
  }, [form.meeting_type, form.attendees[0]]);

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/meetings" className="p-2 rounded-xl hover:bg-[#ECE3DF] transition-colors">
          <ArrowLeft className="w-5 h-5 text-[#223149]" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-[#223149]">New Meeting Note</h1>
          <p className="text-[#5F7C84] mt-1 text-sm">Saved privately to your Google Drive</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
        )}

        {loading && (
          <div className="p-4 bg-[#F8F6F4] border border-[#ECE3DF] rounded-xl text-sm text-[#5F7C84] text-center">
            ⏳ Creating Google Doc in your Drive...
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
          {/* Meeting Type */}
          <div>
            <label className="block text-sm font-semibold text-[#223149] mb-2">Meeting Type</label>
            <div className="grid grid-cols-2 gap-2">
              {MEETING_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setForm({ ...form, meeting_type: type.value })}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                    form.meeting_type === type.value
                      ? "bg-[#223149] text-white border-[#223149]"
                      : "bg-white text-[#5F7C84] border-[#ECE3DF] hover:border-[#223149]"
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Template picker */}
          {templates.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-[#223149] mb-2">
                Start from a template{" "}
                <span className="text-xs font-normal text-[#9BADB7]">(optional)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, content: t.content }))}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
                      form.content === t.content
                        ? "bg-[#223149] text-white border-[#223149]"
                        : "border-[#ECE3DF] text-[#5F7C84] hover:border-[#223149] hover:text-[#223149]"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    {t.title}
                  </button>
                ))}
                {form.content && (
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, content: "" }))}
                    className="px-3 py-2 rounded-xl border border-[#ECE3DF] text-xs text-[#9BADB7] hover:border-rose-300 hover:text-rose-500 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Date */}
          <div>
            <label className="block text-sm font-semibold text-[#223149] mb-1.5">Date</label>
            <input
              type="date"
              required
              value={form.meeting_date}
              onChange={(e) => setForm({ ...form, meeting_date: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
            />
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-semibold text-[#223149] mb-1.5">Title</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
            />
          </div>

          {/* Attendees */}
          <div>
            <label className="block text-sm font-semibold text-[#223149] mb-2">Attendees</label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {staff.filter((s) => s.is_active).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleAttendee(s.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors text-left ${
                    form.attendees.includes(s.id)
                      ? "bg-[#223149]/5 border-[#223149]"
                      : "border-[#ECE3DF] hover:border-[#9BADB7]"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    form.attendees.includes(s.id) ? "bg-[#223149] border-[#223149]" : "border-[#9BADB7]"
                  }`}>
                    {form.attendees.includes(s.id) && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div className="w-7 h-7 rounded-full bg-[#223149] flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">
                      {s.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#223149]">{s.full_name}</p>
                    <p className="text-xs text-[#9BADB7]">{s.position || s.department || s.email}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-semibold text-[#223149] mb-1.5">Notes</label>
            <textarea
              rows={8}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="What was discussed? Key decisions, action items, follow-ups..."
              className="w-full px-4 py-3 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors resize-none font-mono text-sm"
            />
            <p className="text-xs text-[#9BADB7] mt-1">This will be saved as a Google Doc in your Drive</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-6 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50"
          >
            {loading ? "Saving to Drive..." : "Save Meeting Note"}
          </button>
          <Link
            href="/dashboard/meetings"
            className="px-6 py-2.5 border border-[#ECE3DF] text-[#5F7C84] rounded-xl text-sm font-semibold hover:bg-[#F8F6F4] transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
