"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Plus, Upload } from "lucide-react";
import DropZone from "@/components/ui/DropZone";

interface ContractGroup {
  id: string;
  title: string;
  current_version?: { version: number };
}

interface Props {
  staffId: string;
  staffName: string;
}

export default function StaffContractUpload({ staffId, staffName }: Props) {
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<ContractGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);

  // Form state
  const [mode, setMode] = useState<"new" | "version">("new");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const router = useRouter();

  const openModal = () => {
    setOpen(true);
    setError("");
    if (groups.length > 0) return;
    setGroupsLoading(true);
    fetch("/api/contracts")
      .then((r) => r.json())
      .then((d) => setGroups(d.groups ?? []))
      .finally(() => setGroupsLoading(false));
  };

  const closeModal = () => {
    setOpen(false);
    setMode("new");
    setTitle("");
    setDescription("");
    setFile(null);
    setSelectedGroupId("");
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    if (mode === "new" && !title.trim()) return;
    if (mode === "version" && !selectedGroupId) return;

    setUploading(true);
    setError("");

    const fd = new FormData();
    if (mode === "new") {
      fd.append("title", title.trim());
      fd.append("description", description.trim());
    } else {
      const grp = groups.find((g) => g.id === selectedGroupId);
      fd.append("title", grp?.title ?? "");
      fd.append("group_id", selectedGroupId);
    }
    fd.append("file", file);

    try {
      const res = await fetch("/api/contracts", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Upload failed");

      // Assign to this staff member automatically
      await fetch(`/api/contracts/${d.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staff_ids: [staffId] }),
      });

      closeModal();
      router.refresh(); // re-run server component to show the new contract
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <button
        onClick={openModal}
        className="flex items-center gap-1.5 text-xs font-semibold text-[#50676E] hover:text-[#223149] transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        Upload
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-xl w-full md:max-w-md max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#ECE3DF] flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold text-[#223149]">Upload Contract</h2>
                <p className="text-xs text-[#50676E] mt-0.5">Will be assigned to {staffName}</p>
              </div>
              <button
                onClick={closeModal}
                className="p-2 rounded-xl hover:bg-[#F8F6F4] transition-colors"
              >
                <X className="w-5 h-5 text-[#50676E]" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Mode toggle — only show if there are existing groups */}
              {!groupsLoading && groups.length > 0 && (
                <div className="flex gap-2">
                  {(["new", "version"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      className={`flex-1 py-2 text-sm font-semibold rounded-xl border transition-colors ${
                        mode === m
                          ? "bg-[#223149] text-white border-[#223149]"
                          : "text-[#50676E] border-[#ECE3DF] hover:bg-[#F8F6F4]"
                      }`}
                    >
                      {m === "new" ? "New Contract" : "New Version of Existing"}
                    </button>
                  ))}
                </div>
              )}

              {mode === "new" ? (
                <>
                  <div>
                    <label htmlFor="title" className="block text-sm font-semibold text-[#223149] mb-1.5">
                      Title <span className="text-red-400">*</span>
                    </label>
                    <input id="title"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                      autoFocus
                      placeholder="e.g. Employment Agreement 2026"
                      className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#6E8189] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
                    />
                  </div>
                  <div>
                    <label htmlFor="description" className="block text-sm font-semibold text-[#223149] mb-1.5">
                      Description
                      <span className="ml-1 text-xs font-normal text-[#50676E]">(optional)</span>
                    </label>
                    <textarea id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      placeholder="Brief description…"
                      className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#6E8189] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors resize-none"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label htmlFor="contract-group" className="block text-sm font-semibold text-[#223149] mb-1.5">
                    Contract Group <span className="text-red-400">*</span>
                  </label>
                  <select id="contract-group"
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors bg-white"
                  >
                    <option value="">Select an existing contract…</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.title} (currently v{g.current_version?.version ?? "?"})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* File picker */}
              <div>
                <label className="block text-sm font-semibold text-[#223149] mb-1.5">
                  PDF File <span className="text-red-400">*</span>
                </label>
                <DropZone file={file} onChange={setFile} />
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={uploading || !file || (mode === "new" && !title.trim()) || (mode === "version" && !selectedGroupId)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Uploading…</>
                  ) : (
                    <><Upload className="w-4 h-4" /> Upload & Assign</>
                  )}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2.5 border border-[#ECE3DF] text-[#50676E] rounded-xl text-sm font-semibold hover:bg-[#F8F6F4] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
