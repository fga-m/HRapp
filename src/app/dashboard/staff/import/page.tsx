"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, RefreshCw, Check, UserPlus, AlertCircle, Search } from "lucide-react";

type GoogleUser = {
  email: string;
  full_name: string;
  avatar_url: string | null;
  already_imported: boolean;
};

export default function ImportStaffPage() {
  const router = useRouter();
  const [users, setUsers] = useState<GoogleUser[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/staff/import");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch users");
      setUsers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggle = (email: string, alreadyImported: boolean) => {
    if (alreadyImported) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const selectAll = () => {
    const available = users.filter((u) => !u.already_imported).map((u) => u.email);
    setSelected(new Set(available));
  };

  const clearAll = () => setSelected(new Set());

  const handleImport = async () => {
    if (!selected.size) return;
    setImporting(true);
    setError("");
    try {
      const toImport = users.filter((u) => selected.has(u.email));
      const res = await fetch("/api/staff/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ users: toImport }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setSuccess(`Successfully imported ${data.imported} staff member${data.imported !== 1 ? "s" : ""}!`);
      setTimeout(() => {
        router.push("/dashboard/staff");
        router.refresh();
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const available = users.filter((u) => !u.already_imported);
  const filteredUsers = users.filter(
    (u) =>
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/staff" className="p-2 rounded-xl hover:bg-[#ECE3DF] transition-colors">
          <ArrowLeft className="w-5 h-5 text-[#223149]" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-[#223149]">Import from Google</h1>
          <p className="text-[#5F7C84] mt-1 text-sm">
            Select staff from your @fgam.org.au Google Workspace
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">Could not fetch Google users</p>
            <p className="text-xs text-red-600 mt-0.5">{error}</p>
            <p className="text-xs text-red-500 mt-1">
              Make sure you're signed in as a Google Workspace admin and the Admin SDK API is enabled.
            </p>
            <button
              onClick={fetchUsers}
              className="mt-2 text-xs font-semibold text-red-700 underline"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Success */}
      {success && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
          <Check className="w-5 h-5 text-green-500" />
          <p className="text-sm font-semibold text-green-800">{success}</p>
        </div>
      )}

      {/* User List */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="px-6 py-4 border-b border-[#ECE3DF] space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9BADB7]" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-[#ECE3DF] text-sm text-[#223149] placeholder:text-[#9BADB7] focus:outline-none focus:ring-2 focus:ring-[#223149]/20 focus:border-[#223149] transition-colors"
            />
          </div>
          {/* Count + actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-[#223149]">
                {loading ? "Loading..." : `${filteredUsers.length} of ${users.length} users`}
              </span>
              {!loading && selected.size > 0 && (
                <span className="text-xs text-[#9BADB7]">({selected.size} selected)</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchUsers}
                className="p-1.5 rounded-lg hover:bg-[#F8F6F4] transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4 text-[#9BADB7]" />
              </button>
              {!loading && available.length > 0 && (
                <>
                  <button onClick={selectAll} className="text-xs font-semibold text-[#223149] hover:underline">
                    Select all
                  </button>
                  <span className="text-[#9BADB7]">·</span>
                  <button onClick={clearAll} className="text-xs font-semibold text-[#5F7C84] hover:underline">
                    Clear
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="px-6 py-12 text-center">
            <div className="inline-block w-6 h-6 border-2 border-[#223149] border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm text-[#9BADB7]">Fetching your Google Workspace users...</p>
          </div>
        ) : filteredUsers.length === 0 && !error ? (
          <div className="px-6 py-12 text-center text-[#9BADB7] text-sm">
            {search ? `No users match "${search}"` : "No users found in your Google Workspace."}
          </div>
        ) : (
          <div className="divide-y divide-[#ECE3DF]">
            {filteredUsers.map((user) => {
              const isSelected = selected.has(user.email);
              const isImported = user.already_imported;
              return (
                <button
                  key={user.email}
                  onClick={() => toggle(user.email, isImported)}
                  disabled={isImported}
                  className={`w-full flex items-center gap-4 px-6 py-4 text-left transition-colors ${
                    isImported
                      ? "opacity-50 cursor-not-allowed"
                      : isSelected
                      ? "bg-[#223149]/5"
                      : "hover:bg-[#F8F6F4]"
                  }`}
                >
                  {/* Checkbox */}
                  <div
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      isImported
                        ? "border-green-400 bg-green-400"
                        : isSelected
                        ? "border-[#223149] bg-[#223149]"
                        : "border-[#9BADB7]"
                    }`}
                  >
                    {(isSelected || isImported) && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </div>

                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-[#223149] flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt={user.full_name} className="w-9 h-9 object-cover" />
                    ) : (
                      <span className="text-white text-xs font-bold">
                        {user.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#223149] text-sm truncate">{user.full_name}</p>
                    <p className="text-xs text-[#9BADB7] truncate">{user.email}</p>
                  </div>

                  {isImported && (
                    <span className="text-xs text-green-600 font-medium flex-shrink-0">Already added</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Import Button */}
      {!loading && selected.size > 0 && (
        <div className="flex gap-3">
          <button
            onClick={handleImport}
            disabled={importing}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#223149] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2638] transition-colors disabled:opacity-50"
          >
            <UserPlus className="w-4 h-4" />
            {importing ? "Importing..." : `Import ${selected.size} staff member${selected.size !== 1 ? "s" : ""}`}
          </button>
          <Link
            href="/dashboard/staff"
            className="px-6 py-2.5 border border-[#ECE3DF] text-[#5F7C84] rounded-xl text-sm font-semibold hover:bg-[#F8F6F4] transition-colors"
          >
            Cancel
          </Link>
        </div>
      )}
    </div>
  );
}
