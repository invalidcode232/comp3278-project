import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { getVisibleImage } from "@/lib/queries/images";
import { parseId } from "@/lib/validate";

/**
 * GET /api/images/[id] — serves a stored BLOB with its real Content-Type.
 * Authorization is checked before ETag handling. Responses are never stored,
 * because reference changes can turn a public image into a private attachment.
 */
export async function GET(
  request: Request,
  {
    params,
  }: {
    /** Asynchronous route parameters supplied by Next.js. */
    params: Promise<{
      /** Stable identifier used to reference this record. */
      id: string;
    }>;
  },
) {
  const imageId = parseId((await params).id);
  if (!imageId)
    return new Response("Not found", {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });

  const viewer = await getCurrentUser();
  const img = await getVisibleImage(pool, imageId, viewer?.id ?? null);
  if (!img)
    return new Response("Not found", {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });

  const etag = `"${img.sha256}"`;
  // Even public images can become private after their last public reference is
  // removed. Never let a cache bypass the current reference/participant checks.
  const headers = {
    "Content-Type": img.mime_type,
    "Cache-Control": "private, no-store",
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
