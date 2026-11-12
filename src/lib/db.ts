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

  /** Process-global pool cache retained during development hot reloads. */
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
  /** Pin each new connection to UTC so DEFAULT CURRENT_TIMESTAMP and Date decoding agree. */
  pool.pool.on(
    "connection",
    (conn) => {
      conn.query("SET time_zone = '+00:00'");
    },
  );
  return pool;
}

/** Shared MySQL connection pool reused across development hot reloads. */
export const pool: Pool =
  globalThis.__mysqlPool ?? (globalThis.__mysqlPool = createPool());

/** True if err is a MySQL error with the given code, e.g. "ER_DUP_ENTRY".
 * @param err Caught value whose driver code is inspected.
 * @param code Expected MySQL driver error identifier.
 */
export function isMysqlError(
  err: unknown,
  code: string,
): err is Error & {
  /** Driver error identifier used to distinguish expected database failures. */
  code: string;
  /** Optional driver message used only to identify the violated unique constraint. */
  sqlMessage?: string;
} {
  return (
    typeof err === "object" &&
    err !== null &&
    (
      err as {
        /** Driver error identifier used to distinguish expected database failures. */
        code?: unknown;
      }
    ).code === code
  );
}
