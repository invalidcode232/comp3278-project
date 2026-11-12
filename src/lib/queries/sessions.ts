import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { Db } from "../db";

import { SESSION_DAYS } from "../session-policy";

/** Minimal authenticated-user projection shared by server pages and actions. */
export interface SessionUser {
  /** Stable identifier used to reference this record. */
  id: string;
  /** Public account handle used in profile URLs. */
  handle: string;
  /** Human-readable account name shown in the UI. */
  display_name: string;
  /** Shared avatar image ID, or null for the initial fallback. */
  avatar_image_id: number | null;
}

/** Store a browser token with a 30-day database expiry for the supplied user.
 * @param db Pool or transaction connection used for all queries in this operation.
 * @param token Opaque browser session token; do not log or expose it.
 * @param userId Stable UUID of the account involved in the operation.
 */
export async function createSession(
  db: Db,
  token: string,
  userId: string,
): Promise<void> {
  await db.execute(
    `INSERT INTO sessions (token, user_id, expires_at)
     VALUES (?, ?, UTC_TIMESTAMP() + INTERVAL ? DAY)`,
    [token, userId, SESSION_DAYS],
  );
}

/** The logged-in user for a cookie token, or null if the token is unknown or expired.
 * @param db Pool or transaction connection used for all queries in this operation.
 * @param token Opaque browser session token; do not log or expose it.
 */
export async function getSessionUser(
  db: Db,
  token: string,
): Promise<SessionUser | null> {
  const [rows] = await db.execute<(SessionUser & RowDataPacket)[]>(
    `SELECT u.id, u.handle, u.display_name, u.avatar_image_id
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > UTC_TIMESTAMP()`,
    [token],
  );
  return rows[0] ?? null;
}

/** Revoke one browser token; missing sessions are harmless.
 * @param db Pool or transaction connection used for all queries in this operation.
 * @param token Opaque browser session token; do not log or expose it.
 */
export async function deleteSession(db: Db, token: string): Promise<void> {
  await db.execute("DELETE FROM sessions WHERE token = ?", [token]);
}

/** Housekeeping on each login: drop this user's expired sessions.
 * @param db Pool or transaction connection used for all queries in this operation.
 * @param userId Stable UUID of the account involved in the operation.
 */
export async function deleteExpiredSessions(
  db: Db,
  userId: string,
): Promise<void> {
  await db.execute(
    "DELETE FROM sessions WHERE user_id = ? AND expires_at <= UTC_TIMESTAMP()",
    [userId],
  );
}

/**
 * Extend an active session to 30 days from now only after 24 hours since its
 * last creation/renewal. expires_at - 30 days is the last renewal time, so no
 * additional stored timestamp is needed. The predicate is atomic under races.
 * Returns true only to the request responsible for refreshing the cookie.
 *
 * @param db Pool or transaction connection used for all queries in this operation.
 * @param token Opaque browser session token; do not log or expose it.
 */
export async function renewSession(db: Db, token: string): Promise<boolean> {
  const [result] = await db.execute<ResultSetHeader>(
    `UPDATE sessions SET expires_at = UTC_TIMESTAMP() + INTERVAL ? DAY
     WHERE token = ? AND expires_at > UTC_TIMESTAMP()
       AND expires_at <= UTC_TIMESTAMP() + INTERVAL ? DAY`,
    [SESSION_DAYS, token, SESSION_DAYS - 1],
  );
  return result.affectedRows === 1;
}
