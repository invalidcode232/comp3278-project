import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { Db } from "../db";

/** Comment projection enriched with author identity, computed likes, and viewer-specific state. */
export interface CommentView {
  /** Stable identifier used to reference this record. */
  id: number;
  /** Numeric key of the parent thread. */
  thread_id: number;
  /** Internal UUID of the content author. */
  author_id: string;
  /** Optional plain-text content; null means image-only content. */
  body: string | null;
  /** Shared attachment image ID, or null for text-only content. */
  image_id: number | null;
  /** Creation timestamp decoded as a Date from UTC storage. */
  created_at: Date;
  /** Whether the modification timestamp is later than creation. */
  edited: number;
  /** Public account handle used in profile URLs. */
  handle: string;
  /** Human-readable account name shown in the UI. */
  display_name: string;
  /** Shared avatar image ID, or null for the initial fallback. */
  avatar_image_id: number | null;
  /** Computed number of distinct users liking this content. */
  like_count: number;
  /** SQL EXISTS result: 1 when the current viewer likes this content, otherwise 0. */
  liked_by_me: number;
}

/** Comments on a thread, oldest first, with like count and "liked by me".
 * @param db Pool or transaction connection used for all queries in this operation.
 * @param viewerId Authenticated viewer UUID, or null for public access when permitted.
 * @param threadId Numeric identifier of the target thread.
 */
export async function listComments(
  db: Db,
  viewerId: string | null,
  threadId: number,
): Promise<CommentView[]> {
  const [rows] = await db.execute<(CommentView & RowDataPacket)[]>(
    `SELECT c.id, c.thread_id, c.author_id, c.body, c.image_id, c.created_at,
            (c.updated_at > c.created_at) AS edited,
            u.handle, u.display_name, u.avatar_image_id,
            (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.id) AS like_count,
            EXISTS (SELECT 1 FROM comment_likes cl
                    WHERE cl.comment_id = c.id AND cl.user_id = ?)          AS liked_by_me
     FROM comments c
     JOIN users u ON u.id = c.author_id
     WHERE c.thread_id = ?
     ORDER BY c.created_at, c.id`,
    [viewerId, threadId],
  );
  return rows;
}

/** Read a comment’s ownership/content for mutation validation; return null when missing.
 * @param db Pool or transaction connection used for all queries in this operation.
 * @param commentId Numeric identifier of the target comment.
 */
export async function getComment(
  db: Db,
  commentId: number,
): Promise<{
  /** Stable identifier used to reference this record. */
  id: number;

  /** Numeric key of the parent thread. */
  thread_id: number;

  /** Internal UUID of the content author. */
  author_id: string;

  /** Optional plain-text content; null means image-only content. */
  body: string | null;

  /** Shared attachment image ID, or null for text-only content. */
  image_id: number | null;
} | null> {
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT id, thread_id, author_id, body, image_id FROM comments WHERE id = ?",
    [commentId],
  );
  const r = rows[0];
  return r
    ? {
        id: r.id,
        thread_id: r.thread_id,
        author_id: r.author_id,
        body: r.body,
        image_id: r.image_id,
      }
    : null;
}

/** Insert a comment using validated content; return its generated ID. Caller owns the image transaction.
 * @param c Validated comment payload with authenticated author and parent thread.
 * @param db Pool or transaction connection used for all queries in this operation.
 */
export async function createComment(
  db: Db,
  c: {
    /** Numeric identifier of the parent thread. */
    threadId: number;

    /** Authenticated author UUID supplied by the action, never trusted from form data. */
    authorId: string;

    /** Optional plain-text content; null means image-only content. */
    body: string | null;

    /** Shared image identifier; null uses the no-image presentation. */
    imageId: number | null;
  },
): Promise<number> {
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO comments (thread_id, author_id, body, image_id)
     VALUES (?, ?, ?, ?)`,
    [c.threadId, c.authorId, c.body, c.imageId],
  );
  return result.insertId;
}

/** Ownership check in the WHERE clause, same pattern as updateThread.
 * @param c Validated replacement text and optional image reference.
 * @param db Pool or transaction connection used for all queries in this operation.
 * @param commentId Numeric identifier of the target comment.
 * @param authorId Authenticated author UUID used to enforce ownership.
 */
export async function updateComment(
  db: Db,
  commentId: number,
  authorId: string,
  c: {
    /** Optional plain-text content; null means image-only content. */
    body: string | null;

    /** Shared image identifier; null uses the no-image presentation. */
    imageId: number | null;
  },
): Promise<boolean> {
  const [result] = await db.execute<ResultSetHeader>(
    `UPDATE comments
     SET body = ?, image_id = ?
     WHERE id = ? AND author_id = ?`,
    [c.body, c.imageId, commentId, authorId],
  );
  return result.affectedRows === 1;
}

/** Delete a comment only when the author matches; return whether a row was removed.
 * @param db Pool or transaction connection used for all queries in this operation.
 * @param commentId Numeric identifier of the target comment.
 * @param authorId Authenticated author UUID used to enforce ownership.
 */
export async function deleteComment(
  db: Db,
  commentId: number,
  authorId: string,
): Promise<boolean> {
  const [result] = await db.execute<ResultSetHeader>(
    "DELETE FROM comments WHERE id = ? AND author_id = ?",
    [commentId, authorId],
  );
  return result.affectedRows === 1;
}
