import type { RowDataPacket } from "mysql2/promise";
import type { Db } from "../db";

/** Seeded topic identity and descriptive text. */
export interface TopicRow {
  /** Stable identifier used to reference this record. */
  id: number;
  /** Human-readable label displayed for this record. */
  name: string;
  /** Descriptive text shown beneath the topic name. */
  description: string;
}

/** Seeded topic projection extended with the current number of threads. */
export interface TopicWithCount extends TopicRow {
  /** Computed number of associated threads; not a stored counter. */
  post_count: number;
}

/** LEFT JOIN keeps topics that have no threads yet (count 0).
 * @param db Pool or transaction connection used for all queries in this operation.
 */
export async function listTopicsWithCounts(db: Db): Promise<TopicWithCount[]> {
  const [rows] = await db.execute<(TopicWithCount & RowDataPacket)[]>(
    `SELECT tp.id, tp.name, tp.description, COUNT(t.id) AS post_count
     FROM topics tp
     LEFT JOIN posts t ON t.topic_id = tp.id AND t.parent_id IS NULL AND t.deleted_at IS NULL
     GROUP BY tp.id, tp.name, tp.description
     ORDER BY tp.name`,
  );
  return rows;
}

/** Read the seeded topic choices in name order.
 * @param db Pool or transaction connection used for all queries in this operation.
 */
export async function listTopics(db: Db): Promise<TopicRow[]> {
  const [rows] = await db.execute<(TopicRow & RowDataPacket)[]>(
    "SELECT id, name, description FROM topics ORDER BY name",
  );
  return rows;
}

/** Find a seeded topic by numeric ID; return null when missing.
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
