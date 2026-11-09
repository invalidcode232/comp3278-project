import { formatTime, imageUrl } from "@/lib/format";
import { ACCEPT_IMAGES } from "@/lib/limits";

export function Avatar({ imageId, name, size = 40 }: { imageId: number | null; name: string; size?: number }) {
  const style = { width: size, height: size };
  if (imageId) {
    return <img src={imageUrl(imageId)} alt="" style={style} className="shrink-0 rounded-full object-cover" />;
  }
  return (
    <span
      style={{ ...style, fontSize: size * 0.4 }}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-700"
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Timestamp plus "(edited)" when updated_at > created_at. */
export function Stamp({ at, edited }: { at: Date; edited?: number | boolean }) {
  return (
    <span className="muted">
      {formatTime(at)}
      {edited ? " (edited)" : null}
    </span>
  );
}

export function PostImage({ imageId }: { imageId: number }) {
  return (
    <img src={imageUrl(imageId)} alt="" className="mt-2 max-h-96 rounded-md border border-gray-200" />
  );
}

/** Shared textarea + file input for threads, comments and messages. */
export function ContentFields({
  defaultBody,
  currentImageId,
  placeholder = "Write something…",
  rows = 4,
}: {
  defaultBody?: string | null;
  currentImageId?: number | null;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <>
      <textarea name="body" rows={rows} maxLength={5000} defaultValue={defaultBody ?? ""} placeholder={placeholder} className="input" />
      {currentImageId ? (
        <div className="flex items-end gap-3">
          <img src={imageUrl(currentImageId)} alt="" className="h-20 rounded border" />
          <label className="text-sm">
            <input type="checkbox" name="remove_image" className="mr-1" />
            Remove image
          </label>
        </div>
      ) : null}
      <label className="block text-sm text-gray-600">
        {currentImageId ? "Replace image" : "Image (optional)"}: JPEG, PNG, WebP or GIF, up to 5 MB
        <input type="file" name="image" accept={ACCEPT_IMAGES} className="mt-1 block text-sm" />
      </label>
    </>
  );
}
