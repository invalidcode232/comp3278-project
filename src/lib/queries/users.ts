import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { Db } from "../db";

export interface UserRow {
  id: string;
  handle: string;
  email: string;
  display_name: string;
  bio: string | null;
  avatar_image_id: number | null;
  created_at: Date;
}

export async function createUser(
  db: Db,
  u: { id: string; handle: string; email: string; passwordHash: string; displayName: string },
): Promise<void> {
  await db.execute(
    `INSERT INTO users (id, handle, email, password_hash, display_name)
     VALUES (?, ?, ?, ?, ?)`,
    [u.id, u.handle, u.email, u.passwordHash, u.displayName],
  );
}

export async function findLoginByEmail(
  db: Db,
  email: string,
): Promise<{ id: string; password_hash: string } | null> {
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT id, password_hash FROM users WHERE email = ?",
    [email],
  );
  return rows.length ? { id: rows[0].id, password_hash: rows[0].password_hash } : null;
}

export async function getUserById(db: Db, id: string): Promise<UserRow | null> {
  const [rows] = await db.execute<(UserRow & RowDataPacket)[]>(
    `SELECT id, handle, email, display_name, bio, avatar_image_id, created_at
     FROM users WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

export async function getUserByHandle(db: Db, handle: string): Promise<UserRow | null> {
  const [rows] = await db.execute<(UserRow & RowDataPacket)[]>(
    `SELECT id, handle, email, display_name, bio, avatar_image_id, created_at
     FROM users WHERE handle = ?`,
    [handle],
  );
  return rows[0] ?? null;
}

/**
 * Edit profile. A taken handle raises ER_DUP_ENTRY on uq_users_handle,
 * which the action turns into a form error.
 */
export async function updateProfile(
  db: Db,
  id: string,
  p: { handle: string; displayName: string; bio: string | null; avatarImageId: number | null },
): Promise<void> {
  await db.execute(
    `UPDATE users
     SET handle = ?, display_name = ?, bio = ?, avatar_image_id = ?
     WHERE id = ?`,
    [p.handle, p.displayName, p.bio, p.avatarImageId, id],
  );
}

/**
 * Delete account. One statement is enough: every table that references
 * users.id has ON DELETE CASCADE (sessions, threads -> comments -> likes,
 * comments, likes, follows in both directions, collections -> collection_threads,
 * messages sent and received). InnoDB runs the whole cascade atomically.
 */
export async function deleteUser(db: Db, id: string): Promise<boolean> {
  const [result] = await db.execute<ResultSetHeader>("DELETE FROM users WHERE id = ?", [id]);
  return result.affectedRows === 1;
}
