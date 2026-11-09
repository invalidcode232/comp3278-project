import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { Db } from "../db";

export interface CommentView {
  id: number;
  thread_id: number;
  author_id: string;
  body: string | null;
  image_id: number | null;
  created_at: Date;
  edited: number;
  handle: string;
  display_name: string;
  avatar_image_id: number | null;
  like_count: number;
  liked_by_me: number;
}

/** Comments on a thread, oldest first, with like count and "liked by me". */
export async function listComments(db: Db, viewerId: string | null, threadId: number): Promise<CommentView[]> {
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

export async function getComment(
  db: Db,
  commentId: number,
): Promise<{ id: number; thread_id: number; author_id: string; body: string | null; image_id: number | null } | null> {
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT id, thread_id, author_id, body, image_id FROM comments WHERE id = ?",
    [commentId],
  );
  const r = rows[0];
  return r ? { id: r.id, thread_id: r.thread_id, author_id: r.author_id, body: r.body, image_id: r.image_id } : null;
}

export async function createComment(
  db: Db,
  c: { threadId: number; authorId: string; body: string | null; imageId: number | null },
): Promise<number> {
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO comments (thread_id, author_id, body, image_id)
     VALUES (?, ?, ?, ?)`,
    [c.threadId, c.authorId, c.body, c.imageId],
  );
  return result.insertId;
}

/** Ownership check in the WHERE clause, same pattern as updateThread. */
export async function updateComment(
  db: Db,
  commentId: number,
  authorId: string,
  c: { body: string | null; imageId: number | null },
): Promise<boolean> {
  const [result] = await db.execute<ResultSetHeader>(
    `UPDATE comments
     SET body = ?, image_id = ?
     WHERE id = ? AND author_id = ?`,
    [c.body, c.imageId, commentId, authorId],
  );
  return result.affectedRows === 1;
}

export async function deleteComment(db: Db, commentId: number, authorId: string): Promise<boolean> {
  const [result] = await db.execute<ResultSetHeader>(
    "DELETE FROM comments WHERE id = ? AND author_id = ?",
    [commentId, authorId],
  );
  return result.affectedRows === 1;
}
