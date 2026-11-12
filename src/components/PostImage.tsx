import { imageUrl } from "@/lib/format";

/** Render a thread or comment image through the application’s image endpoint. */
export function PostImage({
  imageId,
}: {
  /** Shared image identifier; null uses the no-image presentation. */
  imageId: number;
}) {
  return (
    <img
      src={imageUrl(imageId)}
      alt="Post attachment"
      className="mt-2 max-h-[520px] max-w-full rounded-xl border border-gray-200"
    />
  );
}
