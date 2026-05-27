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
} from "lucide-react";
import { format } from "date-fns";

export default function ContractsPage() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [role, setRole] = useState<string>("staff");
  const [loading, setLoading] = useState(true);

  // Upload modal state
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchContracts = () => {
    setLoading(true);
    fetch("/api/contracts")
      .then((r) => r.json())
      .then((d) => {
        setContracts(d.contracts || []);
        setRole(d.role);
        setLoading(false);
      });
  };

  useEffect(() => { fetchContracts(); }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim()) return;
    setUploading(true);
    setUploadError("");

    const fd = new FormData();
    fd.append("title", title.trim());
    fd.append("description", description.trim());
    fd.append("file", file);

    try {
      const res = await fetch("/api/contracts", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Upload failed");
      setShowUpload(false);
      setTitle("");
      setDescription("");
      setFile(null);
      fetchContracts();
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-[#223149]">Contracts</h1>
          <p className="text-[#5F7C84] mt-1 text-sm">
            {role === "admin"
              ? `${contracts.length} ${contracts.length === 1 ? "contract" : "contracts"}`
              : `${contracts.length} assigned to you`}
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

      {/* Empty state */}
      {contracts.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 shadow-sm text-center">
          <FileSignature className="w-10 h-10 text-[#9BADB7] mx-auto mb-3" />
          <p className="text-[#5F7C84] font-medium">
            {role === "admin" ? "No contracts yet" : "No contracts assigned to you"}
          </p>
          {role === "admin" && (
            <button
              onClick={() => setShowUpload(true)}
              className="text-sm text-[#223149] underline mt-1 inline-block"
            >
              Upload your first contract
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {contracts.map((contract) =>
            role === "admin" ? (
              <AdminContractCard key={contract.id} contract={contract} />
            ) : (
              <StaffContractCard key={contract.id} contract={contract} />
            )
          )}
        </div>
      )}

      {/* Upload modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-xl w-full md:max-w-lg pb-safe">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#ECE3DF]">
              <h2 className="text-lg font-bold text-[#223149]">Upload Contract</h2>
              <button
                onClick={() => { setShowUpload(false); setUploadError(""); }}
                className="p-2 rounded-xl hover:bg-[#F8F6F4] transition-colors"
              >
                <X className="w-5 h-5 text-[#5F7C84]" />
              </button>
            </div>
            <form onSubmit={handleUpload} className="p-6 space-y-4">
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
                  disabled={uploading || !file || !title.trim()}
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
                  onClick={() => { setShowUpload(false); setUploadError(""); }}
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
