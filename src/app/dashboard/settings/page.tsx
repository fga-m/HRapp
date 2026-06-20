"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle, XCircle, Loader2, Link2, Link2Off, RefreshCw } from "lucide-react";
import PageSubtitle from "@/components/PageSubtitle";
import { useConfirm } from "@/components/ui/ConfirmDialog";

interface XeroStatus {
  connected: boolean;
  tenantName?: string;
  tenantId?: string;
  connectedAt?: string;
  expiresAt?: string;
}

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const confirm = useConfirm();
  const [xero, setXero] = useState<XeroStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState("");

  const xeroConnected = searchParams.get("xero_connected") === "1";
  const xeroError = searchParams.get("xero_error");

  const fetchStatus = () => {
    setLoadingStatus(true);
    fetch("/api/xero/status")
      .then((r) => r.json())
      .then((d) => {
        setXero(d);
        setLoadingStatus(false);
      })
      .catch(() => setLoadingStatus(false));
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleDisconnect = async () => {
    if (!(await confirm({ title: "Disconnect Xero?", message: "Leave requests and expense claims will no longer sync.", confirmLabel: "Disconnect", danger: true }))) return;
    setDisconnecting(true);
    setDisconnectError("");
    try {
      const res = await fetch("/api/xero/disconnect", { method: "POST" });
      if (!res.ok) throw new Error("Request failed");
      setXero({ connected: false });
      // Remove query params cleanly
      window.history.replaceState({}, "", "/dashboard/settings");
    } catch {
      setDisconnectError("Couldn't disconnect Xero. Please try again.");
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#223149]">Settings</h1>
        <PageSubtitle pageKey="settings" defaultDescription="Configure portal-wide settings and preferences." />
      </div>

      {/* Flash banners */}
      {xeroConnected && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">Xero connected successfully!</p>
        </div>
      )}
      {xeroError && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <XCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">
            Xero connection failed:{" "}
            {xeroError === "missing_params"
              ? "Missing authorisation parameters."
              : xeroError === "invalid_state"
              ? "Security check failed. Please try again."
              : xeroError === "no_tenants"
              ? "No Xero organisation found. Make sure you're logged in to the right Xero account."
              : xeroError === "access_denied"
              ? "Access was denied. Please try again and accept the permissions."
              : xeroError}
          </p>
        </div>
      )}

      {/* Xero Integration Card */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Xero logo placeholder */}
            <div className="w-10 h-10 rounded-xl bg-[#13B5EA]/10 flex items-center justify-center flex-shrink-0">
              <span className="text-[#13B5EA] font-bold text-sm">X</span>
            </div>
            <div>
              <h2 className="font-semibold text-[#223149]">Xero Payroll</h2>
              <p className="text-sm text-[#50676E]">Sync leave requests and expense claims to Xero</p>
              <p className="text-xs text-[#50676E] mt-0.5">Xero is our accounting &amp; payroll system.</p>
              <p className="text-xs text-amber-600 mt-1">Expense claims need extended Xero permissions — if approvals fail to send, click Disconnect then Connect to re-grant access.</p>
            </div>
          </div>
          <button
            onClick={fetchStatus}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-[#F8F6F4] transition-colors text-[#50676E] hover:text-[#223149] flex-shrink-0 text-sm font-medium"
            title="Refresh Xero connection status"
            aria-label="Refresh Xero connection status"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        <div className="mt-5">
          {loadingStatus ? (
            <div className="flex items-center gap-2 text-sm text-[#50676E]">
              <Loader2 className="w-4 h-4 animate-spin" />
              Checking connection…
            </div>
          ) : xero?.connected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                <span className="text-sm font-medium text-green-700">Connected</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-[#F8F6F4] rounded-xl">
                  <p className="text-xs text-[#50676E] font-medium">Organisation</p>
                  <p className="text-sm text-[#223149] font-semibold mt-0.5">{xero.tenantName}</p>
                </div>
                <div className="p-3 bg-[#F8F6F4] rounded-xl">
                  <p className="text-xs text-[#50676E] font-medium">Connected</p>
                  <p className="text-sm text-[#223149] font-semibold mt-0.5">
                    {xero.connectedAt
                      ? new Date(xero.connectedAt).toLocaleDateString("en-AU", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </p>
                </div>
              </div>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {disconnecting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Link2Off className="w-4 h-4" />
                )}
                Disconnect Xero
              </button>
              {disconnectError && (
                <p className="text-sm text-red-500">{disconnectError}</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#9BADB7] flex-shrink-0" />
                <span className="text-sm text-[#50676E]">Not connected</span>
              </div>
              <p className="text-sm text-[#50676E]">
                Connect your Xero account so staff can submit leave requests and expense claims
                from the HR Portal. Approved leave and expense bills sync to Xero; payment still
                happens in Xero.
              </p>
              <a
                href="/api/xero/connect"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#13B5EA] text-white rounded-xl text-sm font-semibold hover:bg-[#0fa3d4] transition-colors"
              >
                <Link2 className="w-4 h-4" />
                Connect to Xero
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
