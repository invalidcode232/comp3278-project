import { imageUrl } from "@/lib/format";
import { ACCEPT_IMAGES } from "@/lib/limits";

/** Shared textarea + file input for threads, comments and messages. */
export function ContentFields({
  defaultBody,
  currentImageId,
  placeholder = "Write something…",
  rows = 4,
}: {
  /** Initial text value for editing; null or absent starts empty. */
  defaultBody?: string | null;
  /** Existing image to preview and optionally remove during editing. */
  currentImageId?: number | null;
  /** Hint shown when the text field is empty. */
  placeholder?: string;
  /** Visible textarea row count. */
  rows?: number;
}) {
  return (
    <>
      <textarea
        name="body"
        rows={rows}
        maxLength={5000}
        defaultValue={defaultBody ?? ""}
        placeholder={placeholder}
        className="input"
      />
      {currentImageId ? (
        <div className="flex items-end gap-3">
          <img
            src={imageUrl(currentImageId)}
            alt=""
            className="h-20 rounded border"
          />
          <label className="text-sm">
            <input type="checkbox" name="remove_image" className="mr-1" />
            Remove image
          </label>
        </div>
      ) : null}
      <label className="block text-sm text-gray-600">
        {currentImageId ? "Replace image" : "Image (optional)"}: JPEG, PNG, WebP
        or GIF, up to 5 MB
        <input
          type="file"
          name="image"
          accept={ACCEPT_IMAGES}
          className="mt-1 block text-sm"
        />
      </label>
    </>
  );
}
