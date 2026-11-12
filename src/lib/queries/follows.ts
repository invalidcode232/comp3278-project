import type { RowDataPacket } from "mysql2/promise";
import type { Db } from "../db";

/** INSERT IGNORE: following someone you already follow is a no-op (composite PK).
 * @param db Pool or transaction connection used for all queries in this operation.
 * @param followerId UUID of the account performing the follow operation.
 * @param followeeId UUID of the account being followed.
 */
export async function follow(
  db: Db,
  followerId: string,
  followeeId: string,
): Promise<void> {
  await db.execute(
    "INSERT IGNORE INTO follows (follower_id, followee_id) VALUES (?, ?)",
    [followerId, followeeId],
  );
}

/** Remove a follower/followee pair; an absent relationship is a no-op.
 * @param db Pool or transaction connection used for all queries in this operation.
 * @param followerId UUID of the account performing the follow operation.
 * @param followeeId UUID of the account being followed.
 */
export async function unfollow(
  db: Db,
  followerId: string,
  followeeId: string,
): Promise<void> {
  await db.execute(
    "DELETE FROM follows WHERE follower_id = ? AND followee_id = ?",
    [followerId, followeeId],
  );
}

/**
 * Follower / following counts are computed, never stored, so they can't go
 * out of sync. followers uses idx_follows_followee; following uses the PK
 * (follower_id is its leftmost column).
 *
 * @param db Pool or transaction connection used for all queries in this operation.
 * @param userId Stable UUID of the account involved in the operation.
 */
export async function getFollowCounts(
  db: Db,
  userId: string,
): Promise<{
  /** Computed number of accounts following this user. */
  followers: number;
  /** Computed number of accounts this user follows. */
  following: number;
}> {
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT
       (SELECT COUNT(*) FROM follows WHERE followee_id = ?) AS followers,
       (SELECT COUNT(*) FROM follows WHERE follower_id = ?) AS following`,
    [userId, userId],
  );
  return {
    followers: Number(rows[0].followers),
    following: Number(rows[0].following),
  };
}

/** Return whether the specified follower/followee relationship exists.
 * @param db Pool or transaction connection used for all queries in this operation.
 * @param followerId UUID of the account performing the follow operation.
 * @param followeeId UUID of the account being followed.
 */
export async function isFollowing(
  db: Db,
  followerId: string,
  followeeId: string,
): Promise<boolean> {
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?",
    [followerId, followeeId],
  );
  return rows.length > 0;
}
