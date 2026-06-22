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

interface GwsStatus {
  connected: boolean;
  email?: string | null;
  connectedAt?: string | null;
}

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const confirm = useConfirm();
  const [xero, setXero] = useState<XeroStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState("");

  const [gws, setGws] = useState<GwsStatus | null>(null);
  const [loadingGws, setLoadingGws] = useState(true);
  const [disconnectingGws, setDisconnectingGws] = useState(false);
  const [gwsDisconnectError, setGwsDisconnectError] = useState("");

  const [gmail, setGmail] = useState<GwsStatus | null>(null);
  const [loadingGmail, setLoadingGmail] = useState(true);
  const [disconnectingGmail, setDisconnectingGmail] = useState(false);
  const [gmailDisconnectError, setGmailDisconnectError] = useState("");

  const xeroConnected = searchParams.get("xero_connected") === "1";
  const xeroError = searchParams.get("xero_error");
  const gwsConnected = searchParams.get("gws_connected") === "1";
  const gwsError = searchParams.get("gws_error");
  const gmailConnected = searchParams.get("gmail_connected") === "1";
  const gmailError = searchParams.get("gmail_error");

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

  const fetchGwsStatus = () => {
    setLoadingGws(true);
    fetch("/api/google-workspace/status")
      .then((r) => r.json())
      .then((d) => {
        setGws(d);
        setLoadingGws(false);
      })
      .catch(() => setLoadingGws(false));
  };

  const fetchGmailStatus = () => {
    setLoadingGmail(true);
    fetch("/api/google-mail/status")
      .then((r) => r.json())
      .then((d) => {
        setGmail(d);
        setLoadingGmail(false);
      })
      .catch(() => setLoadingGmail(false));
  };

  useEffect(() => {
    fetchStatus();
    fetchGwsStatus();
    fetchGmailStatus();
  }, []);

  const handleDisconnect = async () => {
    if (!(await confirm({ title: "Disconnect Xero?", message: "Leave requests and expense claims will no longer sync.", confirmLabel: "Disconnect", danger: true }))) return;
    setDisconnecting(true);
    setDisconnectError("");
    try {
      const res = await fetch("/api/xero/disconnect", { method: "POST" });
      if (!res.ok) throw new Error("Request failed");
      setXero({ connected: false });
      window.history.replaceState({}, "", "/dashboard/settings");
    } catch {
      setDisconnectError("Couldn't disconnect Xero. Please try again.");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleDisconnectGws = async () => {
    if (!(await confirm({ title: "Disconnect Google Workspace?", message: "New staff Google accounts can no longer be created from the app until you reconnect.", confirmLabel: "Disconnect", danger: true }))) return;
    setDisconnectingGws(true);
    setGwsDisconnectError("");
    try {
      const res = await fetch("/api/google-workspace/disconnect", { method: "POST" });
      if (!res.ok) throw new Error("Request failed");
      setGws({ connected: false });
      window.history.replaceState({}, "", "/dashboard/settings");
    } catch {
      setGwsDisconnectError("Couldn't disconnect Google Workspace. Please try again.");
    } finally {
      setDisconnectingGws(false);
    }
  };

  const handleDisconnectGmail = async () => {
    if (!(await confirm({ title: "Disconnect Email (Gmail)?", message: "The app will stop sending emails (e.g. leave-decline notices) until you reconnect.", confirmLabel: "Disconnect", danger: true }))) return;
    setDisconnectingGmail(true);
    setGmailDisconnectError("");
    try {
      const res = await fetch("/api/google-mail/disconnect", { method: "POST" });
      if (!res.ok) throw new Error("Request failed");
      setGmail({ connected: false });
      window.history.replaceState({}, "", "/dashboard/settings");
    } catch {
      setGmailDisconnectError("Couldn't disconnect Email. Please try again.");
    } finally {
      setDisconnectingGmail(false);
    }
  };

  const formatDate = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "—";

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
      {gwsConnected && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">Google Workspace connected successfully!</p>
        </div>
      )}
      {gwsError && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <XCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">
            Google Workspace connection failed:{" "}
            {gwsError === "missing_params"
              ? "Missing authorisation parameters."
              : gwsError === "invalid_state"
              ? "Security check failed. Please try again."
              : gwsError === "no_refresh_token"
              ? "Google didn't return offline access. Try again and accept all permissions."
              : gwsError === "access_denied"
              ? "Access was denied. Please try again and accept the permissions."
              : gwsError}
          </p>
        </div>
      )}
      {gmailConnected && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">Email (Gmail) connected successfully!</p>
        </div>
      )}
      {gmailError && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <XCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">
            Email connection failed:{" "}
            {gmailError === "no_refresh_token"
              ? "Google didn't return offline access. Try again and accept all permissions."
              : gmailError === "invalid_state"
              ? "Security check failed. Please try again."
              : gmailError === "access_denied"
              ? "Access was denied. Please try again and accept the permissions."
              : gmailError}
          </p>
        </div>
      )}

      {/* Xero Integration Card */}
      <div className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
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
                  <p className="text-sm text-[#223149] font-semibold mt-0.5">{formatDate(xero.connectedAt)}</p>
                </div>
              </div>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {disconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2Off className="w-4 h-4" />}
                Disconnect Xero
              </button>
              {disconnectError && <p className="text-sm text-red-500">{disconnectError}</p>}
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

      {/* Google Workspace Card */}
      <div className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#4285F4]/10 flex items-center justify-center flex-shrink-0">
              <span className="text-[#4285F4] font-bold text-sm">G</span>
            </div>
            <div>
              <h2 className="font-semibold text-[#223149]">Google Workspace</h2>
              <p className="text-sm text-[#50676E]">Create @fgam.org.au accounts for new staff from the app</p>
              <p className="text-xs text-amber-600 mt-1">
                Connect a Workspace <strong>super-admin</strong> account. The Google Cloud project must have the
                Admin SDK API enabled and the <code>admin.directory.user</code> scope on its consent screen.
              </p>
            </div>
          </div>
          <button
            onClick={fetchGwsStatus}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-[#F8F6F4] transition-colors text-[#50676E] hover:text-[#223149] flex-shrink-0 text-sm font-medium"
            title="Refresh Google Workspace connection status"
            aria-label="Refresh Google Workspace connection status"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        <div className="mt-5">
          {loadingGws ? (
            <div className="flex items-center gap-2 text-sm text-[#50676E]">
              <Loader2 className="w-4 h-4 animate-spin" />
              Checking connection…
            </div>
          ) : gws?.connected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                <span className="text-sm font-medium text-green-700">Connected</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-[#F8F6F4] rounded-xl">
                  <p className="text-xs text-[#50676E] font-medium">Admin account</p>
                  <p className="text-sm text-[#223149] font-semibold mt-0.5 truncate">{gws.email ?? "—"}</p>
                </div>
                <div className="p-3 bg-[#F8F6F4] rounded-xl">
                  <p className="text-xs text-[#50676E] font-medium">Connected</p>
                  <p className="text-sm text-[#223149] font-semibold mt-0.5">{formatDate(gws.connectedAt)}</p>
                </div>
              </div>
              <button
                onClick={handleDisconnectGws}
                disabled={disconnectingGws}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {disconnectingGws ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2Off className="w-4 h-4" />}
                Disconnect Google Workspace
              </button>
              {gwsDisconnectError && <p className="text-sm text-red-500">{gwsDisconnectError}</p>}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#9BADB7] flex-shrink-0" />
                <span className="text-sm text-[#50676E]">Not connected</span>
              </div>
              <p className="text-sm text-[#50676E]">
                Connect a Workspace super-admin so the app can create a new starter&apos;s Google account
                during onboarding. Existing accounts are detected and linked rather than duplicated.
              </p>
              <a
                href="/api/google-workspace/connect"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#4285F4] text-white rounded-xl text-sm font-semibold hover:bg-[#3b78e7] transition-colors"
              >
                <Link2 className="w-4 h-4" />
                Connect Google Workspace
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Email (Gmail) Card */}
      <div className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EA4335]/10 flex items-center justify-center flex-shrink-0">
              <span className="text-[#EA4335] font-bold text-sm">@</span>
            </div>
            <div>
              <h2 className="font-semibold text-[#223149]">Email (Gmail)</h2>
              <p className="text-sm text-[#50676E]">Send app emails (e.g. leave-decline notices) from an @fgam.org.au address</p>
              <p className="text-xs text-amber-600 mt-1">
                Connect the sending account (e.g. <code>hrapp@fgam.org.au</code>). The Google Cloud project needs the
                Gmail API enabled and the <code>gmail.send</code> scope on its consent screen.
              </p>
            </div>
          </div>
          <button
            onClick={fetchGmailStatus}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-[#F8F6F4] transition-colors text-[#50676E] hover:text-[#223149] flex-shrink-0 text-sm font-medium"
            title="Refresh email connection status"
            aria-label="Refresh email connection status"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        <div className="mt-5">
          {loadingGmail ? (
            <div className="flex items-center gap-2 text-sm text-[#50676E]">
              <Loader2 className="w-4 h-4 animate-spin" />
              Checking connection…
            </div>
          ) : gmail?.connected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                <span className="text-sm font-medium text-green-700">Connected</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-[#F8F6F4] rounded-xl">
                  <p className="text-xs text-[#50676E] font-medium">Sending from</p>
                  <p className="text-sm text-[#223149] font-semibold mt-0.5 truncate">{gmail.email ?? "—"}</p>
                </div>
                <div className="p-3 bg-[#F8F6F4] rounded-xl">
                  <p className="text-xs text-[#50676E] font-medium">Connected</p>
                  <p className="text-sm text-[#223149] font-semibold mt-0.5">{formatDate(gmail.connectedAt)}</p>
                </div>
              </div>
              <button
                onClick={handleDisconnectGmail}
                disabled={disconnectingGmail}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {disconnectingGmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2Off className="w-4 h-4" />}
                Disconnect Email
              </button>
              {gmailDisconnectError && <p className="text-sm text-red-500">{gmailDisconnectError}</p>}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#9BADB7] flex-shrink-0" />
                <span className="text-sm text-[#50676E]">Not connected</span>
              </div>
              <p className="text-sm text-[#50676E]">
                Connect the account the app sends from. Emails show a no-reply display name; stray replies route to the
                Reply-To address you set in the template below.
              </p>
              <a
                href="/api/google-mail/connect"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#EA4335] text-white rounded-xl text-sm font-semibold hover:bg-[#d33b2c] transition-colors"
              >
                <Link2 className="w-4 h-4" />
                Connect Email
              </a>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
