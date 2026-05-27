"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  FileSignature,
  CheckCircle,
  Clock,
  Download,
  RefreshCw,
  Users,
  X,
  Check,
  Trash2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { format } from "date-fns";
import Image from "next/image";

export default function ContractDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [data, setData] = useState<any>(null);
  const [signedUrl, setSignedUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);

  // Sign state
  const [hasRead, setHasRead] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState("");

  // Assign modal
  const [showAssign, setShowAssign] = useState(false);
  const [allStaff, setAllStaff] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);

  // Delete state
  const [deleting, setDeleting] = useState(false);

  const fetchContract = useCallback(() => {
    setLoading(true);
    fetch(`/api/contracts/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setData(null);
        } else {
          setData(d);
          setSignedUrl(d.signedUrl);
        }
        setLoading(false);
      });
  }, [id]);

  useEffect(() => { fetchContract(); }, [fetchContract]);

  const reloadPdf = async () => {
    setReloading(true);
    const res = await fetch(`/api/contracts/${id}`);
    const d = await res.json();
    if (!d.error) {
      setSignedUrl(d.signedUrl);
      setData(d);
    }
    setReloading(false);
  };

  const handleSign = async () => {
    if (!hasRead || nameInput.trim().length < 2) return;
    setSigning(true);
    setSignError("");
    try {
      const res = await fetch(`/api/contracts/${id}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name_as_typed: nameInput.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed to sign");
      fetchContract();
    } catch (err: any) {
      setSignError(err.message);
    } finally {
      setSigning(false);
    }
  };

  const openAssignModal = async () => {
    const res = await fetch("/api/staff");
    const staff = await res.json();
    const assignedIds = new Set((data?.assignments ?? []).map((a: any) => a.staff_id));
    setAllStaff(Array.isArray(staff) ? staff.filter((s: any) => s.is_active) : []);
    setSelectedIds(new Set(assignedIds));
    setShowAssign(true);
  };

  const handleAssign = async () => {
    setAssigning(true);
    const res = await fetch(`/api/contracts/${id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staff_ids: Array.from(selectedIds) }),
    });
    if (res.ok) {
      setShowAssign(false);
      fetchContract();
    }
    setAssigning(false);
  };

  const handleRemoveAssignment = async (staffId: string) => {
    if (!confirm("Remove this assignment?")) return;
    await fetch(`/api/contracts/${id}/assign?staff_id=${staffId}`, { method: "DELETE" });
    fetchContract();
  };

  const handleToggleActive = async () => {
    if (!data?.contract) return;
    const newActive = !data.contract.is_active;
    if (!confirm(newActive ? "Re-activate this contract?" : "Deactivate this contract? Staff will no longer see it.")) return;
    await fetch(`/api/contracts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: newActive }),
    });
    fetchContract();
  };

  const handleDelete = async () => {
    if (!confirm("Permanently delete this contract and its file? This cannot be undone.")) return;
    setDeleting(true);
    const res = await fetch(`/api/contracts/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/dashboard/contracts");
    } else {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#223149] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data?.contract) {
    return <div className="text-[#9BADB7]">Contract not found or you do not have access.</div>;
  }

  const { contract, assignments, mySignature, role, staffId } = data;
  const isSigned = !!mySignature;
  const signedCount = (assignments ?? []).filter((a: any) => !!a.signature).length;
  const totalAssigned = (assignments ?? []).length;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/contracts"
          className="p-2 rounded-xl hover:bg-[#ECE3DF] transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-[#223149]" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-bold text-[#223149]">{contract.title}</h1>
            {!contract.is_active && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">Inactive</span>
            )}
          </div>
          {contract.description && (
            <p className="text-[#5F7C84] mt-1 text-sm">{contract.description}</p>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">
        {/* LEFT — PDF Viewer */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#ECE3DF]">
            <div className="flex items-center gap-2">
              <FileSignature className="w-4 h-4 text-[#9BADB7]" />
              <span className="text-sm font-semibold text-[#223149]">{contract.file_name}</span>
            </div>
            <button
              onClick={reloadPdf}
              disabled={reloading}
              className="flex items-center gap-1.5 text-xs text-[#5F7C84] hover:text-[#223149] transition-colors"
              title="Reload PDF (URL expires after 1 hour)"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${reloading ? "animate-spin" : ""}`} />
              Reload PDF
            </button>
          </div>
          {signedUrl ? (
            <iframe
              src={signedUrl}
              className="w-full h-[600px] border-0"
              title={contract.title}
            />
          ) : (
            <div className="flex items-center justify-center h-[600px] text-[#9BADB7] text-sm">
              Unable to load PDF. Try reloading.
            </div>
          )}
          <div className="px-5 py-3 border-t border-[#ECE3DF] text-xs text-[#9BADB7]">
            Uploaded {format(new Date(contract.created_at), "d MMM yyyy")}
            {contract.created_by_staff?.full_name && ` by ${contract.created_by_staff.full_name}`}
            {" · "}
            <span>PDF URL expires after 1 hour — use Reload PDF if needed</span>
          </div>
        </div>

        {/* RIGHT — Action panel */}
        <div className="space-y-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto">

          {/* Status / sign card */}
          <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
            <div>
              <p className="text-xs font-semibold text-[#9BADB7] uppercase tracking-wide mb-1">Status</p>
              {isSigned ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-green-50 text-green-700 border border-green-200">
                  <CheckCircle className="w-4 h-4" />
                  Signed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-amber-50 text-amber-700 border border-amber-200">
                  <Clock className="w-4 h-4" />
                  Awaiting signature
                </span>
              )}
            </div>

            {/* Staff: sign or confirmed */}
            {role !== "admin" && (
              <>
                {isSigned ? (
                  <div className="pt-3 border-t border-[#ECE3DF] flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#223149]">
                        Signed by {mySignature.name_as_typed}
                      </p>
                      <p className="text-xs text-[#9BADB7] mt-0.5">
                        {format(new Date(mySignature.signed_at), "d MMM yyyy, h:mm a")}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="pt-3 border-t border-[#ECE3DF] space-y-4">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="hasRead"
                        checked={hasRead}
                        onChange={(e) => setHasRead(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded border-[#9BADB7] accent-[#223149] cursor-pointer"
                      />
                      <label htmlFor="hasRead" className="text-sm text-[#5F7C84] cursor-pointer leading-snug">
                        I have read and understood this document
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-[#223149] mb-1.5">
                        Type your full name to sign
                      </label>
                      <input
                        type="text"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        placeholder="Your full name"
                        className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] italic placeholder:text-[#9BADB7] placeholder:not-italic focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors font-serif"
                      />
                    </div>

                    {signError && <p className="text-sm text-red-500">{signError}</p>}

                    <button
                      onClick={handleSign}
                      disabled={signing || !hasRead || nameInput.trim().length < 2}
                      className="w-full px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {signing ? "Signing…" : "Sign Contract"}
                    </button>

                    <p className="text-xs text-[#9BADB7] leading-relaxed">
                      By signing, you agree this constitutes a valid electronic signature under the{" "}
                      <em>Electronic Transactions Act 1999</em>.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Admin: download */}
            {role === "admin" && signedUrl && (
              <div className="pt-3 border-t border-[#ECE3DF]">
                <a
                  href={signedUrl}
                  download={contract.file_name}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-[#5F7C84] hover:text-[#223149] transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </a>
              </div>
            )}
          </div>

          {/* Admin: assignment tracker */}
          {role === "admin" && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#ECE3DF] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#9BADB7]" />
                  <span className="font-semibold text-[#223149] text-sm">
                    Assignments
                  </span>
                  <span className="text-xs text-[#9BADB7]">
                    {signedCount}/{totalAssigned} signed
                  </span>
                </div>
                <button
                  onClick={openAssignModal}
                  className="text-xs font-semibold text-[#5F7C84] hover:text-[#223149] transition-colors"
                >
                  + Assign Staff
                </button>
              </div>

              {(assignments ?? []).length === 0 ? (
                <div className="px-5 py-6 text-center text-sm text-[#9BADB7]">
                  No staff assigned yet.
                  <button
                    onClick={openAssignModal}
                    className="block mx-auto mt-1 text-[#223149] underline text-xs"
                  >
                    Assign now
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-[#ECE3DF]">
                  {(assignments ?? []).map((a: any) => {
                    const signed = !!a.signature;
                    return (
                      <div key={a.id} className="flex items-center gap-3 px-5 py-3">
                        <StaffAvatar name={a.staff?.full_name} avatar={a.staff?.avatar_url} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#223149] truncate">
                            {a.staff?.full_name}
                          </p>
                          {signed ? (
                            <p className="text-xs text-green-600">
                              Signed {format(new Date(a.signature.signed_at), "d MMM yyyy")}
                            </p>
                          ) : (
                            <p className="text-xs text-[#9BADB7]">Pending</p>
                          )}
                        </div>
                        {signed ? (
                          <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <button
                            onClick={() => handleRemoveAssignment(a.staff_id)}
                            className="p-1 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0"
                            title="Remove assignment"
                          >
                            <X className="w-3.5 h-3.5 text-[#9BADB7] hover:text-red-500" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Admin: danger zone */}
          {role === "admin" && (
            <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
              <p className="text-xs font-semibold text-[#9BADB7] uppercase tracking-wide">Admin Actions</p>
              <button
                onClick={handleToggleActive}
                className="flex items-center gap-2 text-sm text-[#5F7C84] hover:text-[#223149] transition-colors"
              >
                {contract.is_active
                  ? <ToggleRight className="w-4 h-4 text-green-500" />
                  : <ToggleLeft className="w-4 h-4 text-[#9BADB7]" />}
                {contract.is_active ? "Deactivate contract" : "Re-activate contract"}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 text-sm text-red-400 hover:text-red-600 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? "Deleting…" : "Delete contract"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Assign Staff Modal */}
      {showAssign && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-xl w-full md:max-w-md pb-safe max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#ECE3DF] flex-shrink-0">
              <h2 className="text-lg font-bold text-[#223149]">Assign Staff</h2>
              <button
                onClick={() => setShowAssign(false)}
                className="p-2 rounded-xl hover:bg-[#F8F6F4] transition-colors"
              >
                <X className="w-5 h-5 text-[#5F7C84]" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
              {allStaff.map((s: any) => {
                const checked = selectedIds.has(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      const next = new Set(selectedIds);
                      if (checked) next.delete(s.id);
                      else next.add(s.id);
                      setSelectedIds(next);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left ${
                      checked ? "bg-[#223149]/5" : "hover:bg-[#F8F6F4]"
                    }`}
                  >
                    <StaffAvatar name={s.full_name} avatar={s.avatar_url} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#223149] truncate">{s.full_name}</p>
                      <p className="text-xs text-[#9BADB7] truncate">{s.email}</p>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        checked
                          ? "bg-[#223149] border-[#223149]"
                          : "border-[#9BADB7]"
                      }`}
                    >
                      {checked && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="px-6 py-4 border-t border-[#ECE3DF] flex gap-3 flex-shrink-0">
              <button
                onClick={handleAssign}
                disabled={assigning || selectedIds.size === 0}
                className="flex-1 px-4 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {assigning ? "Saving…" : `Save (${selectedIds.size} selected)`}
              </button>
              <button
                onClick={() => setShowAssign(false)}
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

function StaffAvatar({ name, avatar }: { name?: string; avatar?: string }) {
  const initials = name
    ? name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  if (avatar) {
    return (
      <Image
        src={avatar}
        alt={name ?? ""}
        width={32}
        height={32}
        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
      />
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-[#ECE3DF] flex items-center justify-center flex-shrink-0">
      <span className="text-xs font-bold text-[#5F7C84]">{initials}</span>
    </div>
  );
}
