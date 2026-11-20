"use server";

import { revalidatePath } from "next/cache";
import { randomInt } from "node:crypto";
import { DEMO_NOW, addDays, dayStart, formatDayMonth, mskDate } from "@/lib/demo-clock";
import { MAX_ORDERS, pointById } from "@/lib/library-points";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { RENEW_DAYS, etaPhrase, readyAtFor } from "@/server/data/library";
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

/** Заказать печатный экземпляр в постамат или на станцию выдачи. Свободный экземпляр списывается в транзакции, забирают по Орбита ID. */
export async function orderBook(bookId: unknown, pointId: unknown): Promise<LibraryResult> {
  const user = await student();
  const point = pointById(pointId);
  if (!user || !idOk(bookId)) return { ok: false, error: "Книга не найдена" };
  if (!point) return { ok: false, error: "Выберите, где забрать" };
  const readyAt = readyAtFor(point);
  try {
    await db.$transaction(async (tx) => {
      const book = await tx.book.findUnique({ where: { id: bookId } });
      if (!book || book.format === "ebook") throw new Error("Книга не найдена");
      if (await tx.loan.findFirst({ where: { userId: user.id, bookId, returnedAt: null } })) throw new Error("Книга уже у вас");
      if (await tx.bookOrder.findFirst({ where: { userId: user.id, bookId, closedAt: null } })) throw new Error("Уже заказана");
      if ((await tx.bookOrder.count({ where: { userId: user.id, closedAt: null } })) >= MAX_ORDERS) throw new Error(`Не больше ${MAX_ORDERS} заказов сразу`);
      const r = await tx.book.updateMany({ where: { id: bookId, available: { gt: 0 } }, data: { available: { decrement: 1 } } });
      if (!r.count) throw new Error("Свободных экземпляров нет");
      await tx.bookOrder.create({ data: { userId: user.id, bookId, point: point.id, status: "packing", createdAt: DEMO_NOW, readyAt } });
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Не получилось" };
  }
  revalidatePath("/library");
  return { ok: true, message: `Заказано, привезём ${etaPhrase(readyAt)}` };
}

/** Отменить свой заказ — экземпляр снова свободен. */
export async function cancelOrder(id: unknown): Promise<LibraryResult> {
  const user = await student();
  if (!user || !idOk(id)) return { ok: false, error: "Заказ не найден" };
  const order = await db.bookOrder.findFirst({ where: { id, userId: user.id, closedAt: null } });
  if (!order) return { ok: false, error: "Заказ не найден" };
  await db.$transaction([
    db.bookOrder.update({ where: { id: order.id }, data: { status: "cancelled", closedAt: DEMO_NOW } }),
    db.book.update({ where: { id: order.bookId }, data: { available: { increment: 1 } } }),
  ]);
  revalidatePath("/library");
  return { ok: true, message: "Заказ отменён" };
}

/**
 * Забрать заказ: у постамата ячейка открывается по Орбита ID (здесь — кнопкой в окне, как в приложениях постаматов).
 * Заказ закрывается, книга появляется «на руках» на две недели.
 */
export async function pickupOrder(id: unknown): Promise<LibraryResult> {
  const user = await student();
  if (!user || !idOk(id)) return { ok: false, error: "Заказ не найден" };
  const dueAt = new Date(dayStart(addDays(mskDate(DEMO_NOW), RENEW_DAYS)).getTime() + 18 * 3_600_000);
  let cell: string | null = null;
  try {
    await db.$transaction(async (tx) => {
      const order = await tx.bookOrder.findFirst({ where: { id, userId: user.id, closedAt: null } });
      if (!order) throw new Error("Заказ не найден");
      if (order.status !== "ready") throw new Error("Книга ещё в пути");
      const r = await tx.bookOrder.updateMany({ where: { id: order.id, closedAt: null }, data: { status: "picked", closedAt: DEMO_NOW } });
      if (!r.count) throw new Error("Заказ уже получен");
      cell = order.cell;
      const inventory = `УБ-${String(100000 + randomInt(900000))}`;
      await tx.loan.create({ data: { userId: user.id, bookId: order.bookId, kind: "short", inventory, takenAt: DEMO_NOW, dueAt } });
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Не получилось" };
  }
  revalidatePath("/library");
  return { ok: true, message: `${cell ? `Ячейка ${cell} открыта` : "Книга выдана"}, вернуть до ${formatDayMonth(dueAt)}` };
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
