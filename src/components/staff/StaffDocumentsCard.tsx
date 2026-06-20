"use client";

import { useEffect, useState } from "react";
import {
  FileArchive,
  FileText,
  Image,
  Eye,
  Download,
  Trash2,
  Upload,
  AlertCircle,
  Clock,
  X,
} from "lucide-react";
import DropZone from "@/components/ui/DropZone";

const VISIBILITY_OPTIONS = [
  { key: "admin",   label: "HR Admin",  description: "Always included" },
  { key: "self",    label: "Employee",  description: "The staff member themselves" },
  { key: "manager", label: "Managers",  description: "Managers with Manage Staff permission" },
] as const;

type VisibilityKey = typeof VISIBILITY_OPTIONS[number]["key"];

interface StaffDocument {
  id: string;
  staff_id: string;
  title: string;
  category: string;
  file_path: string;
  file_name: string;
  expiry_date: string | null;
  notes: string | null;
  uploaded_by: string;
  created_at: string;
  visibility: VisibilityKey[] | null;
  uploader: { full_name: string } | null;
  signedUrl: string | null;
}

interface Props {
  staffId: string;
  staffName: string;
  canUpload: boolean;
  isOwnProfile: boolean;
  callerId?: string; // logged-in user's staff ID (for uploader check)
}

const CATEGORIES = [
  { key: "wwc", label: "Working with Children Check" },
  { key: "first_aid", label: "First Aid / CPR" },
  { key: "qualification", label: "Qualification / Degree" },
  { key: "other", label: "Other" },
];

