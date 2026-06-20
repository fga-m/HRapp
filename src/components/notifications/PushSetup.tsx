"use client";

import { useEffect, useState } from "react";
import { Bell, BellRing, Loader2, Share, Smartphone } from "lucide-react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

// Convert the URL-safe base64 VAPID public key into the Uint8Array the
// PushManager expects as its applicationServerKey.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

export default function PushSetup() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const ua = navigator.userAgent;
    const iOS = /iPad|iPhone|iPod/.test(ua);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    const isSupported = "serviceWorker" in navigator && "PushManager" in window;

    // Register the SW and read the current subscription, then commit all state
    // at once from the async callback (avoids cascading synchronous renders).
    const init = async () => {
      let subbed = false;
      if (isSupported) {
        try {
          const reg = await navigator.serviceWorker.register("/sw.js");
          subbed = !!(await reg.pushManager.getSubscription());
        } catch {
          // ignore — treated as not subscribed
        }
      }
      if (cancelled) return;
      setIsIOS(iOS);
      setIsStandalone(standalone);
      setSupported(isSupported);
      setPermission(isSupported ? Notification.permission : "default");
      setSubscribed(subbed);
    };

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = async () => {
    setError(null);
    if (!VAPID_PUBLIC_KEY) {
      setError("Push notifications aren't configured on the server yet.");
      return;
    }
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        setError(
          perm === "denied"
            ? "Notifications are blocked. Turn them back on for this site in your browser settings, then try again."
            : "Notification permission wasn't granted."
        );
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      const res = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });
      if (!res.ok) throw new Error("save failed");
      setSubscribed(true);
    } catch {
      setError("Couldn't enable notifications on this device. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setError(null);
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch {
      setError("Couldn't turn off notifications. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  // Still detecting capabilities — render nothing to avoid a flash.
  if (supported === null) return null;

  // iOS Safari only delivers push to an installed PWA. Guide the user to
  // "Add to Home Screen" first; the toggle appears once they open it from there.
  if (isIOS && !isStandalone) {
    return (
      <div className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#223149]/5 flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-5 h-5 text-[#223149]" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-[#223149]">Get notifications on your iPhone</p>
            <p className="text-sm text-[#50676E] mt-1">
              On iPhone &amp; iPad, tap the Share button{" "}
              <Share className="inline w-4 h-4 -mt-0.5" /> in Safari, choose{" "}
              <span className="font-medium text-[#223149]">Add to Home Screen</span>, then open
              the portal from that icon. You&apos;ll then be able to turn on notifications here.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!supported) {
    return (
      <div className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#9BADB7]/10 flex items-center justify-center flex-shrink-0">
            <Bell className="w-5 h-5 text-[#50676E]" />
          </div>
          <div>
            <p className="font-semibold text-[#223149]">Device notifications</p>
            <p className="text-sm text-[#50676E] mt-0.5">
              This browser doesn&apos;t support push notifications.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              subscribed ? "bg-emerald-50" : "bg-[#223149]/5"
            }`}
          >
            {subscribed ? (
              <BellRing className="w-5 h-5 text-emerald-600" />
            ) : (
              <Bell className="w-5 h-5 text-[#223149]" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-[#223149]">Notifications on this device</p>
            <p className="text-sm text-[#50676E] mt-0.5">
              {subscribed
                ? "You'll get a push alert on this device for new notifications."
                : "Turn on to get push alerts on this device, even when the portal is closed."}
            </p>
          </div>
        </div>

        <button
          onClick={subscribed ? disable : enable}
          disabled={busy}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex-shrink-0 disabled:opacity-50 ${
            subscribed
              ? "border border-[#ECE3DF] text-[#50676E] hover:bg-[#F8F6F4]"
              : "bg-[#223149] text-white hover:bg-[#1a2638]"
          }`}
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : subscribed ? (
            "Turn off"
          ) : (
            "Turn on"
          )}
        </button>
      </div>

      {permission === "denied" && !subscribed && (
        <p className="text-sm text-amber-600 mt-3">
          Notifications are currently blocked for this site. Enable them in your browser settings
          to turn this on.
        </p>
      )}
      {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
    </div>
  );
}
