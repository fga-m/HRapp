"use client";

import { useEffect, useState } from "react";
import { Lock, Loader2, SlidersHorizontal } from "lucide-react";
import { NOTIFICATION_CATEGORIES } from "@/lib/notification-categories";

// Pure fetch (no state) so it can be shared by the initial load and the retry
// without the effect itself calling setState.
async function fetchDisabledCategories(): Promise<string[]> {
  const res = await fetch("/api/notification-preferences");
  if (!res.ok) throw new Error("load failed");
  const d = await res.json();
  return (d.disabledCategories as string[] | undefined) ?? [];
}

export default function NotificationPreferences() {
  const [disabled, setDisabled] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Keys with an in-flight save, so we can disable their toggle meanwhile.
  const [pending, setPending] = useState<Set<string>>(new Set());

  // Mirror PushSetup: load inside the effect and commit state only from the
  // async resolution, guarded against unmount.
  useEffect(() => {
    let cancelled = false;
    fetchDisabledCategories()
      .then((keys) => {
        if (cancelled) return;
        setDisabled(new Set(keys));
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(true);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const retry = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      setDisabled(new Set(await fetchDisabledCategories()));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const toggle = async (key: string) => {
    setSaveError(null);
    const next = new Set(disabled);
    if (next.has(key)) next.delete(key);
    else next.add(key);

    const previous = disabled;
    setDisabled(next); // optimistic
    setPending((p) => new Set(p).add(key));

    try {
      const res = await fetch("/api/notification-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabledCategories: [...next] }),
      });
      if (!res.ok) throw new Error("save failed");
      const d = await res.json();
      // Trust the server's canonical set (it strips locked/unknown keys).
      setDisabled(new Set<string>(d.disabledCategories ?? []));
    } catch {
      setDisabled(previous); // revert
      setSaveError("Couldn't save that change — please try again.");
    } finally {
      setPending((p) => {
        const copy = new Set(p);
        copy.delete(key);
        return copy;
      });
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#223149]/5 flex items-center justify-center flex-shrink-0">
          <SlidersHorizontal className="w-5 h-5 text-[#223149]" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-[#223149]">Choose what you&apos;re notified about</p>
          <p className="text-sm text-[#5F7C84] mt-0.5">
            Turn a topic off to stop device push alerts for it — these items still appear
            in your list above.
          </p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-24">
          <Loader2 className="w-5 h-5 text-[#9BADB7] animate-spin" />
        </div>
      )}

      {!loading && loadError && (
        <div className="mt-4 text-center">
          <p className="text-sm text-[#5F7C84]">Couldn&apos;t load your preferences.</p>
          <button
            onClick={retry}
            className="mt-2 px-4 py-2 rounded-xl border border-[#ECE3DF] text-sm font-semibold text-[#5F7C84] hover:bg-[#F8F6F4] transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !loadError && (
        <>
          <div className="mt-4 divide-y divide-[#ECE3DF]">
            {NOTIFICATION_CATEGORIES.map((cat) => {
              const on = cat.locked || !disabled.has(cat.key);
              const isPending = pending.has(cat.key);
              return (
                <div key={cat.key} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-[#223149]">{cat.label}</p>
                      {cat.locked && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#9BADB7] bg-[#F8F6F4] border border-[#ECE3DF] rounded-full px-2 py-0.5">
                          <Lock className="w-3 h-3" />
                          Always on
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#9BADB7] mt-0.5">{cat.description}</p>
                  </div>

                  <button
                    role="switch"
                    aria-checked={on}
                    aria-label={`${cat.label} notifications`}
                    disabled={cat.locked || isPending}
                    onClick={() => toggle(cat.key)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed ${
                      on ? "bg-[#223149]" : "bg-[#ECE3DF]"
                    } ${cat.locked ? "opacity-60" : ""}`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        on ? "translate-x-[22px]" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>

          {saveError && <p className="text-sm text-red-500 mt-3">{saveError}</p>}
        </>
      )}
    </div>
  );
}
