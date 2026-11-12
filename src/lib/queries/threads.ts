import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { Db } from "../db";

/** Thread projection with author/topic details and independently computed counts. */
export interface ThreadView {
  /** Stable identifier used to reference this record. */
  id: number;
  /** Internal UUID of the content author. */
  author_id: string;
  /** Optional plain-text content; null means image-only content. */
  body: string | null;
  /** Shared attachment image ID, or null for text-only content. */
  image_id: number | null;
  /** Creation timestamp decoded as a Date from UTC storage. */
  created_at: Date;
  /** Whether the modification timestamp is later than creation. */
  edited: number; // 1 when updated_at > created_at
  /** Public account handle used in profile URLs. */
  handle: string;
  /** Human-readable account name shown in the UI. */
  display_name: string;
  /** Shared avatar image ID, or null for the initial fallback. */
  avatar_image_id: number | null;
  /** Numeric key of the fixed seeded topic. */
  topic_id: number;
  /** Topic label displayed with the thread. */
  topic_name: string;
  /** Computed number of distinct users liking this content. */
  like_count: number;
  /** Computed number of comments belonging to this thread. */
  comment_count: number;
  /** SQL EXISTS result: 1 when the current viewer likes this content, otherwise 0. */
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

/** Shared thread projection with independent counts to avoid join multiplication. */
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

/** "All" feed: newest threads from everyone.
 * @param db Pool or transaction connection used for all queries in this operation.
 * @param viewerId Authenticated viewer UUID, or null for public access when permitted.
 */
export async function listAllThreads(
  db: Db,
  viewerId: string | null,
): Promise<ThreadView[]> {
  const [rows] = await db.execute<(ThreadView & RowDataPacket)[]>(
    `${THREAD_SELECT}
     ORDER BY t.created_at DESC, t.id DESC
     LIMIT 50`,
    [viewerId],
  );
  return rows;
}

/** "Following" feed: threads whose author the viewer follows.
 * @param db Pool or transaction connection used for all queries in this operation.
 * @param viewerId Authenticated viewer UUID, or null for public access when permitted.
 */
export async function listFollowingThreads(
  db: Db,
  viewerId: string,
): Promise<ThreadView[]> {
  const [rows] = await db.execute<(ThreadView & RowDataPacket)[]>(
    `${THREAD_SELECT}
     WHERE t.author_id IN (SELECT f.followee_id FROM follows f WHERE f.follower_id = ?)
     ORDER BY t.created_at DESC, t.id DESC
     LIMIT 50`,
    [viewerId, viewerId],
  );
  return rows;
}

/** Threads in one topic; served by the (topic_id, created_at) index.
 * @param db Pool or transaction connection used for all queries in this operation.
 * @param viewerId Authenticated viewer UUID, or null for public access when permitted.
 * @param topicId Numeric identifier of the seeded topic.
 */
export async function listTopicThreads(
  db: Db,
  viewerId: string | null,
  topicId: number,
): Promise<ThreadView[]> {
  const [rows] = await db.execute<(ThreadView & RowDataPacket)[]>(
    `${THREAD_SELECT}
     WHERE t.topic_id = ?
     ORDER BY t.created_at DESC, t.id DESC
     LIMIT 50`,
    [viewerId, topicId],
  );
  return rows;
}

/** A user's threads, for their profile page.
 * @param db Pool or transaction connection used for all queries in this operation.
 * @param viewerId Authenticated viewer UUID, or null for public access when permitted.
 * @param authorId Authenticated author UUID used to enforce ownership.
 */
export async function listUserThreads(
  db: Db,
  viewerId: string | null,
  authorId: string,
): Promise<ThreadView[]> {
  const [rows] = await db.execute<(ThreadView & RowDataPacket)[]>(
    `${THREAD_SELECT}
     WHERE t.author_id = ?
     ORDER BY t.created_at DESC, t.id DESC`,
    [viewerId, authorId],
  );
  return rows;
}

/** Threads saved in a collection, most recently saved first. Only the owner can read it.
 * @param db Pool or transaction connection used for all queries in this operation.
 * @param viewerId Authenticated viewer UUID, or null for public access when permitted.
 * @param collectionId Numeric identifier of the target collection.
 */
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

/** Read a thread with viewer-specific like state; return null when absent.
 * @param db Pool or transaction connection used for all queries in this operation.
 * @param viewerId Authenticated viewer UUID, or null for public access when permitted.
 * @param threadId Numeric identifier of the target thread.
 */
export async function getThread(
  db: Db,
  viewerId: string | null,
  threadId: number,
): Promise<ThreadView | null> {
  const [rows] = await db.execute<(ThreadView & RowDataPacket)[]>(
    `${THREAD_SELECT}
     WHERE t.id = ?`,
    [viewerId, threadId],
  );
  return rows[0] ?? null;
}

/** Called inside a transaction together with the image insert (see actions/threads.ts).
 * @param db Pool or transaction connection used for all queries in this operation.
 * @param t Validated thread content; author identity comes from the session.
 */
export async function createThread(
  db: Db,
  t: {
    /** Authenticated author UUID supplied by the action, never trusted from form data. */
    authorId: string;

    /** Seeded topic identifier fixed at thread creation. */
    topicId: number;

    /** Optional plain-text content; null means image-only content. */
    body: string | null;

    /** Shared image identifier; null uses the no-image presentation. */
    imageId: number | null;
  },
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
 *
 * @param db Pool or transaction connection used for all queries in this operation.
 * @param threadId Numeric identifier of the target thread.
 * @param authorId Authenticated author UUID used to enforce ownership.
 * @param t Validated thread content; author identity comes from the session.
 */
export async function updateThread(
  db: Db,
  threadId: number,
  authorId: string,
  t: {
    /** Optional plain-text content; null means image-only content. */
    body: string | null;

    /** Shared image identifier; null uses the no-image presentation. */
    imageId: number | null;
  },
): Promise<boolean> {
  const [result] = await db.execute<ResultSetHeader>(
    `UPDATE threads
     SET body = ?, image_id = ?
     WHERE id = ? AND author_id = ?`,
    [t.body, t.imageId, threadId, authorId],
  );
  return result.affectedRows === 1;
}

/** Comments, likes and collection entries go with it via ON DELETE CASCADE.
 * @param db Pool or transaction connection used for all queries in this operation.
 * @param threadId Numeric identifier of the target thread.
 * @param authorId Authenticated author UUID used to enforce ownership.
 */
export async function deleteThread(
  db: Db,
  threadId: number,
  authorId: string,
): Promise<boolean> {
  const [result] = await db.execute<ResultSetHeader>(
    "DELETE FROM threads WHERE id = ? AND author_id = ?",
    [threadId, authorId],
  );
  return result.affectedRows === 1;
}
