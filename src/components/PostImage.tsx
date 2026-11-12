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
      alt=""
      className="mt-2 max-h-96 rounded-md border border-gray-200"
    />
  );
}
