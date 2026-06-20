"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import StaffSignoffSelector from "@/components/ui/StaffSignoffSelector";

export default function EditPolicyPage() {
  const { id } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    content_drive_url: "",
    requires_signoff: true,
    version: 1,
  });
  const [requiredSignatories, setRequiredSignatories] = useState<string[] | null>(null);

  useEffect(() => {
    fetch(`/api/policies/${id}`)
      .then((r) => r.json())
      .then((d) => {
        const p = d.policy;
        setForm({
          title: p.title || "",
          description: p.description || "",
          content_drive_url: p.content_drive_url || "",
          requires_signoff: p.requires_signoff ?? true,
          version: p.version || 1,
        });
        setRequiredSignatories(p.required_signatories ?? null);
        setLoading(false);
      });
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/policies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          content_drive_url: form.content_drive_url,
          requires_signoff: form.requires_signoff,
          new_version: form.version,
          bump_version: false,
          required_signatories: requiredSignatories,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      router.push(`/dashboard/policies/${id}`);
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
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/policies/${id}`} className="p-2 rounded-xl hover:bg-[#ECE3DF] transition-colors">
          <ArrowLeft className="w-5 h-5 text-[#223149]" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-[#223149]">Edit Policy</h1>
          <p className="text-[#50676E] mt-1 text-sm">Changes are saved immediately — use "New Version" to notify staff to re-sign</p>
        </div>
      </div>

      <div className={`grid gap-6 items-start ${form.requires_signoff ? "grid-cols-1 lg:grid-cols-[1fr_360px]" : "grid-cols-1 max-w-2xl"}`}>
        {/* Left — main form fields */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
          )}

          <div>
            <label htmlFor="policy-title" className="block text-sm font-semibold text-[#223149] mb-1.5">
              Policy Title <span className="text-red-400">*</span>
            </label>
            <input id="policy-title"
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-semibold text-[#223149] mb-1.5">Description</label>
            <textarea id="description"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#6E8189] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors resize-none"
            />
          </div>

          <div>
            <label htmlFor="google-drive-link" className="block text-sm font-semibold text-[#223149] mb-1.5">Google Drive Link</label>
            <div className="relative">
              <input id="google-drive-link"
                type="url"
                value={form.content_drive_url}
                onChange={(e) => setForm({ ...form, content_drive_url: e.target.value })}
                placeholder="https://docs.google.com/..."
                className="w-full px-4 py-2.5 pr-10 rounded-xl border border-[#ECE3DF] text-[#223149] placeholder:text-[#6E8189] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
              />
              {form.content_drive_url && (
                <a href={form.content_drive_url} target="_blank" rel="noopener noreferrer"
                  className="absolute right-3 top-1/2 -translate-y-1/2">
                  <ExternalLink className="w-4 h-4 text-[#50676E] hover:text-[#223149]" />
                </a>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="version-number" className="block text-sm font-semibold text-[#223149] mb-1.5">Version Number</label>
            <input id="version-number"
              type="number"
              min={0.1}
              step={0.1}
              value={form.version}
              onChange={(e) => setForm({ ...form, version: parseFloat(e.target.value) || 1 })}
              className="w-32 px-4 py-2.5 rounded-xl border border-[#ECE3DF] text-[#223149] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
            />
            <p className="text-xs text-[#50676E] mt-1">
              Changing the version here won't notify staff. Use "New Version" on the policy page to notify staff to re-sign.
            </p>
          </div>

          <div className="flex items-start gap-3 p-4 bg-[#F8F6F4] rounded-xl">
            <input
              type="checkbox"
              id="requires_signoff"
              checked={form.requires_signoff}
              onChange={(e) => setForm({ ...form, requires_signoff: e.target.checked })}
              className="mt-0.5 w-4 h-4 rounded accent-[#223149]"
            />
            <div>
              <label htmlFor="requires_signoff" className="text-sm font-semibold text-[#223149] cursor-pointer">
                Requires staff sign-off
              </label>
              <p className="text-xs text-[#50676E] mt-0.5">
                {form.requires_signoff ? "Select who needs to sign in the panel →" : "Staff will not be asked to acknowledge this policy"}
              </p>
            </div>
          </div>

          {/* On mobile, show selector inline below the checkbox */}
          {form.requires_signoff && (
            <div className="lg:hidden">
              <label className="block text-sm font-semibold text-[#223149] mb-2">Who needs to sign?</label>
              <StaffSignoffSelector value={requiredSignatories} onChange={setRequiredSignatories} />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-6 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <Link
              href={`/dashboard/policies/${id}`}
              className="px-6 py-2.5 border border-[#ECE3DF] text-[#50676E] rounded-xl text-sm font-semibold hover:bg-[#F8F6F4] transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>

        {/* Right — staff selector panel (desktop only) */}
        {form.requires_signoff && (
          <div className="hidden lg:block bg-white rounded-2xl border border-[#ECE3DF] shadow-sm p-6 sticky top-6">
            <h2 className="text-sm font-semibold text-[#223149] mb-3">Who needs to sign?</h2>
            <StaffSignoffSelector value={requiredSignatories} onChange={setRequiredSignatories} tall />
          </div>
        )}
      </div>
    </div>
  );
}
