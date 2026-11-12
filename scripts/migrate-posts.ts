/** Preserving one-time posts migration. Stop the app and back up MySQL before running.
 * Copies into new tables, verifies counts, then removes obsolete entity tables.
 * DDL is not transactional in MySQL: on failure the original tables remain until
 * verification succeeds; restore the backup before retrying a partially applied run.
 */
import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";

/** Migrate only the selected database, refusing partial/unknown schemas and preserving existing root IDs. */
async function main(): Promise<void> {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "comp3278_social",
    multipleStatements: true,
  });
  try {
    const [tables] = await conn.query<mysql.RowDataPacket[]>("SHOW TABLES");
    const names = tables.map(
      /** Extract the single table-name column. */ (row) =>
        String(Object.values(row)[0]),
    );
    if (names.includes("posts") && !names.includes("threads")) {
      console.log("Unified posts schema already installed.");
      return;
    }
    if (names.includes("posts") || !names.includes("comments"))
      throw new Error(
        "Unexpected or partial schema; restore the verified backup before retrying.",
      );
    const [before] = await conn.query<mysql.RowDataPacket[]>(`SELECT
      (SELECT COUNT(*) FROM threads)+(SELECT COUNT(*) FROM comments) AS posts,
      (SELECT COUNT(*) FROM thread_likes)+(SELECT COUNT(*) FROM comment_likes) AS likes,
      (SELECT COUNT(*) FROM collection_threads) AS saves`);
    const sql = await readFile(
      new URL("../db/migrations/003-unified-posts.sql", import.meta.url),
      "utf8",
    );
    const [copy, finish] = sql.split("-- Drop obsolete storage");
    await conn.query(copy);
    const [after] = await conn.query<mysql.RowDataPacket[]>(`SELECT
      (SELECT COUNT(*) FROM posts) AS posts, (SELECT COUNT(*) FROM post_likes) AS likes,
      (SELECT COUNT(*) FROM collection_posts) AS saves`);
    if (JSON.stringify(before[0]) !== JSON.stringify(after[0]))
      throw new Error(
        "Migration count mismatch; original tables retained. Restore backup before retrying.",
      );
    await conn.query(`-- Drop obsolete storage${finish}`);
    console.log("Migrated and verified:", after[0]);
  } finally {
    await conn.end();
  }
}
main().catch(
  /** Fail without disclosing connection configuration. */ (error: unknown) => {
    console.error(error instanceof Error ? error.message : "Migration failed");
    process.exitCode = 1;
  },
);
