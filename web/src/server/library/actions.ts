"use server";

import { revalidatePath } from "next/cache";
import { DEMO_NOW } from "@/lib/demo-clock";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { MAX_HOLDS } from "@/server/data/library";
import { renewLoanFor } from "./renew";

export type LibraryResult = { ok: true; message: string } | { ok: false; error: string };

const idOk = (id: unknown): id is string => typeof id === "string" && /^[a-z0-9]{1,40}$/i.test(id);

async function student() {
  const user = await requireUser();
  return user.role === "student" ? user : null;
}

/** Продлить свою книгу на две недели (правила — renewState). */
export async function renewLoan(id: unknown): Promise<LibraryResult> {
  const user = await student();
  if (!user || !idOk(id)) return { ok: false, error: "Книга не найдена" };
  const r = await renewLoanFor(user.id, id);
  if (!r.ok) return r;
  revalidatePath("/", "layout");
  return { ok: true, message: r.message };
}

/** Забронировать печатный экземпляр: забрать на абонементе за 3 дня по Орбита ID. Свободный экземпляр списывается в транзакции. */
export async function holdBook(bookId: unknown): Promise<LibraryResult> {
  const user = await student();
  if (!user || !idOk(bookId)) return { ok: false, error: "Книга не найдена" };
  try {
    const due = new Date(DEMO_NOW.getTime() + 3 * 86_400_000);
    due.setUTCHours(15, 0, 0, 0); // 18:00 МСК
    await db.$transaction(async (tx) => {
      const book = await tx.book.findUnique({ where: { id: bookId } });
      if (!book || book.format === "ebook") throw new Error("Книга не найдена");
      const mine = await tx.loan.findFirst({ where: { userId: user.id, bookId, returnedAt: null } });
      if (mine) throw new Error(mine.kind === "hold" ? "Уже забронирована" : "Книга уже у вас");
      const holds = await tx.loan.count({ where: { userId: user.id, kind: "hold", returnedAt: null } });
      if (holds >= MAX_HOLDS) throw new Error(`Не больше ${MAX_HOLDS} броней`);
      const r = await tx.book.updateMany({ where: { id: bookId, available: { gt: 0 } }, data: { available: { decrement: 1 } } });
      if (!r.count) throw new Error("Свободных экземпляров нет");
      await tx.loan.create({ data: { userId: user.id, bookId, kind: "hold", inventory: "Абонемент, корпус А", takenAt: DEMO_NOW, dueAt: due } });
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Не получилось" };
  }
  revalidatePath("/library");
  return { ok: true, message: "Забронировано: заберите на абонементе с Орбита ID" };
}

/** Отменить свою бронь — экземпляр снова свободен. */
export async function cancelHold(id: unknown): Promise<LibraryResult> {
  const user = await student();
  if (!user || !idOk(id)) return { ok: false, error: "Бронь не найдена" };
  const loan = await db.loan.findFirst({ where: { id, userId: user.id, kind: "hold", returnedAt: null } });
  if (!loan) return { ok: false, error: "Бронь не найдена" };
  await db.$transaction([db.loan.delete({ where: { id: loan.id } }), db.book.update({ where: { id: loan.bookId }, data: { available: { increment: 1 } } })]);
  revalidatePath("/library");
  return { ok: true, message: "Бронь отменена" };
}

/** Запомнить страницу в электронной книге. */
export async function saveReading(bookId: unknown, page: unknown): Promise<LibraryResult> {
  const user = await student();
  if (!user || !idOk(bookId) || typeof page !== "number" || !Number.isInteger(page) || page < 1) return { ok: false, error: "Книга не найдена" };
  const book = await db.book.findUnique({ where: { id: bookId }, select: { id: true, pages: true, format: true } });
  if (!book || book.format === "print" || page > book.pages) return { ok: false, error: "Книга не найдена" };
  await db.reading.upsert({
    where: { userId_bookId: { userId: user.id, bookId: book.id } },
    create: { userId: user.id, bookId: book.id, page, lastAt: DEMO_NOW },
    update: { page, lastAt: DEMO_NOW },
  });
  return { ok: true, message: "Сохранено" };
}
