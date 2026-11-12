import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { Db } from "../db";

/** Post projection with author/topic details and independently computed counts. */
export interface PostView {
  /** Stable identifier used to reference this record. */
  id: number;
  /** Immediate parent, or null for a root post. Immutable after creation. */
  parent_id: number | null;
  /** Erasure timestamp; null means the post is active. */
  deleted_at: Date | null;
  /** Internal UUID of the content author. */
  author_id: string | null;
  /** Optional plain-text content; null means image-only content. */
  body: string | null;
  /** Shared attachment image ID, or null for text-only content. */
  image_id: number | null;
  /** Creation timestamp decoded as a Date from UTC storage. */
  created_at: Date;
  /** Whether the modification timestamp is later than creation. */
  edited: number; // 1 when updated_at > created_at
  /** Public account handle used in profile URLs. */
  handle: string | null;
  /** Human-readable account name shown in the UI. */
  display_name: string | null;
  /** Shared avatar image ID, or null for the initial fallback. */
  avatar_image_id: number | null;
  /** Numeric key of the fixed seeded topic. */
  topic_id: number | null;
  /** Topic label displayed with the thread. */
  topic_name: string | null;
  /** Computed number of distinct users liking this content. */
  like_count: number;
  /** Computed number of active direct replies belonging to this post. */
  reply_count: number;
  /** SQL EXISTS result: 1 when the current viewer likes this content, otherwise 0. */
  liked_by_me: number; // 1 / 0 from EXISTS
}

/*
 * Shared SELECT for every list of threads. It is a constant string with no
 * user input; each function below appends its own constant WHERE / ORDER BY.
 * The first ? is always the viewer's user id (or NULL when logged out).
 *
 * The counts are correlated subqueries rather than JOIN + GROUP BY: joining
 * post_likes and replies together would multiply rows (likes x replies)
 * and inflate both counts. Each subquery uses an index on post_id.
 */

/** Shared thread projection with independent counts to avoid join multiplication. */
const POST_SELECT = `
  SELECT t.id, t.parent_id, t.deleted_at, t.author_id, t.body, t.image_id, t.created_at,
         (t.updated_at > t.created_at) AS edited,
         u.handle, u.display_name, u.avatar_image_id,
         tp.id AS topic_id, tp.name AS topic_name,
         (SELECT COUNT(*) FROM post_likes tl WHERE tl.post_id = t.id) AS like_count,
         (SELECT COUNT(*) FROM posts c WHERE c.parent_id = t.id AND c.deleted_at IS NULL)       AS reply_count,
         EXISTS (SELECT 1 FROM post_likes tl
                 WHERE tl.post_id = t.id AND tl.user_id = ?)          AS liked_by_me
  FROM posts t
  LEFT JOIN users  u  ON u.id  = t.author_id
  LEFT JOIN topics tp ON tp.id = t.topic_id`;

/** "All" feed: newest threads from everyone.
 * @param db Pool or transaction connection used for all queries in this operation.
 * @param viewerId Authenticated viewer UUID, or null for public access when permitted.
 */
