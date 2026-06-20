"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (opts: string | ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * App-wide confirmation dialog. Wrap the app once in <ConfirmProvider> and call
 * the promise-based `useConfirm()` hook in place of the native `confirm()`:
 *   const confirm = useConfirm();
 *   if (!(await confirm("Delete this?"))) return;
 *   if (!(await confirm({ title: "Delete?", message: "...", danger: true }))) return;
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((o) => {
    setOpts(typeof o === "string" ? { title: o } : o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOpts(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <div
          className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/40"
          onClick={() => settle(false)}
        >
          <div
            className="bg-white rounded-t-2xl md:rounded-2xl shadow-xl w-full md:max-w-sm p-6 pb-8 md:pb-6 space-y-4 pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              {opts.danger && (
                <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-[#223149]">{opts.title}</h2>
                {opts.message && <p className="text-sm text-[#50676E] mt-1">{opts.message}</p>}
              </div>
              <button onClick={() => settle(false)} className="p-2 rounded-xl hover:bg-[#F8F6F4] transition-colors flex-shrink-0" aria-label="Cancel">
                <X className="w-5 h-5 text-[#50676E]" />
              </button>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => settle(true)}
                autoFocus
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors ${
                  opts.danger ? "bg-red-500 hover:bg-red-600" : "bg-[#223149] hover:bg-[#1a2638]"
                }`}
              >
                {opts.confirmLabel ?? (opts.danger ? "Delete" : "Confirm")}
              </button>
              <button
                onClick={() => settle(false)}
                className="px-4 py-2.5 border border-[#ECE3DF] text-[#50676E] rounded-xl text-sm font-semibold hover:bg-[#F8F6F4] transition-colors"
              >
                {opts.cancelLabel ?? "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmProvider");
  return ctx;
}
