import mysql from "mysql2/promise";
import type { Pool, PoolConnection } from "mysql2/promise";

/**
 * Anything that can run a query: the shared pool, or one connection that is
 * inside a transaction. Every function in src/lib/queries takes one of these
 * as its first argument, so the same SQL works both inside and outside a
 * transaction.
 */
export type Db = Pool | PoolConnection;

declare global {
  // Reuse one pool across hot reloads in `next dev`.
  var __mysqlPool: Pool | undefined;
}

/** Create a bounded MySQL pool with UTC decoding and UTC server sessions; connection errors propagate. */
function createPool(): Pool {
  const pool = mysql.createPool({
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "comp3278_social",
    connectionLimit: 10,
    // Store and read every DATETIME as UTC, whatever the server or Node time zone is.
    timezone: "Z",
  });
  // DEFAULT CURRENT_TIMESTAMP uses the session time zone, so pin it to UTC too.
  pool.pool.on("connection", (conn) => {
    conn.query("SET time_zone = '+00:00'");
  });
  return pool;
}

export const pool: Pool =
  globalThis.__mysqlPool ?? (globalThis.__mysqlPool = createPool());

/** Run fn inside BEGIN ... COMMIT on one connection; ROLLBACK if it throws. */
export async function withTransaction<T>(
  fn: (conn: PoolConnection) => Promise<T>,
): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** True if err is a MySQL error with the given code, e.g. "ER_DUP_ENTRY". */
export function isMysqlError(
  err: unknown,
  code: string,
): err is Error & { code: string; sqlMessage?: string } {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: unknown }).code === code
  );
}