export async function listAllPosts(
  db: Db,
  viewerId: string | null,
): Promise<PostView[]> {
  const [rows] = await db.execute<(PostView & RowDataPacket)[]>(
    `${POST_SELECT}
     WHERE t.parent_id IS NULL AND t.deleted_at IS NULL
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
export async function listFollowingPosts(
  db: Db,
  viewerId: string,
): Promise<PostView[]> {
  const [rows] = await db.execute<(PostView & RowDataPacket)[]>(
    `${POST_SELECT}
     WHERE t.parent_id IS NULL AND t.deleted_at IS NULL AND t.author_id IN (SELECT f.followee_id FROM follows f WHERE f.follower_id = ?)
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
export async function listTopicPosts(
  db: Db,
  viewerId: string | null,
  topicId: number,
): Promise<PostView[]> {
  const [rows] = await db.execute<(PostView & RowDataPacket)[]>(
    `${POST_SELECT}
     WHERE t.parent_id IS NULL AND t.deleted_at IS NULL AND t.topic_id = ?
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
export async function listUserPosts(
  db: Db,
  viewerId: string | null,
  authorId: string,
): Promise<PostView[]> {
  const [rows] = await db.execute<(PostView & RowDataPacket)[]>(
    `${POST_SELECT}
     WHERE t.parent_id IS NULL AND t.deleted_at IS NULL AND t.author_id = ?
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
export async function listCollectionPosts(
  db: Db,
  viewerId: string,
  collectionId: number,
): Promise<PostView[]> {
  const [rows] = await db.execute<(PostView & RowDataPacket)[]>(
    `${POST_SELECT}
     JOIN collection_posts ct ON ct.post_id = t.id
     JOIN collections col       ON col.id = ct.collection_id
     WHERE ct.collection_id = ? AND col.owner_id = ? AND t.deleted_at IS NULL
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
export async function getPost(
  db: Db,
  viewerId: string | null,
  threadId: number,
): Promise<PostView | null> {
  const [rows] = await db.execute<(PostView & RowDataPacket)[]>(
    `${POST_SELECT}
     WHERE t.id = ?`,
    [viewerId, threadId],
  );
  return rows[0] ?? null;
}

/** Called inside a transaction together with the image insert (see actions/posts.ts).
 * @param db Pool or transaction connection used for all queries in this operation.
 * @param t Validated thread content; author identity comes from the session.
 */
export async function createPost(
  db: Db,
  t: {
    /** Authenticated author UUID supplied by the action, never trusted from form data. */
    authorId: string;

    /** Seeded topic for a root; null for replies. */
    topicId: number | null;
    /** Existing immediate parent for a reply; null for a root. */
    parentId: number | null;

    /** Optional plain-text content; null means image-only content. */
    body: string | null;

    /** Shared image identifier; null uses the no-image presentation. */
    imageId: number | null;
  },
): Promise<number> {
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO posts (parent_id, author_id, topic_id, body, image_id)
     VALUES (?, ?, ?, ?, ?)`,
    [t.parentId, t.authorId, t.topicId, t.body, t.imageId],
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
export async function updatePost(
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
    `UPDATE posts
     SET body = ?, image_id = ?
     WHERE id = ? AND author_id = ? AND deleted_at IS NULL`,
    [t.body, t.imageId, threadId, authorId],
  );
  return result.affectedRows === 1;
}

/** Erase an owned post while retaining its identity and descendants. Caller owns the transaction.
 * @param db Transaction connection coordinated with image cleanup.
 * @param postId Post or reply to erase.
 * @param authorId Authenticated owner.
 * @returns Whether an active owned post was erased.
 */
export async function deletePost(
  db: Db,
  postId: number,
  authorId: string,
): Promise<boolean> {
  const [result] = await db.execute<ResultSetHeader>(
    `UPDATE posts SET body=NULL, image_id=NULL, author_id=NULL, deleted_at=UTC_TIMESTAMP()
     WHERE id=? AND author_id=? AND deleted_at IS NULL`,
    [postId, authorId],
  );
  if (!result.affectedRows) return false;
  await db.execute("DELETE FROM post_likes WHERE post_id=?", [postId]);
  await db.execute("DELETE FROM collection_posts WHERE post_id=?", [postId]);
  return true;
}

/** List direct children, including tombstones with surviving conversations, in chronological order.
 * @param db Query executor.
 * @param viewerId Current viewer or null.
 * @param parentId Immediate parent selected in the conversation view.
 */
export async function listReplies(
  db: Db,
  viewerId: string | null,
  parentId: number,
): Promise<PostView[]> {
  const [rows] = await db.execute<(PostView & RowDataPacket)[]>(
    `${POST_SELECT} WHERE t.parent_id=? ORDER BY t.created_at,t.id`,
    [viewerId, parentId],
  );
  return rows;
}

/** Retrieve ancestor context oldest-first using a recursive CTE; no nested UI indentation is needed.
 * Parent links are immutable and creation only references existing rows, so cycles cannot be formed by the app.
 * @param db Query executor.
 * @param viewerId Current viewer or null.
 * @param postId Selected root or reply.
 */
export async function listAncestors(
  db: Db,
  viewerId: string | null,
  postId: number,
): Promise<PostView[]> {
  const [rows] = await db.execute<(PostView & RowDataPacket)[]>(
    `WITH RECURSIVE ancestors AS (
       SELECT parent_id AS id, 1 AS depth FROM posts WHERE id=? AND parent_id IS NOT NULL
       UNION ALL SELECT p.parent_id,a.depth+1 FROM posts p JOIN ancestors a ON p.id=a.id
       WHERE p.parent_id IS NOT NULL
     ) ${POST_SELECT} JOIN ancestors a ON a.id=t.id ORDER BY a.depth DESC`,
    [postId, viewerId],
  );
  return rows;
}
