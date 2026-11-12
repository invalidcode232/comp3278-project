"use client";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { ACCEPT_IMAGES, MAX_IMAGE_BYTES } from "@/lib/limits";

/** Profile image chooser with local preview and explicit removal; bytes are validated again on the server. */
export function AvatarEditor({
  imageId,
  name,
}: {
  /** Current stored avatar, null for the initial fallback. */ imageId:
    | number
    | null;
  /** Display name used by the fallback avatar. */ name: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [filename, setFilename] = useState("");
  const [error, setError] = useState("");
  useEffect(
    /** Free each temporary object URL when replaced or unmounted. */ () =>
      () => {
        if (preview) URL.revokeObjectURL(preview);
      },
    [preview],
  );
  useEffect(
    /** Server-confirmed profile changes replace the unsaved preview. */ () => {
      setPreview(null);
      setFilename("");
    },
    [imageId],
  );
  return (
    <div className="avatar-editor">
      {preview ? (
        <img
          src={preview}
          width={64}
          height={64}
          className="avatar-preview"
          alt="New avatar preview"
        />
      ) : (
        <Avatar imageId={imageId} name={name} size={64} />
      )}
      <div className="avatar-choices">
        <label className="avatar-picker btn-secondary">
          Change photo
          <input
            ref={input}
            type="file"
            name="avatar"
            accept={ACCEPT_IMAGES}
            aria-label="Avatar image"
            onChange={
              /** Preview only uploads within the shared byte cap. */ (
                event,
              ) => {
                const file = event.target.files?.[0];
                setError("");
                if (file && file.size > MAX_IMAGE_BYTES) {
                  event.target.value = "";
                  setError("Images must be 10 MiB or smaller.");
                  setPreview(null);
                  setFilename("");
                  return;
                }
                setFilename(file?.name ?? "");
                setPreview(file ? URL.createObjectURL(file) : null);
              }
            }
          />
        </label>
        <p className="muted avatar-filename">
          {filename || "JPEG, PNG, WebP or GIF · up to 10 MiB"}
        </p>
        {imageId && (
          <label className="avatar-remove">
            <input type="checkbox" name="remove_avatar" /> Remove avatar
          </label>
        )}
      </div>
      {error && (
        <p role="alert" className="form-feedback form-error">
          {error}
        </p>
      )}
    </div>
  );
}
