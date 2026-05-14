"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, FileText, ChevronRight, CheckCircle, Clock } from "lucide-react";
import { format } from "date-fns";

const TYPE_LABELS: Record<string, string> = {
  "1on1": "1-on-1",
  team: "Team Meeting",
  performance_review: "Performance Review",
  projects_goals: "Projects & Goals",
};

const TYPE_COLOURS: Record<string, string> = {
  "1on1": "bg-blue-100 text-blue-700",
  team: "bg-purple-100 text-purple-700",
  performance_review: "bg-amber-100 text-amber-700",
  projects_goals: "bg-green-100 text-green-700",
};

export default function MeetingsPage() {
  const [notes, setNotes] = useState<any[]>([]);
  const [role, setRole] = useState("staff");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/meetings")
      .then((r) => r.json())
      .then((d) => {
        setNotes(d.notes || []);
        setRole(d.role);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#223149] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#223149]">Meeting Notes</h1>
          <p className="text-[#5F7C84] mt-1 text-sm">
            {role === "admin" ? "Your private meeting notes" : "Notes shared with you"}
          </p>
        </div>
        {role === "admin" && (
          <Link
            href="/dashboard/meetings/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Meeting Note
          </Link>
        )}
      </div>

      {notes.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 shadow-sm text-center">
          <FileText className="w-10 h-10 text-[#9BADB7] mx-auto mb-3" />
          <p className="text-[#5F7C84] font-medium">
            {role === "admin" ? "No meeting notes yet" : "No notes have been shared with you yet"}
          </p>
          {role === "admin" && (
            <Link href="/dashboard/meetings/new" className="text-sm text-[#223149] underline mt-1 inline-block">
              Create your first meeting note
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-[#ECE3DF]">
          {notes.map((note) => (
            <Link
              key={note.id}
              href={`/dashboard/meetings/${note.id}`}
              className="flex items-center gap-4 px-6 py-4 hover:bg-[#F8F6F4] transition-colors group"
            >
              <div className="w-10 h-10 rounded-xl bg-[#ECE3DF] flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-[#223149]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-[#223149] truncate">{note.title}</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${TYPE_COLOURS[note.meeting_type] || "bg-gray-100 text-gray-600"}`}>
                    {TYPE_LABELS[note.meeting_type] || note.meeting_type}
                  </span>
                </div>
                <p className="text-xs text-[#9BADB7] mt-0.5">
                  {format(new Date(note.meeting_date), "d MMM yyyy")}
                  {note.creator?.full_name && role === "staff" && ` · ${note.creator.full_name}`}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {role === "admin" && (
                  note.is_shared_with_staff ? (
                    <span className="flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle className="w-3.5 h-3.5" /> Shared
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-[#9BADB7]">
                      <Clock className="w-3.5 h-3.5" /> Private
                    </span>
                  )
                )}
                <ChevronRight className="w-4 h-4 text-[#9BADB7] group-hover:text-[#223149] transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
