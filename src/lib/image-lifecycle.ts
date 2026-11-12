import { createHash } from "node:crypto";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { pool } from "./db";
import { deleteUnreferencedImages } from "./queries/images";

/** Database-scoped lock shared by every application process changing image references. */
const IMAGE_LOCK = `images:${createHash("sha256")
  .update(process.env.DB_NAME ?? "comp3278_social")
  .digest("hex")
  .slice(0, 48)}`;

/**
 * Run an image/reference mutation and orphan cleanup atomically on one connection.
 * A database-scoped advisory lock serializes these short writes across processes,
 * including deduplicated uploads, replacements, and account/thread cascades.
 * Acquire it before BEGIN and release after commit/rollback; never await network
 * uploads inside this callback. A lock timeout or SQL error rejects the operation.
 * @param fn Validated mutation; all queries must use the supplied connection.
 * @returns The callback result after commit. Errors roll back changes and cleanup.
 */
export async function withImageTransaction<T>(
  fn: (conn: PoolConnection) => Promise<T>,
): Promise<T> {
  const conn = await pool.getConnection();
  let locked = false;
  try {
    const [rows] = await conn.execute<RowDataPacket[]>(
      "SELECT GET_LOCK(?, 10) AS acquired",
      [IMAGE_LOCK],
    );
    if (rows[0].acquired !== 1)
      throw new Error("Image update is busy; please retry.");
    locked = true;
    await conn.beginTransaction();
    try {
      const result = await fn(conn);
      await deleteUnreferencedImages(conn);
      await conn.commit();
      return result;
    } catch (error) {
      await conn.rollback();
      throw error;
    }
  } finally {
    try {
      if (locked) await conn.execute("SELECT RELEASE_LOCK(?)", [IMAGE_LOCK]);
    } finally {
      conn.release();
    }
  }
}
