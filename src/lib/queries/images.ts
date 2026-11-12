import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { Db } from "../db";

/** Stored image payload and response metadata retrieved from MySQL. */
export interface ImageRow {
  /** Detected image media type used in the HTTP response. */
  mime_type: string;
  /** Unique hexadecimal SHA-256 digest of the stored bytes. */
  sha256: string;
  /** Original image bytes loaded from the BLOB column. */
  data: Buffer;
}

/** Cheap lookup by hash, so a duplicate upload doesn't resend the BLOB. */
export async function findImageIdByHash(
  db: Db,
  sha256: string,
): Promise<number | null> {
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT id FROM images WHERE sha256 = ?",
    [sha256],
  );
  return rows.length ? (rows[0].id as number) : null;
}

/**
 * Deduplicating insert. If a row with this sha256 already exists, the UNIQUE
 * key fires ON DUPLICATE KEY UPDATE, and `id = LAST_INSERT_ID(id)` makes
 * insertId return the existing row's id instead of a new one.
 * This is also race-safe if two identical uploads arrive at the same moment.
 */
export async function insertImage(
  db: Db,
  img: {
    /** Unique hexadecimal SHA-256 digest of the stored bytes. */
    sha256: string;
    mimeType: string;
    byteSize: number; /** Original image bytes loaded from the BLOB column. */
    data: Buffer;
  },
): Promise<number> {
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO images (sha256, mime_type, byte_size, data)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
    [img.sha256, img.mimeType, img.byteSize, img.data],
  );
  return result.insertId;
}

/** Used by GET /api/images/[id]. */
export async function getImage(db: Db, id: number): Promise<ImageRow | null> {
  const [rows] = await db.execute<(ImageRow & RowDataPacket)[]>(
    "SELECT mime_type, sha256, data FROM images WHERE id = ?",
    [id],
  );
  return rows[0] ?? null;
}

/**
 * Read an image only if currently public or attached to one of the viewer's DMs.
 * Public references are avatars, threads, and comments. Private collections do
 * not make saved public threads private. NULL viewer IDs cannot match DM access.
 * @param db Query executor for this request.
 * @param id Requested image identifier.
 * @param viewerId Authenticated user UUID, or null for a public visitor.
 * @returns Authorized payload, or null for both missing and inaccessible images.
 */
export async function getVisibleImage(
  db: Db,
  id: number,
  viewerId: string | null,
): Promise<ImageRow | null> {
  const [rows] = await db.execute<(ImageRow & RowDataPacket)[]>(
    `SELECT i.mime_type, i.sha256, i.data FROM images i
     WHERE i.id = ? AND (
       EXISTS (SELECT 1 FROM users u WHERE u.avatar_image_id = i.id)
       OR EXISTS (SELECT 1 FROM threads t WHERE t.image_id = i.id)
       OR EXISTS (SELECT 1 FROM comments c WHERE c.image_id = i.id)
       OR EXISTS (SELECT 1 FROM messages m WHERE m.image_id = i.id
                  AND (m.sender_id = ? OR m.recipient_id = ?))
     )`,
    [id, viewerId, viewerId],
  );
  return rows[0] ?? null;
}

/**
 * Remove images with no remaining reference, including rows orphaned by cascades.
 * Call only inside withImageTransaction, after all reference changes. Its shared
 * lock prevents another application mutation attaching an image during cleanup;
 * foreign keys provide a further integrity check. Returns deleted image count.
 */
export async function deleteUnreferencedImages(db: Db): Promise<number> {
  const [result] = await db.execute<ResultSetHeader>(
    `DELETE i FROM images i
     WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.avatar_image_id = i.id)
       AND NOT EXISTS (SELECT 1 FROM threads t WHERE t.image_id = i.id)
       AND NOT EXISTS (SELECT 1 FROM comments c WHERE c.image_id = i.id)
       AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.image_id = i.id)`,
  );
  return result.affectedRows;
}
