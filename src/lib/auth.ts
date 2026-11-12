import { randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { pool } from "./db";
import {
  createSession,
  deleteExpiredSessions,
  deleteSession,
  getSessionUser,
} from "./queries/sessions";
import type { SessionUser } from "./queries/sessions";

import {
  SESSION_COOKIE as COOKIE,
  sessionCookieOptions,
} from "./session-policy";

/** The logged-in user, or null. Cached so a page and its layout share one query. */
export const getCurrentUser = cache(
  /** Resolve this request’s cookie to an unexpired account projection, or null. */
  async (): Promise<SessionUser | null> => {
    const token = (await cookies()).get(COOKIE)?.value;
    if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
    return getSessionUser(pool, token);
  },
);

/** For pages and actions that need a login: redirect to /login otherwise. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Create a session row and set the httpOnly cookie. Only callable from a Server Action.
 * @param userId Stable UUID of the account involved in the operation.
 */
export async function startSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  await deleteExpiredSessions(pool, userId);
  await createSession(pool, token, userId);
  (await cookies()).set(COOKIE, token, sessionCookieOptions());
}

/** Delete the current cookie’s session row and remove the browser cookie. */
export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await deleteSession(pool, token);
  jar.delete(COOKIE);
}

/** Drop the cookie only (the session row is already gone, e.g. after account deletion). */
export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
