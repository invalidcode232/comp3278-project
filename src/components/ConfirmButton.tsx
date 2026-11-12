"use client";
import { useId, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

/** Destructive form action with a focus-contained in-app confirmation; cancel never submits. */
export function ConfirmButton({
  message,
  children,
  className = "btn-danger",
}: {
  /** Explain the actual deletion consequences. */ message: string;
  /** Text shared by the trigger and final confirmation. */ children: ReactNode;
  /** Trigger style in the owning form/menu. */ className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const submitter = useRef<HTMLButtonElement>(null);
  const description = useId();
  const { pending } = useFormStatus();
  return (
    <>
      <button
        ref={submitter}
        type="button"
        disabled={pending}
        className={className}
        onClick={
          /** Open only the local confirmation; the enclosing action has not run. */ () =>
            dialog.current?.showModal()
        }
      >
        {pending ? "Deleting…" : children}
      </button>
      <dialog
        ref={dialog}
        className="confirm-dialog"
        aria-labelledby={`${description}-title`}
        aria-describedby={description}
        onClick={
          /** Dismiss a backdrop click without submitting the owning form. */ (
            event,
          ) => {
            if (event.target === event.currentTarget) dialog.current?.close();
          }
        }
      >
        <div className="confirm-panel">
          <h2 id={`${description}-title`}>Are you sure?</h2>
          <p id={description}>{message}</p>
          <div className="confirm-actions">
            <button
              type="button"
              className="btn-secondary"
              autoFocus
              onClick={
                /** Keep the destructive action unsubmitted. */ () =>
                  dialog.current?.close()
              }
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={
                /** Submit the original form only after explicit in-app confirmation. */ () => {
                  dialog.current?.close();
                  submitter.current?.form?.requestSubmit();
                }
              }
            >
              {children}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
