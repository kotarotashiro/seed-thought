"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Button } from "./Button";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
};

type AlertOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
};

type DialogState =
  | { kind: "confirm"; opts: ConfirmOptions; resolve: (value: boolean) => void }
  | { kind: "alert"; opts: AlertOptions; resolve: () => void }
  | null;

type DialogContextValue = {
  confirm: (opts: ConfirmOptions | string) => Promise<boolean>;
  alert: (opts: AlertOptions | string) => Promise<void>;
};

const DialogContext = createContext<DialogContextValue | null>(null);

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used within a DialogProvider");
  return ctx;
}

export function useConfirm() {
  return useDialog().confirm;
}

export function useAlert() {
  return useDialog().alert;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DialogState>(null);

  const confirm = useCallback((opts: ConfirmOptions | string) => {
    const normalized = typeof opts === "string" ? { message: opts } : opts;
    return new Promise<boolean>((resolve) => {
      setState({ kind: "confirm", opts: normalized, resolve });
    });
  }, []);

  const alert = useCallback((opts: AlertOptions | string) => {
    const normalized = typeof opts === "string" ? { message: opts } : opts;
    return new Promise<void>((resolve) => {
      setState({ kind: "alert", opts: normalized, resolve });
    });
  }, []);

  const close = useCallback(
    (value: boolean) => {
      if (!state) return;
      if (state.kind === "confirm") state.resolve(value);
      else state.resolve();
      setState(null);
    },
    [state]
  );

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
      else if (e.key === "Enter") close(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, close]);

  const isDanger = state?.kind === "confirm" && state.opts.variant === "danger";

  return (
    <DialogContext.Provider value={{ confirm, alert }}>
      {children}
      {state && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => close(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {state.opts.title && (
              <h2 className="mb-2 text-base font-semibold text-text">
                {state.opts.title}
              </h2>
            )}
            <p className="whitespace-pre-wrap text-sm text-text-secondary">
              {state.opts.message}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              {state.kind === "confirm" && (
                <Button variant="secondary" onClick={() => close(false)}>
                  {state.opts.cancelLabel ?? "キャンセル"}
                </Button>
              )}
              <Button
                variant={isDanger ? "danger" : "primary"}
                autoFocus
                onClick={() => close(true)}
              >
                {state.opts.confirmLabel ?? (state.kind === "confirm" ? "OK" : "閉じる")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}
