"use client";
import { useEffect, useId, useRef, useState } from "react";
import { imageUrl } from "@/lib/format";
import { ACCEPT_IMAGES, MAX_IMAGE_BYTES } from "@/lib/limits";
import { Icon } from "./Icon";

/** Text/image editor with a local attachment preview; final validation remains on the server. */
export function ContentFields({
  defaultBody,
  currentImageId,
  placeholder = "What's new?",
  rows = 4,
}: {
  /** Initial text for editing; absent/null means empty. */
  defaultBody?: string | null;
  /** Current stored image, optionally removable when editing. */
  currentImageId?: number | null;
  /** Contextual hint, supplementary to the persistent accessible label. */
  placeholder?: string;
  /** Initial textarea height in rows. */
  rows?: number;
}) {
  const fieldId = useId();
  const textRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [length, setLength] = useState(defaultBody?.length ?? 0);
  useEffect(
    /** Release local object URLs when an attachment changes or the editor unmounts. */
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  useEffect(
    /** A successful parent form reset clears preview and character feedback too. */
    () => {
      const form = fileRef.current?.form;
      /** Synchronize local presentation with native reset after a successful send. */
      function reset() {
        setPreview(null);
        setError("");
        setLength(defaultBody?.length ?? 0);
        if (textRef.current) textRef.current.style.height = "";
      }
      form?.addEventListener("reset", reset);
      return () => form?.removeEventListener("reset", reset);
    },
    [defaultBody],
  );
  return (
    <>
      <label htmlFor={fieldId} className="sr-only">
        Message text
      </label>
      <textarea
        ref={textRef}
        id={fieldId}
        name="body"
        rows={rows}
        maxLength={5000}
        defaultValue={defaultBody ?? ""}
        placeholder={placeholder}
        className="input composer-text"
        onChange={
          /** Display the count only as the user approaches the content limit. */
          (event) => {
            setLength(event.target.value.length);
            event.currentTarget.style.height = "auto";
            event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 320)}px`;
          }
        }
      />
      {length >= 4500 && (
        <p className="muted text-right">{length.toLocaleString()} / 5,000</p>
      )}
      {(preview || currentImageId) && (
        <div className="attachment-preview">
          <img
            src={preview ?? imageUrl(currentImageId!)}
            alt="Attachment preview"
          />
          {preview ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={
                /** Remove the new attachment without altering an existing stored image. */
                () => {
                  if (fileRef.current) fileRef.current.value = "";
                  setPreview(null);
                }
              }
            >
              Remove attachment
            </button>
          ) : (
            <label>
              <input type="checkbox" name="remove_image" /> Remove image
            </label>
          )}
        </div>
      )}
      <label className="attachment-picker">
        <Icon name="image" />
        <span>{currentImageId ? "Replace image" : "Attach image"}</span>
        <input
          ref={fileRef}
          type="file"
          name="image"
          accept={ACCEPT_IMAGES}
          aria-label="Attach image"
          onChange={
            /** Reject oversized files before creating a preview; server rechecks bytes and type. */
            (event) => {
              const file = event.target.files?.[0];
              setError("");
              if (file && file.size > MAX_IMAGE_BYTES) {
                setError("Images must be 10 MiB or smaller.");
                event.target.value = "";
                setPreview(null);
                return;
              }
              setPreview(file ? URL.createObjectURL(file) : null);
            }
          }
        />
      </label>
      <p className="muted text-xs">
        JPEG, PNG, WebP or GIF · up to 10 MiB · text, an image, or both
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </>
  );
}
