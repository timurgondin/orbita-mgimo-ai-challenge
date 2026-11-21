"use server";

import { revalidatePath } from "next/cache";
import { MAX_INTERESTS, MIN_INTERESTS, isFormat, isInterest } from "@/lib/coffee";
import { DEMO_NOW } from "@/lib/demo-clock";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { currentWeek, matchNow, slotsFor } from "./match";

export type CoffeeResult = { ok: true; message: string } | { ok: false; error: string };

const NOT_FOUND = "Встреча не найдена";
const idOk = (id: unknown): id is string => typeof id === "string" && /^[a-z0-9]{1,40}$/i.test(id);

const done = (message: string): CoffeeResult => {
  revalidatePath("/coffee");
  return { ok: true, message };
};

async function student() {
  const user = await requireUser();
  return user.role === "student" ? user : null;
}

/** Своё участие во встрече текущей недели. Чужие встречи недоступны: поиск только по паре (встреча, пользователь из сессии). */
async function myCurrent(matchId: unknown, userId: string) {
  if (!idOk(matchId)) return null;
  const m = await db.coffeeMember.findUnique({ where: { matchId_userId: { matchId, userId } }, include: { match: { include: { members: true } } } });
  if (!m || m.match.week !== currentWeek()) return null;
  return m;
}

/** Участвовать или изменить интересы и формат. Если пары на этой неделе ещё нет — подбираем сразу. */
export async function saveCoffee(input: unknown): Promise<CoffeeResult> {
  const user = await student();
  if (!user) return { ok: false, error: "Random Coffee — для студентов" };
  const { interests, format } = (input ?? {}) as { interests?: unknown; format?: unknown };
  if (!Array.isArray(interests) || !interests.every(isInterest) || !isFormat(format)) return { ok: false, error: "Неверные данные" };
  const list = [...new Set(interests)];
  if (list.length < MIN_INTERESTS || list.length > MAX_INTERESTS) return { ok: false, error: `Выберите от ${MIN_INTERESTS} до ${MAX_INTERESTS} интересов` };
  const existed = await db.coffeeProfile.findUnique({ where: { userId: user.id }, select: { active: true } });
  const data = { active: true, interests: JSON.stringify(list), format, updatedAt: DEMO_NOW };
  await db.coffeeProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });
  const matched = await matchNow(user.id);
  if (matched) return done("Пара на неделю найдена");
  return done(existed?.active ? "Сохранено" : "Вы участвуете");
}

/** Пауза: в новые раунды не попадаем. Текущая встреча остаётся. */
export async function pauseCoffee(): Promise<CoffeeResult> {
  const user = await student();
  if (!user) return { ok: false, error: "Random Coffee — для студентов" };
  const r = await db.coffeeProfile.updateMany({ where: { userId: user.id }, data: { active: false, updatedAt: DEMO_NOW } });
  if (!r.count) return { ok: false, error: "Вы не участвуете" };
  return done("Random Coffee на паузе");
}

/** «Встречаемся» или «Пропустить неделю» — только во встрече, где пользователь участвует. Пропуск отменяет встречу для обоих. */
export async function answerCoffee(matchId: unknown, value: unknown): Promise<CoffeeResult> {
  const user = await student();
  if (!user) return { ok: false, error: NOT_FOUND };
  if (value !== "yes" && value !== "skip") return { ok: false, error: "Неверный ответ" };
  const m = await myCurrent(matchId, user.id);
  if (!m) return { ok: false, error: NOT_FOUND };
  if (m.match.status !== "active") return { ok: false, error: "Встреча отменена" };
  if (m.match.startsAt <= DEMO_NOW) return { ok: false, error: "Встреча уже прошла" };
  await db.coffeeMember.update({ where: { id: m.id }, data: { answer: value } });
  if (value === "skip") {
    await db.coffeeMatch.update({ where: { id: m.matchId }, data: { status: "cancelled" } });
    return done("Неделя пропущена");
  }
  const other = m.match.members.find((x) => x.userId !== user.id);
  return done(other?.answer === "yes" ? "Встреча назначена" : "Ждём ответа пары");
}

/** Другое время — только из общих свободных окон обоих. Пара подтверждает заново. */
export async function rescheduleCoffee(matchId: unknown, startsAt: unknown): Promise<CoffeeResult> {
  const user = await student();
  if (!user) return { ok: false, error: NOT_FOUND };
  const m = await myCurrent(matchId, user.id);
  if (!m) return { ok: false, error: NOT_FOUND };
  if (m.match.status !== "active") return { ok: false, error: "Встреча отменена" };
  if (typeof startsAt !== "string" || startsAt.length > 40) return { ok: false, error: "Неверное время" };
  const slot = (await slotsFor(m.match.members.map((x) => x.userId))).find((s) => s.startsAt.toISOString() === startsAt);
  if (!slot) return { ok: false, error: "Это время занято" };
  await db.$transaction([
    db.coffeeMatch.update({ where: { id: m.matchId }, data: { startsAt: slot.startsAt, endsAt: slot.endsAt } }),
    db.coffeeMember.updateMany({ where: { matchId: m.matchId, userId: { not: user.id } }, data: { answer: "new" } }),
    db.coffeeMember.update({ where: { id: m.id }, data: { answer: "yes" } }),
  ]);
  return done("Новое время отправлено");
}

/** После встречи: состоялась ли. Только своя прошедшая встреча. */
export async function markCoffeeMet(matchId: unknown, met: unknown): Promise<CoffeeResult> {
  const user = await student();
  if (!user || !idOk(matchId) || typeof met !== "boolean") return { ok: false, error: NOT_FOUND };
  const m = await db.coffeeMember.findUnique({ where: { matchId_userId: { matchId, userId: user.id } }, include: { match: true } });
  if (!m || m.match.status !== "active") return { ok: false, error: NOT_FOUND };
  if (m.match.endsAt > DEMO_NOW) return { ok: false, error: "Встреча ещё впереди" };
  await db.coffeeMember.update({ where: { id: m.id }, data: { met } });
  return done(met ? "Отлично" : "Отмечено");
}
