import type { ResultSetHeader } from "mysql2/promise";
import type { Db } from "../db";

/*
 * Like toggles. The composite PRIMARY KEY (user_id, thread_id) means a user
 * can like a thread at most once, so:
 *   INSERT IGNORE inserted a row  -> it was not liked before; now it is.
 *   INSERT IGNORE inserted nothing -> it was already liked; DELETE to unlike.
 * No "SELECT first" round trip, and two quick clicks can never create two rows.
 * Note: INSERT IGNORE also turns a foreign-key failure (thread deleted
 * meanwhile) into a warning; the DELETE then does nothing, which is harmless.
 * Returns true if the viewer now likes it.
 */
/** Insert or remove the user/thread pair and return the resulting liked state.
 * @param db Pool or transaction connection used for all queries in this operation.
 * @param userId Stable UUID of the account involved in the operation.
 * @param threadId Numeric identifier of the target thread.
 */
export async function toggleThreadLike(
  db: Db,
  userId: string,
  threadId: number,
): Promise<boolean> {
  const [ins] = await db.execute<ResultSetHeader>(
    "INSERT IGNORE INTO thread_likes (user_id, thread_id) VALUES (?, ?)",
    [userId, threadId],
  );
  if (ins.affectedRows === 1) return true;
  await db.execute(
    "DELETE FROM thread_likes WHERE user_id = ? AND thread_id = ?",
    [userId, threadId],
  );
  return false;
}

/** Insert or remove the user/comment pair and return the resulting liked state.
 * @param db Pool or transaction connection used for all queries in this operation.
 * @param userId Stable UUID of the account involved in the operation.
 * @param commentId Numeric identifier of the target comment.
 */
export async function toggleCommentLike(
  db: Db,
  userId: string,
  commentId: number,
): Promise<boolean> {
  const [ins] = await db.execute<ResultSetHeader>(
    "INSERT IGNORE INTO comment_likes (user_id, comment_id) VALUES (?, ?)",
    [userId, commentId],
  );
  if (ins.affectedRows === 1) return true;
  await db.execute(
    "DELETE FROM comment_likes WHERE user_id = ? AND comment_id = ?",
    [userId, commentId],
  );
  return false;
}
