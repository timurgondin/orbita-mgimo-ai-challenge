// Без "server-only": используется и в proxy.
const secure =
  process.env.COOKIE_SECURE !== undefined && process.env.COOKIE_SECURE !== ""
    ? process.env.COOKIE_SECURE === "true"
    : process.env.NODE_ENV === "production";

export const SESSION_COOKIE = secure ? "__Host-orbita_session" : "orbita_session";
export const SESSION_TTL_SEC = 60 * 60 * 24 * 30;

export function sessionCookieOptions(maxAge = SESSION_TTL_SEC) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/** Префикс токена «не запоминать»: такую cookie proxy не продлевает. */
export const SHORT_PREFIX = "s.";
