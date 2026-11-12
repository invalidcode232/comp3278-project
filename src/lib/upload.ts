import { createHash } from "node:crypto";
import type { Db } from "./db";
import { findImageIdByHash, insertImage } from "./queries/images";
import { InputError } from "./validate";

import { MAX_IMAGE_BYTES } from "./limits";

/** Work out the type from the file's first bytes; the browser-supplied type is not trusted. */
function sniffMime(b: Buffer): string | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    return "image/jpeg";
  if (
    b.length >= 8 &&
    b
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return "image/png";
  if (
    b.length >= 6 &&
    (b.toString("ascii", 0, 6) === "GIF87a" ||
      b.toString("ascii", 0, 6) === "GIF89a")
  )
    return "image/gif";
  if (
    b.length >= 12 &&
    b.toString("ascii", 0, 4) === "RIFF" &&
    b.toString("ascii", 8, 12) === "WEBP"
  )
    return "image/webp";
  return null;
}

/** The uploaded file from a form field, or null if the field was left empty. */
export function getUploadedFile(
  formData: FormData,
  field = "image",
): File | null {
  const f = formData.get(field);
  return f instanceof File && f.size > 0 ? f : null;
}

/** Check a file, then store it (deduplicated by SHA-256). Returns the image id. */
export async function saveImage(db: Db, file: File): Promise<number> {
  if (file.size > MAX_IMAGE_BYTES)
    throw new InputError("Images must be 10 MiB or smaller.");
  const data = Buffer.from(await file.arrayBuffer());
  const mimeType = sniffMime(data);
  if (!mimeType)
    throw new InputError("Only JPEG, PNG, WebP and GIF images are allowed.");

  const sha256 = createHash("sha256").update(data).digest("hex");
  const existing = await findImageIdByHash(db, sha256);
  if (existing !== null) return existing;
  return insertImage(db, { sha256, mimeType, byteSize: data.length, data });
}
