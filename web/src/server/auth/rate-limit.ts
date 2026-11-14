import "server-only";
import { db } from "@/server/db/client";

export const MAX_FAILS = 5; // на пару логин+IP
export const WINDOW_MS = 15 * 60 * 1000;

/** Возвращает минуты до разблокировки, если лимит исчерпан, иначе 0. */
export async function lockedMinutes(key: string, max: number = MAX_FAILS): Promise<number> {
  const since = new Date(Date.now() - WINDOW_MS);
  const rows = await db.loginAttempt.findMany({
    where: { key, createdAt: { gt: since } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  if (rows.length < max) return 0;
  const unlockAt = rows[rows.length - max].createdAt.getTime() + WINDOW_MS;
  return Math.max(1, Math.ceil((unlockAt - Date.now()) / 60_000));
}

export async function recordFailure(key: string): Promise<void> {
  await db.loginAttempt.create({ data: { key } });
  // чистим старое
  await db.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - WINDOW_MS) } } });
}

export async function clearFailures(key: string): Promise<void> {
  await db.loginAttempt.deleteMany({ where: { key } });
}
