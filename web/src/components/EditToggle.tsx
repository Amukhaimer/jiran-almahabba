"use client";

import { useState, type ReactNode } from "react";

export function EditToggle({
  label = "تعديل",
  title = "تعديل",
  children,
}: {
  label?: string;
  title?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-ghost text-xs py-1 no-print"
      >
        {label}
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 no-print"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            className="panel w-full max-w-lg bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="font-bold text-lg">{title}</h3>
              <button
                type="button"
                className="btn btn-ghost text-xs py-1"
                onClick={() => setOpen(false)}
              >
                إغلاق
              </button>
            </div>
            {children}
          </div>
        </div>
      ) : null}
    </>
  );
}
