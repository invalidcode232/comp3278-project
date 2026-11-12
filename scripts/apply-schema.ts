/**
 * npm run db:schema — runs db/schema.sql (DROP DATABASE + CREATE DATABASE + tables).
 * Connection settings come from .env (loaded by `node --env-file=.env`).
 */
import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";

/** Apply the destructive development schema only when the configured database name matches; close the connection on all paths. */
async function main(): Promise<void> {
  const schemaPath = new URL("../db/schema.sql", import.meta.url);
  const sql = await readFile(schemaPath, "utf8");

  const dbName = /CREATE DATABASE\s+(\w+)/i.exec(sql)?.[1];
  const wanted = process.env.DB_NAME ?? "comp3278_social";
  if (dbName !== wanted) {
    throw new Error(
      `DB_NAME in .env is "${wanted}" but db/schema.sql creates "${dbName}". Set DB_NAME=${dbName}.`,
    );
  }

  // No `database` option: the database may not exist yet.
  // multipleStatements is enabled only for this one-off script, never in the app pool.
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    multipleStatements: true,
  });
  try {
    const [version] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT VERSION() AS v",
    );
    console.log(
      `Connected to MySQL ${version[0].v} at ${process.env.DB_HOST}:${process.env.DB_PORT}`,
    );
    await conn.query(sql);
    const [tables] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT table_name AS t FROM information_schema.tables WHERE table_schema = ? ORDER BY table_name",
      [dbName],
    );
    console.log(
      `Created database ${dbName} with ${tables.length} tables: ${tables.map((r) => r.t).join(", ")}`,
    );
  } finally {
    await conn.end();
  }
}

main().catch((err: unknown) => {
  console.error("db:schema failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
