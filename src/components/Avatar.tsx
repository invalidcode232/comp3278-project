import { imageUrl } from "@/lib/format";

/** Render a stored avatar or an initial fallback; size is the square dimension in CSS pixels. */
export function Avatar({
  imageId,
  name,
  size = 40,
}: {
  /** Shared image identifier; null uses the no-image presentation. */
  imageId: number | null;

  /** Human-readable label displayed for this record. */
  name: string;

  /** Square avatar dimension in CSS pixels; defaults to 40. */
  size?: number;
}) {
  const style = { width: size, height: size };
  if (imageId) {
    return (
      <img
        src={imageUrl(imageId)}
        alt=""
        style={style}
        className="shrink-0 rounded-full object-cover"
      />
    );
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
