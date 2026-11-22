import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/server/db/client";
import { SESSION_COOKIE, SESSION_TTL_SEC, SHORT_PREFIX, sessionCookieOptions } from "./cookie";

export type Role = "student" | "teacher" | "staff";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const TTL_MS = SESSION_TTL_SEC * 1000;
const TOUCH_EVERY_MS = 60 * 60 * 1000;

const SHORT_TTL_MS = 12 * 60 * 60 * 1000;

/** remember=false — сессионная cookie (до закрытия браузера), в БД живёт 12 ч без продления. */
export async function createSession(userId: string, remember = true): Promise<void> {
  const token = (remember ? "" : SHORT_PREFIX) + randomBytes(32).toString("base64url");
  await db.session.create({
    data: { id: sha256(token), userId, expiresAt: new Date(Date.now() + (remember ? TTL_MS : SHORT_TTL_MS)) },
  });
  const opts = sessionCookieOptions();
  (await cookies()).set(SESSION_COOKIE, token, remember ? opts : { ...opts, maxAge: undefined });
}

export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 128) return null;
  const id = sha256(token);
  const session = await db.session.findUnique({ where: { id }, include: { user: true } });
  if (!session) return null;
  const now = Date.now();
  if (session.expiresAt.getTime() <= now) {
    await db.session.deleteMany({ where: { id } });
    return null;
  }
  // скользящее продление
  if (now - session.lastSeenAt.getTime() > TOUCH_EVERY_MS) {
    const long = !token.startsWith(SHORT_PREFIX);
    await db.session.update({
      where: { id },
      data: { lastSeenAt: new Date(now), ...(long && { expiresAt: new Date(now + TTL_MS) }) },
    });
  }
  const { passwordHash: _omit, ...user } = session.user;
  void _omit;
  return user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role as Role)) redirect("/");
  return user;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: sha256(token) } });
  // те же атрибуты, что при выдаче: удаление __Host- cookie без Secure браузер игнорирует
  jar.set(SESSION_COOKIE, "", sessionCookieOptions(0));
}
