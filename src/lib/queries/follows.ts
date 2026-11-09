import type { RowDataPacket } from "mysql2/promise";
import type { Db } from "../db";

/** INSERT IGNORE: following someone you already follow is a no-op (composite PK). */
export async function follow(db: Db, followerId: string, followeeId: string): Promise<void> {
  await db.execute(
    "INSERT IGNORE INTO follows (follower_id, followee_id) VALUES (?, ?)",
    [followerId, followeeId],
  );
}

export async function unfollow(db: Db, followerId: string, followeeId: string): Promise<void> {
  await db.execute(
    "DELETE FROM follows WHERE follower_id = ? AND followee_id = ?",
    [followerId, followeeId],
  );
}

/**
 * Follower / following counts are computed, never stored, so they can't go
 * out of sync. followers uses idx_follows_followee; following uses the PK
 * (follower_id is its leftmost column).
 */
export async function getFollowCounts(db: Db, userId: string): Promise<{ followers: number; following: number }> {
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT
       (SELECT COUNT(*) FROM follows WHERE followee_id = ?) AS followers,
       (SELECT COUNT(*) FROM follows WHERE follower_id = ?) AS following`,
    [userId, userId],
  );
  return { followers: Number(rows[0].followers), following: Number(rows[0].following) };
}

export async function isFollowing(db: Db, followerId: string, followeeId: string): Promise<boolean> {
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?",
    [followerId, followeeId],
  );
  return rows.length > 0;
}
