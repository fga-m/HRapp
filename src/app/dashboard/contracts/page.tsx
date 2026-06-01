"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  FileSignature,
  Plus,
  CheckCircle,
  Clock,
  Upload,
  X,
  FileText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { format } from "date-fns";

export default function ContractsPage() {
  const [groups, setGroups] = useState<any[]>([]);
  const [standalone, setStandalone] = useState<any[]>([]);
  const [staffContracts, setStaffContracts] = useState<any[]>([]);
  const [role, setRole] = useState<string>("staff");
  const [loading, setLoading] = useState(true);

  // Upload modal state
  const [showUpload, setShowUpload] = useState(false);
  const [uploadMode, setUploadMode] = useState<"new" | "version">("new");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchContracts = () => {
    setLoading(true);
    fetch("/api/contracts")
      .then((r) => r.json())
      .then((d) => {
        if (d.role === "admin") {
          setGroups(d.groups || []);
          setStandalone(d.standalone || []);
        } else {
          setStaffContracts(d.contracts || []);
        }
        setRole(d.role);
        setLoading(false);
      });
  };

  useEffect(() => { fetchContracts(); }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    if (uploadMode === "new" && !title.trim()) return;
    if (uploadMode === "version" && !selectedGroupId) return;

    setUploading(true);
    setUploadError("");

    const fd = new FormData();

    if (uploadMode === "new") {
      fd.append("title", title.trim());
      fd.append("description", description.trim());
    } else {
      // Find the group title for the new version
      const grp = groups.find((g: any) => g.id === selectedGroupId);
      fd.append("title", grp?.title ?? "");
      fd.append("group_id", selectedGroupId);
    }
    fd.append("file", file);

    try {
      const res = await fetch("/api/contracts", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Upload failed");
      setShowUpload(false);
      setTitle("");
      setDescription("");
      setFile(null);
      setSelectedGroupId("");
      setUploadMode("new");
      fetchContracts();
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const totalGroupContracts = groups.length;
  const totalStandalone = standalone.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#223149] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-[#223149]">Contracts</h1>
          <p className="text-[#5F7C84] mt-1 text-sm">
            {role === "admin"
              ? `${totalGroupContracts} ${totalGroupContracts === 1 ? "group" : "groups"}${totalStandalone > 0 ? ` · ${totalStandalone} standalone` : ""}`
              : `${staffContracts.length} assigned to you`}
          </p>
        </div>
        {role === "admin" && (
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Upload Contract
          </button>
        )}
      </div>

      {/* Admin view */}
      {role === "admin" && (
        <>
          {groups.length === 0 && standalone.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 shadow-sm text-center">
              <FileSignature className="w-10 h-10 text-[#9BADB7] mx-auto mb-3" />
              <p className="text-[#5F7C84] font-medium">No contracts yet</p>
              <button
                onClick={() => setShowUpload(true)}
                className="text-sm text-[#223149] underline mt-1 inline-block"
              >
                Upload your first contract
              </button>
            </div>
          ) : (
            <>
              {/* Contract groups */}
              {groups.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groups.map((group: any) => (
                    <AdminGroupCard key={group.id} group={group} />
                  ))}
                </div>
              )}

              {/* Standalone contracts */}
              {standalone.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-[#9BADB7] uppercase tracking-wide mb-3">
                    Standalone Contracts
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {standalone.map((contract: any) => (
                      <AdminContractCard key={contract.id} contract={contract} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Staff view */}
      {role !== "admin" && (
        <>
          {staffContracts.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 shadow-sm text-center">
              <FileSignature className="w-10 h-10 text-[#9BADB7] mx-auto mb-3" />
              <p className="text-[#5F7C84] font-medium">No contracts assigned to you</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {staffContracts.map((contract: any) => (
                <StaffContractCard key={contract.id} contract={contract} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Upload modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-xl w-full md:max-w-lg pb-safe">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#ECE3DF]">
              <h2 className="text-lg font-bold text-[#223149]">Upload Contract</h2>
              <button
                onClick={() => { setShowUpload(false); setUploadError(""); setUploadMode("new"); }}
                className="p-2 rounded-xl hover:bg-[#F8F6F4] transition-colors"
              >
                <X className="w-5 h-5 text-[#5F7C84]" />
              </button>
            </div>

            {/* Mode toggle */}
            <div className="px-6 pt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setUploadMode("new")}
                className={`flex-1 py-2 text-sm font-semibold rounded-xl border transition-colors ${
                  uploadMode === "new"
                    ? "bg-[#223149] text-white border-[#223149]"
                    : "text-[#5F7C84] border-[#ECE3DF] hover:bg-[#F8F6F4]"
                }`}
              >
                New Contract
              </button>
              {groups.length > 0 && (
                <button
                  type="button"
                  onClick={() => setUploadMode("version")}
                  className={`flex-1 py-2 text-sm font-semibold rounded-xl border transition-colors ${
                    uploadMode === "version"
                      ? "bg-[#223149] text-white border-[#223149]"
                      : "text-[#5F7C84] border-[#ECE3DF] hover:bg-[#F8F6F4]"
                  }`}
                >
                  New Version of Existing
                </button>
              )}
            </div>

            <form onSubmit={handleUpload} className="p-6 space-y-4">
              {uploadMode === "new" ? (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-[#223149] mb-1.5">
                      Title <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                      placeholder="e.g. Employment Agreement 2025"
                      className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#223149] mb-1.5">
                      Description
                      <span className="ml-1 text-xs font-normal text-[#9BADB7]">(optional)</span>
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      placeholder="Brief description of this contract…"
                      className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors resize-none"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-semibold text-[#223149] mb-1.5">
                    Contract Group <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors bg-white"
                  >
                    <option value="">Select an existing contract…</option>
                    {groups.map((g: any) => (
                      <option key={g.id} value={g.id}>
                        {g.title} (currently v{g.current_version?.version ?? "?"})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-[#9BADB7] mt-1.5">
                    A new version will be created under this contract group.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-[#223149] mb-1.5">
                  PDF File <span className="text-red-400">*</span>
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-[#ECE3DF] rounded-xl p-6 text-center cursor-pointer hover:border-[#223149]/30 hover:bg-[#F8F6F4] transition-colors"
                >
                  {file ? (
                    <div className="flex items-center justify-center gap-2 text-[#223149]">
                      <FileText className="w-5 h-5 text-[#5F7C84]" />
                      <span className="text-sm font-medium truncate max-w-xs">{file.name}</span>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-[#9BADB7] mx-auto mb-2" />
                      <p className="text-sm text-[#5F7C84]">Click to select a PDF</p>
                      <p className="text-xs text-[#9BADB7] mt-1">PDF only</p>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>

              {uploadError && (
                <p className="text-sm text-red-500">{uploadError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={
                    uploading ||
                    !file ||
                    (uploadMode === "new" && !title.trim()) ||
                    (uploadMode === "version" && !selectedGroupId)
                  }
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowUpload(false); setUploadError(""); setUploadMode("new"); }}
                  className="px-4 py-2.5 border border-[#ECE3DF] text-[#5F7C84] rounded-xl text-sm font-semibold hover:bg-[#F8F6F4] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminGroupCard({ group }: { group: any }) {
  const [expanded, setExpanded] = useState(false);
  const current = group.current_version;

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col">
      <Link
        href={current ? `/dashboard/contracts/${current.id}` : "#"}
        className="p-6 flex flex-col gap-3 group hover:bg-[#F8F6F4] transition-colors flex-1"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="w-10 h-10 rounded-xl bg-[#ECE3DF] flex items-center justify-center flex-shrink-0">
            <FileSignature className="w-5 h-5 text-[#223149]" />
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {current && (
              <span className="bg-[#ECE3DF] text-[#223149] text-xs px-2 py-0.5 rounded-full font-semibold">
                v{current.version}
              </span>
            )}
            {current && !current.is_active && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">Inactive</span>
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[#223149] group-hover:underline leading-snug">{group.title}</p>
          {group.description && (
            <p className="text-xs text-[#9BADB7] mt-1 line-clamp-2">{group.description}</p>
          )}
          {current && (
            <p className="text-xs text-[#9BADB7] mt-2">
              Updated {format(new Date(current.created_at), "d MMM yyyy")}
            </p>
          )}
        </div>
        {current && (
          <div className="flex items-center gap-3 pt-2 border-t border-[#ECE3DF]">
            <div className="flex items-center gap-1.5 text-xs text-[#5F7C84]">
              <CheckCircle className="w-3.5 h-3.5 text-green-500" />
              {current.signed_count} signed
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#5F7C84]">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              {current.assigned_count} assigned
            </div>
          </div>
        )}
      </Link>

      {/* History toggle */}
      {group.versions && group.versions.length > 1 && (
        <div className="border-t border-[#ECE3DF]">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-2.5 text-xs font-semibold text-[#5F7C84] hover:bg-[#F8F6F4] transition-colors"
          >
            <span>{expanded ? "Hide" : "Show"} History ({group.versions.length} versions)</span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {expanded && (
            <div className="divide-y divide-[#ECE3DF] border-t border-[#ECE3DF]">
              {group.versions.map((v: any) => (
                <Link
                  key={v.id}
                  href={`/dashboard/contracts/${v.id}`}
                  className="flex items-center justify-between px-5 py-2.5 hover:bg-[#F8F6F4] transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                      v.id === current?.id
                        ? "bg-[#223149] text-white"
                        : "bg-[#ECE3DF] text-[#5F7C84]"
                    }`}>
                      v{v.version}
                    </span>
                    <span className="text-xs text-[#5F7C84] group-hover:underline">
                      {format(new Date(v.created_at), "d MMM yyyy")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#9BADB7]">
                    <span>{v.signed_count}/{v.assigned_count} signed</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AdminContractCard({ contract }: { contract: any }) {
  return (
    <Link
      href={`/dashboard/contracts/${contract.id}`}
      className="bg-white rounded-2xl shadow-sm p-6 hover:shadow-md transition-shadow flex flex-col gap-3 group"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="w-10 h-10 rounded-xl bg-[#ECE3DF] flex items-center justify-center flex-shrink-0">
          <FileSignature className="w-5 h-5 text-[#223149]" />
        </div>
        {!contract.is_active && (
          <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">Inactive</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[#223149] group-hover:underline leading-snug">{contract.title}</p>
        {contract.description && (
          <p className="text-xs text-[#9BADB7] mt-1 line-clamp-2">{contract.description}</p>
        )}
        <p className="text-xs text-[#9BADB7] mt-2">
          Added {format(new Date(contract.created_at), "d MMM yyyy")}
          {contract.created_by_staff?.full_name && ` · ${contract.created_by_staff.full_name}`}
        </p>
      </div>
      <div className="flex items-center gap-3 pt-2 border-t border-[#ECE3DF]">
        <div className="flex items-center gap-1.5 text-xs text-[#5F7C84]">
          <CheckCircle className="w-3.5 h-3.5 text-green-500" />
          {contract.signed_count} signed
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[#5F7C84]">
          <Clock className="w-3.5 h-3.5 text-amber-500" />
          {contract.assigned_count} assigned
        </div>
      </div>
    </Link>
  );
}

function StaffContractCard({ contract }: { contract: any }) {
  const signed = !!contract.my_signature;
  return (
    <Link
      href={`/dashboard/contracts/${contract.id}`}
      className="bg-white rounded-2xl shadow-sm p-6 hover:shadow-md transition-shadow flex flex-col gap-3 group"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="w-10 h-10 rounded-xl bg-[#ECE3DF] flex items-center justify-center flex-shrink-0">
          <FileSignature className="w-5 h-5 text-[#223149]" />
        </div>
        {signed ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
            <CheckCircle className="w-3 h-3" />
            Signed
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3" />
            Awaiting signature
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[#223149] group-hover:underline leading-snug">{contract.title}</p>
        {contract.description && (
          <p className="text-xs text-[#9BADB7] mt-1 line-clamp-2">{contract.description}</p>
        )}
        {signed && contract.my_signature?.signed_at && (
          <p className="text-xs text-green-600 mt-2">
            Signed {format(new Date(contract.my_signature.signed_at), "d MMM yyyy")}
          </p>
        )}
      </div>
    </Link>
  );
}
