import { NextResponse, type NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { renewSession } from "@/lib/queries/sessions";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session-policy";

/**
 * Renew a valid session on activity before rendering, where response cookies can
 * be written. The conditional SQL update grants only one renewal per 24 hours,
 * even for concurrent requests. Expired or missing sessions are never revived.
 * Pages/actions still enforce authentication independently of this convenience.
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (
    token &&
    /^[0-9a-f]{64}$/.test(token) &&
    (await renewSession(pool, token))
  ) {
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  }
  return response;
}

/** Apply activity renewal to application requests, excluding framework assets. */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
