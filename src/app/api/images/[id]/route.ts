import { pool } from "@/lib/db";
import { getImage } from "@/lib/queries/images";
import { parseId } from "@/lib/validate";

/**
 * GET /api/images/[id] — serves a stored BLOB with its real Content-Type.
 * An image row never changes (its content is its SHA-256), so browsers may
 * cache it forever; the ETag lets them revalidate with a 304.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const imageId = parseId((await params).id);
  if (!imageId) return new Response("Not found", { status: 404 });

  const img = await getImage(pool, imageId);
  if (!img) return new Response("Not found", { status: 404 });

  const etag = `"${img.sha256}"`;
  const headers = {
    "Content-Type": img.mime_type,
    "Cache-Control": "public, max-age=31536000, immutable",
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
  };
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(new Uint8Array(img.data), {
    headers: { ...headers, "Content-Length": String(img.data.length) },
  });
}
