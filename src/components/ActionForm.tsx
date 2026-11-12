"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { MAX_IMAGE_BYTES } from "@/lib/limits";
import type { FormState } from "@/lib/validate";

/**
 * A form wired to a Server Action that returns { error } or { ok }.
 * It shows the message under the fields, disables the button while pending,
 * and keeps the user's input when there is an error.
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  className = "space-y-3",
  buttonClassName = "btn",
  resetOnSuccess = false,
}: {
  /** Server Action invoked with the previous result and submitted form fields. */
  action: (prev: FormState, formData: FormData) => Promise<FormState>;

  /** Nested content rendered inside this component. */
  children: ReactNode;

  /** Text on the idle submit button. */
  submitLabel: string;

  /** Optional CSS classes replacing the component’s default container classes. */
  className?: string;

  /** Optional CSS classes for the submit button. */
  buttonClassName?: string;

  /** Whether to clear uncontrolled inputs after a successful result. */
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [clientError, setClientError] = useState<string | null>(null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(
    /** Clear successful uploads; optionally reset all fields, but retain input on failure. */
    () => {
      if (!state?.ok) return;
      if (resetOnSuccess) ref.current?.reset();
      // A successful upload must not silently reattach the old file on the next
      // edit/removal. Keep other uncontrolled profile fields unless reset is requested.
      ref.current
        ?.querySelectorAll<HTMLInputElement>('input[type="file"]')
        .forEach(
          /** Clear the uploaded file so later edits cannot accidentally attach it again. */
          (input) => {
            input.value = "";
          },
        );
    },
    [state, resetOnSuccess],
  );

  const error = clientError ?? state?.error;

  return (
    <form
      ref={ref}
      className={className}
      onSubmit={
        /** Prevent the native submit, check file sizes, and dispatch the Server Action. */
        (e) => {
          e.preventDefault();
          // Check file sizes before uploading, so an oversized file never hits
          // the Server Action body limit. The server checks again (upload.ts).
          const inputs =
            e.currentTarget.querySelectorAll<HTMLInputElement>(
              "input[type=file]",
            );
          const tooBig = [...inputs].some(
            /** Detect whether this file input contains any oversized attachment. */
            (i) =>
              [...(i.files ?? [])].some(
                /** Compare the selected file byte length with the shared image cap. */
                (f) => f.size > MAX_IMAGE_BYTES,
              ),
          );
          if (tooBig) {
            setClientError("Images must be 10 MiB or smaller.");
            return;
          }
          setClientError(null);
          const fd = new FormData(e.currentTarget);
          startTransition(
            /** Dispatch validated form fields inside a React transition for pending feedback. */
            () => formAction(fd),
          );
        }
      }
    >
      {children}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!error && state?.ok && (
        <p className="text-sm text-green-700">{state.ok}</p>
      )}
      <button type="submit" disabled={pending} className={buttonClassName}>
        {pending ? "Working…" : submitLabel}
      </button>
    </form>
  );
}
