import type { RowDataPacket } from "mysql2/promise";
import type { Db } from "../db";

/** Shared topic identity and descriptive text. */
export interface TopicRow {
  /** Stable identifier used to reference this record. */
  id: number;
  /** Human-readable label displayed for this record. */
  name: string;
  /** Descriptive text shown beneath the topic name. */
  description: string;
}

/** Shared topic projection extended with the current number of threads. */
export interface TopicWithCount extends TopicRow {
  /** Computed number of associated threads; not a stored counter. */
  post_count: number;
}

/** LEFT JOIN keeps topics that have no threads yet (count 0).
 * @param db Pool or transaction connection used for all queries in this operation.
 */
export async function listTopicsWithCounts(
  db: Db,
  query = "",
): Promise<TopicWithCount[]> {
  const [rows] = await db.execute<(TopicWithCount & RowDataPacket)[]>(
    `SELECT tp.id, tp.name, tp.description, COUNT(t.id) AS post_count
     FROM topics tp
     LEFT JOIN posts t ON t.topic_id = tp.id AND t.parent_id IS NULL AND t.deleted_at IS NULL
     WHERE LOCATE(?, tp.name) > 0 OR ? = ''
     GROUP BY tp.id, tp.name, tp.description
     ORDER BY tp.name`,
    [query, query],
  );
  return rows;
}

/** Read the shared topic choices in name order.
 * @param db Pool or transaction connection used for all queries in this operation.
 */
export async function listTopics(db: Db): Promise<TopicRow[]> {
  const [rows] = await db.execute<(TopicRow & RowDataPacket)[]>(
    "SELECT id, name, description FROM topics ORDER BY name",
  );
  return rows;
}

/** Find a shared topic by numeric ID; return null when missing.
 * @param db Pool or transaction connection used for all queries in this operation.
 * @param id Stable identifier of the requested record.
 */
export async function getTopic(db: Db, id: number): Promise<TopicRow | null> {
  const [rows] = await db.execute<(TopicRow & RowDataPacket)[]>(
    "SELECT id, name, description FROM topics WHERE id = ?",
    [id],
  );
  return rows[0] ?? null;
}

/** Find up to 20 public topics containing a literal substring, using the name column's
 * case/accent-insensitive collation. LOCATE treats %, _ and backslashes literally.
 * @param db Query connection or pool.
 * @param query Normalized topic substring; empty lists the first alphabetical suggestions.
 */
export async function searchTopics(db: Db, query: string): Promise<TopicRow[]> {
  const [rows] = await db.execute<(TopicRow & RowDataPacket)[]>(
    `SELECT id, name, description FROM topics
     WHERE LOCATE(?, name) > 0 OR ? = ''
     ORDER BY (name = ?) DESC, name LIMIT 20`,
    [query, query, query],
  );
  return rows;
}

/** Resolve a validated topic label inside the post-creation transaction. The existing
 * unique case/accent-insensitive name key merges concurrent equivalent labels and
 * preserves the first spelling; LAST_INSERT_ID returns either the new or reused ID.
 * Topics are shared vocabulary, not owned records. New labels have no description.
 */
export async function findOrCreateTopic(db: Db, name: string): Promise<number> {
  const [result] = await db.execute<import("mysql2/promise").ResultSetHeader>(
    `INSERT INTO topics (name, description) VALUES (?, '')
     ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
    [name],
  );
  return result.insertId;
}
