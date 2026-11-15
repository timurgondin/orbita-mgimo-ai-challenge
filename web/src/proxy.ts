import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, SHORT_PREFIX, SESSION_TTL_SEC, sessionCookieOptions } from "@/server/auth/cookie";

// Только дешёвая проверка наличия cookie. Настоящая проверка сессии — на сервере (requireUser).
export function proxy(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  const res = NextResponse.next();
  // скользящее продление cookie (срок в БД продлевает getCurrentUser)
  if (!token.startsWith(SHORT_PREFIX)) {
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(SESSION_TTL_SEC));
  }
  return res;
}

export const config = {
  // всё, кроме /login, публичной проверки документов /verify, служебных путей Next и статических файлов
  matcher: ["/((?!login|verify(?:/|$)|_next|favicon.ico|.*\\..*).*)"],
};
