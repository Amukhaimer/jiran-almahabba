"use client";

import { useEffect, useRef, useState } from "react";
import type { FormHTMLAttributes, ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  message: string;
  children: ReactNode;
  action?: FormHTMLAttributes<HTMLFormElement>["action"];
  className?: string;
};

// In-page confirmation instead of window.confirm(): embedded browsers and webviews
// may suppress native dialogs, which silently cancelled every save.
export function ConfirmForm({ message, children, action, className }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const confirmed = useRef(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function confirm() {
    confirmed.current = true;
    setOpen(false);
    formRef.current?.requestSubmit();
  }

  return (
    <form
      ref={formRef}
      action={action}
      className={className}
      onSubmit={(e) => {
        if (confirmed.current) {
          confirmed.current = false;
          return;
        }
        e.preventDefault();
        setOpen(true);
      }}
    >
      {children}
      {open
        ? createPortal(
            <div
              className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
              onClick={() => setOpen(false)}
            >
              <div
                role="alertdialog"
                aria-modal="true"
                aria-label={message}
                className="panel w-full max-w-sm space-y-4 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-base font-semibold text-[var(--ink)]">{message}</p>
                <div className="flex gap-2">
                  <button type="button" className="btn btn-primary grow" onClick={confirm} autoFocus>
                    نعم، متأكد
                  </button>
                  <button type="button" className="btn btn-ghost grow" onClick={() => setOpen(false)}>
                    إلغاء
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </form>
  );
}
