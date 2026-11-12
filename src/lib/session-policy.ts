/** Browser cookie name shared by login, logout, and activity renewal. */
export const SESSION_COOKIE = "sid";
/** Inactivity window in days; renewal is throttled to once per 24 hours. */
export const SESSION_DAYS = 30;

/** Cookie settings for a newly created or renewed authenticated session. */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  };
}
