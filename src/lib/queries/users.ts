import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { Db } from "../db";

/** Account profile projection; never includes the password hash. */
export interface UserRow {
  /** Stable identifier used to reference this record. */
  id: string;
  /** Public account handle used in profile URLs. */
  handle: string;
  /** Unique account email used for sign-in. */
  email: string;
  /** Human-readable account name shown in the UI. */
  display_name: string;
  /** Optional profile biography; null means no biography. */
  bio: string | null;
  /** Shared avatar image ID, or null for the initial fallback. */
  avatar_image_id: number | null;
  /** Creation timestamp decoded as a Date from UTC storage. */
  created_at: Date;
}

/** Insert validated account fields with a pre-hashed password; unique handle/email conflicts propagate.
 * @param db Pool or transaction connection used for all queries in this operation.
 * @param u Validated registration fields including an already hashed password.
 */
export async function createUser(
  db: Db,
  u: {
    /** Stable identifier used to reference this record. */
    id: string;

    /** Public account handle used in profile URLs. */
    handle: string;

    /** Unique account email used for sign-in. */
    email: string;

    /** Salted bcrypt hash; never a plaintext password. */
    passwordHash: string;

    /** Human-readable account name displayed in profiles. */
    displayName: string;
  },
): Promise<void> {
  await db.execute(
    `INSERT INTO users (id, handle, email, password_hash, display_name)
     VALUES (?, ?, ?, ?, ?)`,
    [u.id, u.handle, u.email, u.passwordHash, u.displayName],
  );
}

/** Read only the internal ID and password hash needed for authentication; return null when unknown.
 * @param db Pool or transaction connection used for all queries in this operation.
 * @param email Account email used for sign-in lookup.
 */
export async function findLoginByEmail(
  db: Db,
  email: string,
): Promise<{
  /** Stable identifier used to reference this record. */
  id: string;

  /** Salted bcrypt hash used only for credential verification. */
  password_hash: string;
} | null> {
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT id, password_hash FROM users WHERE email = ?",
    [email],
  );
  return rows.length
    ? { id: rows[0].id, password_hash: rows[0].password_hash }
    : null;
}

/** Read profile fields by stable user UUID; return null when absent.
 * @param db Pool or transaction connection used for all queries in this operation.
 * @param id Stable identifier of the requested record.
 */
export async function getUserById(db: Db, id: string): Promise<UserRow | null> {
  const [rows] = await db.execute<(UserRow & RowDataPacket)[]>(
    `SELECT id, handle, email, display_name, bio, avatar_image_id, created_at
     FROM users WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

/** Read profile fields by public handle; return null when absent.
 * @param db Pool or transaction connection used for all queries in this operation.
 * @param handle Public account handle used for lookup.
 */
export async function getUserByHandle(
  db: Db,
  handle: string,
): Promise<UserRow | null> {
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
 *
 * @param db Pool or transaction connection used for all queries in this operation.
 * @param id Stable identifier of the requested record.
 * @param p Validated editable profile fields.
 */
export async function updateProfile(
  db: Db,
  id: string,
  p: {
    /** Public account handle used in profile URLs. */
    handle: string;

    /** Human-readable account name displayed in profiles. */
    displayName: string;

    /** Optional profile biography; null means no biography. */
    bio: string | null;

    /** Shared avatar identifier, or null to remove the avatar. */
    avatarImageId: number | null;
  },
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
 *
 * @param db Pool or transaction connection used for all queries in this operation.
 * @param id Stable identifier of the requested record.
 */
export async function deleteUser(db: Db, id: string): Promise<boolean> {
  const [result] = await db.execute<ResultSetHeader>(
    "DELETE FROM users WHERE id = ?",
    [id],
  );
  return result.affectedRows === 1;
}
