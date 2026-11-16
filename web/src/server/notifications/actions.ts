"use server";

import { revalidatePath } from "next/cache";
import { DEMO_NOW, formatDayMonth } from "@/lib/demo-clock";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db/client";

export type NotificationResult = { ok: true; message: string } | { ok: false; error: string };

const NOT_FOUND = "Уведомление не найдено";
const DONE: Record<string, string> = { library: "Книга продлена на две недели" };

/** Шторку открыли — всё непрочитанное стало прочитанным. «Нужно действие» остаётся висеть: прочитано ≠ решено. */
export async function markSeen(): Promise<void> {
  const user = await requireUser();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null, createdAt: { lte: DEMO_NOW } }, data: { readAt: DEMO_NOW } });
  revalidatePath("/", "layout");
}

/** Действие прямо в строке («Продлить»). Только своё, только action с actionKind=resolve и ещё не решённое. */
export async function resolveNotification(id: unknown): Promise<NotificationResult> {
  const user = await requireUser();
  if (typeof id !== "string" || !/^[a-z0-9]{1,40}$/i.test(id)) return { ok: false, error: NOT_FOUND };
  const n = await db.notification.findFirst({ where: { id, userId: user.id } });
  if (!n || n.createdAt > DEMO_NOW) return { ok: false, error: NOT_FOUND };
  if (n.level !== "action" || n.actionKind !== "resolve") return { ok: false, error: "Это уведомление не требует действия" };
  if (n.resolvedAt) return { ok: false, error: "Уже сделано" };
  // Книга: продление на 14 дней — строка в истории сразу говорит, что стало
  const extended = n.category === "library" && n.dueAt ? new Date(n.dueAt.getTime() + 14 * 86_400_000) : null;
  const book = n.title.match(/«[^»]+»/)?.[0];
  await db.notification.update({
    where: { id },
    data: {
      resolvedAt: DEMO_NOW,
      readAt: n.readAt ?? DEMO_NOW,
      ...(extended && book && { title: `${book} продлена`, body: `Вернуть до ${formatDayMonth(extended)}`, dueAt: extended }),
    },
  });
  revalidatePath("/", "layout");
  return { ok: true, message: DONE[n.category] ?? "Готово" };
}
