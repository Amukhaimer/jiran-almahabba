"use client";

import {
  Suspense,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

function AddPanelInner({
  label,
  children,
  paramKey = "add",
}: {
  label: string;
  children: ReactNode;
  paramKey?: string;
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const shouldOpen = searchParams.get(paramKey) === "1";
  const [open, setOpen] = useState(shouldOpen);

  useEffect(() => {
    if (shouldOpen) setOpen(true);
  }, [shouldOpen]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (shouldOpen && !next) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete(paramKey);
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-start">
        <button
          type="button"
          onClick={toggle}
          className={`btn ${open ? "btn-ghost" : "btn-primary"} no-print`}
          aria-expanded={open}
        >
          {open ? "إغلاق" : `+ ${label}`}
        </button>
      </div>
      {open ? <div className="no-print">{children}</div> : null}
    </div>
  );
}

export function AddPanel(props: {
  label: string;
  children: ReactNode;
  paramKey?: string;
}) {
  return (
    <Suspense
      fallback={
        <button type="button" className="btn btn-primary no-print" disabled>
          + {props.label}
        </button>
      }
    >
      <AddPanelInner {...props} />
    </Suspense>
  );
}
