import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { Db } from "../db";

export interface ThreadView {
  id: number;
  author_id: string;
  body: string | null;
  image_id: number | null;
  created_at: Date;
  edited: number; // 1 when updated_at > created_at
  handle: string;
  display_name: string;
  avatar_image_id: number | null;
  topic_id: number;
  topic_name: string;
  like_count: number;
  comment_count: number;
  liked_by_me: number; // 1 / 0 from EXISTS
}

/*
 * Shared SELECT for every list of threads. It is a constant string with no
 * user input; each function below appends its own constant WHERE / ORDER BY.
 * The first ? is always the viewer's user id (or NULL when logged out).
 *
 * The counts are correlated subqueries rather than JOIN + GROUP BY: joining
 * thread_likes and comments together would multiply rows (likes x comments)
 * and inflate both counts. Each subquery uses an index on thread_id.
 */
const THREAD_SELECT = `
  SELECT t.id, t.author_id, t.body, t.image_id, t.created_at,
         (t.updated_at > t.created_at) AS edited,
         u.handle, u.display_name, u.avatar_image_id,
         tp.id AS topic_id, tp.name AS topic_name,
         (SELECT COUNT(*) FROM thread_likes tl WHERE tl.thread_id = t.id) AS like_count,
         (SELECT COUNT(*) FROM comments c WHERE c.thread_id = t.id)       AS comment_count,
         EXISTS (SELECT 1 FROM thread_likes tl
                 WHERE tl.thread_id = t.id AND tl.user_id = ?)          AS liked_by_me
  FROM threads t
  JOIN users  u  ON u.id  = t.author_id
  JOIN topics tp ON tp.id = t.topic_id`;


/** "All" feed: newest threads from everyone. */
export async function listAllThreads(db: Db, viewerId: string | null): Promise<ThreadView[]> {
  const [rows] = await db.execute<(ThreadView & RowDataPacket)[]>(
    `${THREAD_SELECT}
     ORDER BY t.created_at DESC, t.id DESC
     LIMIT 50`,
    [viewerId],
  );
  return rows;
}

/** "Following" feed: threads whose author the viewer follows. */
export async function listFollowingThreads(db: Db, viewerId: string): Promise<ThreadView[]> {
  const [rows] = await db.execute<(ThreadView & RowDataPacket)[]>(
    `${THREAD_SELECT}
     WHERE t.author_id IN (SELECT f.followee_id FROM follows f WHERE f.follower_id = ?)
     ORDER BY t.created_at DESC, t.id DESC
     LIMIT 50`,
    [viewerId, viewerId],
  );
  return rows;
}

/** Threads in one topic; served by the (topic_id, created_at) index. */
export async function listTopicThreads(db: Db, viewerId: string | null, topicId: number): Promise<ThreadView[]> {
  const [rows] = await db.execute<(ThreadView & RowDataPacket)[]>(
    `${THREAD_SELECT}
     WHERE t.topic_id = ?
     ORDER BY t.created_at DESC, t.id DESC
     LIMIT 50`,
    [viewerId, topicId],
  );
  return rows;
}

/** A user's threads, for their profile page. */
export async function listUserThreads(db: Db, viewerId: string | null, authorId: string): Promise<ThreadView[]> {
  const [rows] = await db.execute<(ThreadView & RowDataPacket)[]>(
    `${THREAD_SELECT}
     WHERE t.author_id = ?
     ORDER BY t.created_at DESC, t.id DESC`,
    [viewerId, authorId],
  );
  return rows;
}

/** Threads saved in a collection, most recently saved first. Only the owner can read it. */
export async function listCollectionThreads(
  db: Db,
  viewerId: string,
  collectionId: number,
): Promise<ThreadView[]> {
  const [rows] = await db.execute<(ThreadView & RowDataPacket)[]>(
    `${THREAD_SELECT}
     JOIN collection_threads ct ON ct.thread_id = t.id
     JOIN collections col       ON col.id = ct.collection_id
     WHERE ct.collection_id = ? AND col.owner_id = ?
     ORDER BY ct.saved_at DESC, t.id DESC`,
    [viewerId, collectionId, viewerId],
  );
  return rows;
}

export async function getThread(db: Db, viewerId: string | null, threadId: number): Promise<ThreadView | null> {
  const [rows] = await db.execute<(ThreadView & RowDataPacket)[]>(
    `${THREAD_SELECT}
     WHERE t.id = ?`,
    [viewerId, threadId],
  );
  return rows[0] ?? null;
}

/** Called inside a transaction together with the image insert (see actions/threads.ts). */
export async function createThread(
  db: Db,
  t: { authorId: string; topicId: number; body: string | null; imageId: number | null },
): Promise<number> {
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO threads (author_id, topic_id, body, image_id)
     VALUES (?, ?, ?, ?)`,
    [t.authorId, t.topicId, t.body, t.imageId],
  );
  return result.insertId;
}

/**
 * Ownership is enforced in the WHERE clause: if the thread is not yours,
 * no row matches and affectedRows is 0. updated_at changes automatically
 * (ON UPDATE CURRENT_TIMESTAMP), which drives the "(edited)" marker.
 */
export async function updateThread(
  db: Db,
  threadId: number,
  authorId: string,
  t: { body: string | null; imageId: number | null },
): Promise<boolean> {
  const [result] = await db.execute<ResultSetHeader>(
    `UPDATE threads
     SET body = ?, image_id = ?
     WHERE id = ? AND author_id = ?`,
    [t.body, t.imageId, threadId, authorId],
  );
  return result.affectedRows === 1;
}

/** Comments, likes and collection entries go with it via ON DELETE CASCADE. */
export async function deleteThread(db: Db, threadId: number, authorId: string): Promise<boolean> {
  const [result] = await db.execute<ResultSetHeader>(
    "DELETE FROM threads WHERE id = ? AND author_id = ?",
    [threadId, authorId],
  );
  return result.affectedRows === 1;
}
