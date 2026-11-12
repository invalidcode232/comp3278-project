import type { Db } from "../db";

/** Set the authenticated user's desired like state on a live post. Caller owns the transaction.
 * The row lock coordinates with deletion, while the composite key makes retries idempotent.
 * @param db Transaction connection.
 * @param userId Authenticated account UUID.
 * @param postId Root or reply identifier.
 * @param liked Desired state, not a non-idempotent toggle.
 */
export async function setPostLike(
  db: Db,
  userId: string,
  postId: number,
  liked: boolean,
): Promise<void> {
  const [rows] = await db.execute(
    "SELECT id FROM posts WHERE id=? AND deleted_at IS NULL FOR UPDATE",
    [postId],
  );
  if (!(rows as unknown[]).length)
    throw new Error("This post is no longer available.");
  if (liked)
    await db.execute(
      "INSERT IGNORE INTO post_likes (user_id,post_id) VALUES (?,?)",
      [userId, postId],
    );
  else
    await db.execute("DELETE FROM post_likes WHERE user_id=? AND post_id=?", [
      userId,
      postId,
    ]);
}
