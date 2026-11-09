import type { RowDataPacket } from "mysql2/promise";
import type { Db } from "../db";

export interface TopicRow {
  id: number;
  name: string;
  description: string;
}

export interface TopicWithCount extends TopicRow {
  thread_count: number;
}

/** LEFT JOIN keeps topics that have no threads yet (count 0). */
export async function listTopicsWithCounts(db: Db): Promise<TopicWithCount[]> {
  const [rows] = await db.execute<(TopicWithCount & RowDataPacket)[]>(
    `SELECT tp.id, tp.name, tp.description, COUNT(t.id) AS thread_count
     FROM topics tp
     LEFT JOIN threads t ON t.topic_id = tp.id
     GROUP BY tp.id, tp.name, tp.description
     ORDER BY tp.name`,
  );
  return rows;
}

export async function listTopics(db: Db): Promise<TopicRow[]> {
  const [rows] = await db.execute<(TopicRow & RowDataPacket)[]>(
    "SELECT id, name, description FROM topics ORDER BY name",
  );
  return rows;
}

export async function getTopic(db: Db, id: number): Promise<TopicRow | null> {
  const [rows] = await db.execute<(TopicRow & RowDataPacket)[]>(
    "SELECT id, name, description FROM topics WHERE id = ?",
    [id],
  );
  return rows[0] ?? null;
}
