"use client";

import type { ReactNode } from "react";

/** Submit button that asks "are you sure?" before the form is sent. */
export function ConfirmButton({
  message,
  children,
  className = "btn-danger",
}: {
  /** Confirmation prompt shown before the form is submitted. */
  message: string;
  /** Nested content rendered inside this component. */
  children: ReactNode;
  /** Optional CSS classes replacing the component’s default container classes. */
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
