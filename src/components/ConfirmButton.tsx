"use client";

import type { ReactNode } from "react";

/** Submit button that asks "are you sure?" before the form is sent. */
export function ConfirmButton({
  message,
  children,
  className = "btn-danger",
}: {
  message: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
