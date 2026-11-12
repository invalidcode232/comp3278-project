"use client";
import { useId, useState } from "react";

/** Accessible password field with explicit reveal control and password-manager-compatible autocomplete. */
export function PasswordField({
  creating = false,
}: {
  /** Registration enforces the existing minimum and requests new-password autocomplete. */ creating?: boolean;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label className="label" htmlFor={id}>
        Password
      </label>
      <div className="password-field">
        <input
          id={id}
          name="password"
          type={visible ? "text" : "password"}
          required
          minLength={creating ? 8 : undefined}
          autoComplete={creating ? "new-password" : "current-password"}
          className="input"
        />
        <button
          type="button"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          onClick={
            /** Toggle presentation without changing the password value. */ () =>
              setVisible(!visible)
          }
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {creating && (
        <p className="muted field-hint">Use at least 8 characters.</p>
      )}
    </div>
  );
}
