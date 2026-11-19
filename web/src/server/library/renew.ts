import "server-only";
import { DEMO_NOW, formatDayMonth } from "@/lib/demo-clock";
import { db } from "@/server/db/client";
import { RENEW_DAYS, renewState } from "@/server/data/library";

/**
 * Продление своей выдачи на две недели. Общая логика для кнопки в библиотеке и «Продлить» в уведомлении:
 * связанное уведомление (refId = book:<slug>) решается, его текст говорит, что стало.
 */
export async function renewLoanFor(userId: string, loanId: string): Promise<{ ok: true; message: string; dueAt: Date } | { ok: false; error: string }> {
  const loan = await db.loan.findFirst({ where: { id: loanId, userId }, include: { book: true } });
  if (!loan) return { ok: false, error: "Книга не найдена" };
  const st = renewState(loan, loan.book);
  if (!st.ok) return { ok: false, error: st.note };
  const dueAt = new Date(loan.dueAt.getTime() + RENEW_DAYS * 86_400_000);
  // гонка двух нажатий: обновляем, только если число продлений не изменилось
  const r = await db.loan.updateMany({ where: { id: loan.id, renewals: loan.renewals, returnedAt: null }, data: { dueAt, renewals: { increment: 1 } } });
  if (!r.count) return { ok: false, error: "Уже продлено" };
  await db.notification.updateMany({
    where: { userId, refId: `book:${loan.book.slug}`, resolvedAt: null },
    data: { resolvedAt: DEMO_NOW, readAt: DEMO_NOW, title: `«${loan.book.title}» продлена`, body: `Вернуть до ${formatDayMonth(dueAt)}`, dueAt },
  });
  return { ok: true, message: `Продлено до ${formatDayMonth(dueAt)}`, dueAt };
}
