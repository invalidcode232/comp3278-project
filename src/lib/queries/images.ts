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
