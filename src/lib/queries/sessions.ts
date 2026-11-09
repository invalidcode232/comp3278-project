import type { RowDataPacket } from "mysql2/promise";
import type { Db } from "../db";

export const SESSION_DAYS = 30;

export interface SessionUser {
  id: string;
  handle: string;
  display_name: string;
  avatar_image_id: number | null;
}

export async function createSession(db: Db, token: string, userId: string): Promise<void> {
  await db.execute(
    `INSERT INTO sessions (token, user_id, expires_at)
     VALUES (?, ?, UTC_TIMESTAMP() + INTERVAL 30 DAY)`,
    [token, userId],
  );
}

/** The logged-in user for a cookie token, or null if the token is unknown or expired. */
export async function getSessionUser(db: Db, token: string): Promise<SessionUser | null> {
  const [rows] = await db.execute<(SessionUser & RowDataPacket)[]>(
    `SELECT u.id, u.handle, u.display_name, u.avatar_image_id
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > UTC_TIMESTAMP()`,
    [token],
  );
  return rows[0] ?? null;
}

export async function deleteSession(db: Db, token: string): Promise<void> {
  await db.execute("DELETE FROM sessions WHERE token = ?", [token]);
}

/** Housekeeping on each login: drop this user's expired sessions. */
export async function deleteExpiredSessions(db: Db, userId: string): Promise<void> {
  await db.execute(
    "DELETE FROM sessions WHERE user_id = ? AND expires_at <= UTC_TIMESTAMP()",
    [userId],
  );
}
