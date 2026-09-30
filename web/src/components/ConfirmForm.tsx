"use client";

import type { FormHTMLAttributes, ReactNode } from "react";

type Props = {
  message: string;
  children: ReactNode;
  action?: FormHTMLAttributes<HTMLFormElement>["action"];
  className?: string;
};

export function ConfirmForm({ message, children, action, className }: Props) {
  return (
    <form
      action={action}
      className={className}
      onSubmit={(e) => {
        if (!window.confirm(message)) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </form>
  );
}