function getCategoryLabel(key: string): string {
  return CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

function getCategoryBadgeClass(key: string): string {
  switch (key) {
    case "wwc":
      return "bg-blue-100 text-blue-700";
    case "first_aid":
      return "bg-red-100 text-red-700";
    case "qualification":
      return "bg-purple-100 text-purple-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

type ExpiryStatus =
  | null
  | { status: "expired"; label: string; daysAgo: number }
  | { status: "expiring"; label: string }
  | { status: "ok"; label: string };

function getExpiryStatus(expiryDate: string | null): ExpiryStatus {
  if (!expiryDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  const msPerDay = 1000 * 60 * 60 * 24;
  const days = Math.ceil((expiry.getTime() - today.getTime()) / msPerDay);

  if (days <= 0) {
    return { status: "expired", label: "Expired", daysAgo: Math.abs(days) };
  }
  if (days <= 30) {
    return { status: "expiring", label: `Expires in ${days} day${days === 1 ? "" : "s"}` };
  }
  const formatted = expiry.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return { status: "ok", label: `Expires ${formatted}` };
}

function FileIcon({ fileName }: { fileName: string }) {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const isImage = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext);
  if (isImage) {
    return <Image className="w-5 h-5 text-[#50676E] flex-shrink-0" />;
  }
  return <FileText className="w-5 h-5 text-[#50676E] flex-shrink-0" />;
}

export default function StaffDocumentsCard({ staffId, staffName, canUpload, isOwnProfile, callerId }: Props) {
  const [documents, setDocuments] = useState<StaffDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Upload form state
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("other");
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [visibility, setVisibility] = useState<VisibilityKey[]>(["admin", "self"]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Inline visibility editing
  const [editingVisId, setEditingVisId] = useState<string | null>(null);
  const [editingVis, setEditingVis] = useState<VisibilityKey[]>([]);
  const [savingVis, setSavingVis] = useState(false);

  const toggleVisKey = (key: VisibilityKey, arr: VisibilityKey[], setter: (v: VisibilityKey[]) => void) => {
    if (key === "admin") return; // always required
    setter(arr.includes(key) ? arr.filter(k => k !== key) : [...arr, key]);
  };

  const saveVisibility = async (docId: string) => {
    setSavingVis(true);
    await fetch(`/api/staff/${staffId}/documents/${docId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibility: editingVis }),
    });
    setDocuments(prev => prev.map(d => d.id === docId ? { ...d, visibility: editingVis } : d));
    setEditingVisId(null);
    setSavingVis(false);
  };

  useEffect(() => {
    fetchDocuments();
  }, [staffId]);

  async function fetchDocuments() {
    setLoading(true);
    try {
      const res = await fetch(`/api/staff/${staffId}/documents`);
      if (!res.ok) throw new Error("Failed to load documents");
      const data = await res.json();
      setDocuments(data.documents ?? []);
    } catch {
      setError("Could not load documents.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setUploadError("Please select a file.");
      return;
    }
    if (!title.trim()) {
      setUploadError("Title is required.");
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("category", category);
      formData.append("file", file);
      formData.append("visibility", visibility.join(","));
      if (expiryDate) formData.append("expiry_date", expiryDate);
      if (notes.trim()) formData.append("notes", notes.trim());

      const res = await fetch(`/api/staff/${staffId}/documents`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Upload failed");
      }

      // Reset form and close modal
      setTitle("");
      setCategory("other");
      setExpiryDate("");
      setNotes("");
      setFile(null);
      setVisibility(["admin", "self"]);
      setShowUpload(false);

      // Refresh list
      await fetchDocuments();
    } catch (err: any) {
      setUploadError(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(docId: string) {
    setDeleteError(null);
    try {
      const res = await fetch(`/api/staff/${staffId}/documents/${docId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Delete failed");
      }
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err: any) {
      setDeleteError(err.message ?? "Could not delete document");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileArchive className="w-4 h-4 text-[#50676E]" />
            <h3 className="text-sm font-semibold text-[#223149]">Documents</h3>
          </div>
          {canUpload && (
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold bg-[#223149] text-white hover:bg-[#1a2739] transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload
            </button>
          )}
        </div>

        {/* Body */}
        {deleteError && (
          <div className="mb-3 flex items-start justify-between gap-2 rounded-xl bg-red-50 px-3 py-2">
            <p className="text-sm text-red-600">{deleteError}</p>
            <button
              onClick={() => setDeleteError(null)}
              aria-label="Dismiss error"
              className="text-red-400 hover:text-red-600 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {loading ? (
          <p className="text-sm text-[#50676E]">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center py-8 gap-2 text-[#50676E]">
            <FileArchive className="w-8 h-8" />
            <p className="text-sm">No documents uploaded yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => {
              const expiry = getExpiryStatus(doc.expiry_date);
              return (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-3 bg-[#F8F6F4] rounded-xl"
                >
                  {/* Clickable area — opens file in browser */}
                  <a
                    href={doc.signedUrl ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 flex-1 min-w-0 group"
                    title="Click to view"
                  >
                    <FileIcon fileName={doc.file_name} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-[#223149] group-hover:underline truncate">
                          {doc.title}
                        </span>
                        <span
                          className={`rounded-full text-xs px-2.5 py-0.5 font-medium ${getCategoryBadgeClass(doc.category)}`}
                        >
                          {getCategoryLabel(doc.category)}
                        </span>
                      </div>
                      {/* Visibility badges */}
                      {editingVisId === doc.id ? (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {VISIBILITY_OPTIONS.map(opt => (
                            <button
                              key={opt.key}
                              type="button"
                              disabled={opt.key === "admin"}
                              onClick={() => toggleVisKey(opt.key, editingVis, setEditingVis)}
                              className={`text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors ${
                                editingVis.includes(opt.key)
                                  ? "bg-[#223149] text-white border-[#223149]"
                                  : "border-[#ECE3DF] text-[#50676E] hover:border-[#9BADB7]"
                              } ${opt.key === "admin" ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                            >
                              {opt.label}
                            </button>
                          ))}
                          <button onClick={() => saveVisibility(doc.id)} disabled={savingVis}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-50">
                            {savingVis ? "…" : "Save"}
                          </button>
                          <button onClick={() => setEditingVisId(null)}
                            className="text-[10px] px-2 py-0.5 rounded-full border border-[#ECE3DF] text-[#50676E] hover:bg-[#F8F6F4]">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] text-[#50676E]">Visible to:</span>
                          {(doc.visibility ?? ["admin", "self"]).map((v: string) => {
                            const opt = VISIBILITY_OPTIONS.find(o => o.key === v);
                            return opt ? (
                              <span key={v} className="text-[10px] px-2 py-0.5 rounded-full bg-[#ECE3DF] text-[#50676E] font-medium">
                                {opt.label}
                              </span>
                            ) : null;
                          })}
                          {/* Edit visibility — only uploader or admin */}
                          {(callerId === doc.uploaded_by || canUpload) && (
                            <button
                              onClick={() => { setEditingVisId(doc.id); setEditingVis(doc.visibility ?? ["admin", "self"]); }}
                              className="text-[10px] text-[#50676E] hover:text-[#223149] transition-colors underline"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      )}

                      {/* Uploaded by + timestamp */}
                      <p className="text-[10px] text-[#50676E] mt-0.5">
                        Uploaded by {doc.uploader?.full_name ?? "unknown"} · {new Date(doc.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}{" "}
                        {new Date(doc.created_at).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true })}
                      </p>

                      {/* Expiry status */}
                      {expiry && (
                        <div className="mt-1">
                          {expiry.status === "expired" && (
                            <span className="inline-flex items-center gap-1 rounded-full text-xs px-2.5 py-0.5 font-medium bg-red-100 text-red-700">
                              <AlertCircle className="w-3 h-3" />
                              Expired {expiry.daysAgo} day{expiry.daysAgo === 1 ? "" : "s"} ago
                            </span>
                          )}
                          {expiry.status === "expiring" && (
                            <span className="inline-flex items-center gap-1 rounded-full text-xs px-2.5 py-0.5 font-medium bg-amber-100 text-amber-700">
                              <Clock className="w-3 h-3" />
                              {expiry.label}
                            </span>
                          )}
                          {expiry.status === "ok" && (
                            <span className="text-xs text-[#50676E]">{expiry.label}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </a>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {doc.signedUrl && (
                      <>
                        <a
                          href={doc.signedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-xl text-[#50676E] hover:bg-[#ECE3DF] transition-colors"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </a>
                        <a
                          href={doc.signedUrl}
                          download={doc.file_name}
                          className="p-2 rounded-xl text-[#50676E] hover:bg-[#ECE3DF] transition-colors"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </>
                    )}
                    {canUpload && (
                      deletingId === doc.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(doc.id)}
                            className="text-xs px-2 py-1 rounded-lg bg-red-100 text-red-700 font-medium hover:bg-red-200 transition-colors"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeletingId(null)}
                            className="text-xs px-2 py-1 rounded-lg bg-[#ECE3DF] text-[#50676E] font-medium hover:bg-[#d9d0cc] transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeletingId(doc.id)}
                          className="p-2 rounded-xl text-[#50676E] hover:bg-red-50 hover:text-red-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !uploading && setShowUpload(false)}
          />

          {/* Sheet / modal */}
          <div className="relative w-full sm:max-w-lg bg-white sm:rounded-2xl rounded-t-2xl shadow-xl p-6 z-10 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-[#223149]">
                Upload document — {staffName}
              </h2>
              <button
                onClick={() => !uploading && setShowUpload(false)}
                className="p-1.5 rounded-xl text-[#50676E] hover:bg-[#ECE3DF] transition-colors"
                disabled={uploading}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpload} className="space-y-4">
              {/* Title */}
              <div>
                <label htmlFor="title" className="block text-xs font-medium text-[#50676E] mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Working with Children Check"
                  required
                  className="w-full px-3 py-2.5 rounded-xl border border-[#ECE3DF] text-sm text-[#223149] placeholder-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149]"
                />
              </div>

              {/* Category */}
              <div>
                <label htmlFor="category" className="block text-xs font-medium text-[#50676E] mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <select id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 rounded-xl border border-[#ECE3DF] text-sm text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] bg-white"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Expiry date */}
              <div>
                <label htmlFor="expiry-date" className="block text-xs font-medium text-[#50676E] mb-1">
                  Expiry date <span className="text-[#50676E] font-normal">(optional)</span>
                </label>
                <input id="expiry-date"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#ECE3DF] text-sm text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149]"
                />
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="notes" className="block text-xs font-medium text-[#50676E] mb-1">
                  Notes <span className="text-[#50676E] font-normal">(optional)</span>
                </label>
                <textarea id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Any additional notes…"
                  className="w-full px-3 py-2.5 rounded-xl border border-[#ECE3DF] text-sm text-[#223149] placeholder-[#9BADB7] resize-none focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149]"
                />
              </div>

              {/* Visibility */}
              <div>
                <label className="block text-xs font-medium text-[#50676E] mb-2">
                  Visible to
                </label>
                <div className="space-y-2">
                  {VISIBILITY_OPTIONS.map(opt => (
                    <label key={opt.key} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors ${
                      visibility.includes(opt.key) ? "bg-[#223149]/5 border-[#223149]/20" : "border-[#ECE3DF] hover:bg-[#F8F6F4]"
                    } ${opt.key === "admin" ? "opacity-70 cursor-not-allowed" : ""}`}>
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                        visibility.includes(opt.key) ? "bg-[#223149] border-[#223149]" : "border-[#9BADB7]"
                      }`}>
                        {visibility.includes(opt.key) && (
                          <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10"><path d="M1.5 5l2.5 2.5L8.5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
                        )}
                      </div>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={visibility.includes(opt.key)}
                        disabled={opt.key === "admin"}
                        onChange={() => toggleVisKey(opt.key, visibility, setVisibility)}
                      />
                      <div>
                        <p className="text-sm font-medium text-[#223149]">{opt.label}</p>
                        <p className="text-xs text-[#50676E]">{opt.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* File */}
              <div>
                <label className="block text-xs font-medium text-[#50676E] mb-1">
                  File <span className="text-red-500">*</span>
                </label>
                <DropZone
                  file={file}
                  onChange={setFile}
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  label="PDF or image"
                />
              </div>

              {uploadError && (
                <p className="text-sm text-red-600">{uploadError}</p>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => !uploading && setShowUpload(false)}
                  disabled={uploading}
                  className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold border border-[#ECE3DF] text-[#50676E] hover:bg-[#F8F6F4] transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold bg-[#223149] text-white hover:bg-[#1a2739] transition-colors disabled:opacity-60"
                >
                  {uploading ? "Uploading…" : "Upload"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
