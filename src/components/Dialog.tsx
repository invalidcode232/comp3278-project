"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

/** Accessible native modal with focus containment, Escape, backdrop dismissal, and measured Threads entrance motion. */
export function Dialog({
  trigger,
  title,
  children,
  triggerClass = "btn-secondary",
}: {
  /** Trigger content, including an accessible text label for icon-only controls. */
  trigger: ReactNode;
  /** Visible and accessible dialog heading. */
  title: string;
  /** Form or contextual content. */
  children: ReactNode;
  /** Trigger styling for navigation, inline composers, or row actions. */
  triggerClass?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [closing, setClosing] = useState(false);
  const path = usePathname();
  useEffect(
    /** Close after navigation and release timers on unmount. */
    () => {
      ref.current?.close();
      setClosing(false);
      return () => {
        if (timer.current) clearTimeout(timer.current);
      };
    },
    [path],
  );
  /** Animate dismissal before native close returns focus to the trigger. */
  function dismiss() {
    if (closing) return;
    setClosing(true);
    timer.current = setTimeout(
      /** Finish the short exit and reset for the next opening. */
      () => {
        ref.current?.close();
        setClosing(false);
      },
      180,
    );
  }
  return (
    <>
      <button
        type="button"
        className={triggerClass}
        onClick={
          /** Native showModal puts focus in the dialog and makes the background inert. */
          () => {
            setClosing(false);
            ref.current?.showModal();
          }
        }
      >
        {trigger}
      </button>
      <dialog
        ref={ref}
        className="composer-dialog"
        aria-label={title}
        data-closing={closing || undefined}
        onCancel={
          /** Defer native Escape dismissal until the exit completes. */
          (event) => {
            event.preventDefault();
            dismiss();
          }
        }
        onClick={
          /** A click outside the panel closes only when it hits the backdrop itself. */
          (event) => {
            if (event.target === event.currentTarget) dismiss();
          }
        }
      >
        <div className="dialog-panel">
          <header className="dialog-heading">
            <button type="button" className="text-button" onClick={dismiss}>
              Cancel
            </button>
            <h2>{title}</h2>
            <span />
          </header>
          <div className="dialog-body">{children}</div>
        </div>
      </dialog>
    </>
  );
}
