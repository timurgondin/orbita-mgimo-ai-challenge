"use server";

import { revalidatePath } from "next/cache";
import { DEMO_NOW, mskMinutes, mskTime } from "@/lib/demo-clock";
import { CHECKIN_BEFORE, CLOSE, DURATIONS, MAX_ACTIVE, OPEN, STEP, TITLE_MAX, hhmm, roomById } from "@/lib/rooms";
import { db } from "@/server/db/client";
import { bookingDays, bookingState, classBusy, holdsRoom, roomsUser } from "@/server/data/rooms";

export type RoomsResult = { ok: true; message: string } | { ok: false; error: string };

const idOk = (id: unknown): id is string => typeof id === "string" && /^[a-z0-9-]{1,40}$/i.test(id);
const at = (date: string, min: number) => new Date(`${date}T${hhmm(min)}:00+03:00`);

/**
 * Бронь комнаты. Всё проверяется здесь: комната из списка, день из недели брони, шаг 30 минут, кампус открыт,
 * не в прошлом, не на паре в аудитории, не поверх чужой или своей брони, не больше трёх будущих броней.
 */
export async function bookRoom(input: { roomId?: unknown; date?: unknown; start?: unknown; duration?: unknown; title?: unknown }): Promise<RoomsResult> {
  const user = await roomsUser();
  if (!user) return { ok: false, error: "Бронь доступна студентам и преподавателям" };
  const room = roomById(input?.roomId);
  if (!room) return { ok: false, error: "Комната не найдена" };
  const day = bookingDays().find((d) => d.date === input.date);
  if (!day) return { ok: false, error: "Бронировать можно на неделю вперёд, кроме воскресенья" };
  const start = Number(input.start);
  const duration = Number(input.duration);
  if (!Number.isInteger(start) || start % STEP || start < OPEN || start < day.minStart) return { ok: false, error: "Это время уже прошло" };
  if (!(DURATIONS as readonly number[]).includes(duration)) return { ok: false, error: "От 30 минут до 2 часов" };
  if (start + duration > CLOSE) return { ok: false, error: "Кампус открыт до 21:00" };
  const title = typeof input.title === "string" ? input.title.trim().replace(/\s+/g, " ").slice(0, TITLE_MAX) : "";

  const startsAt = at(day.date, start);
  const endsAt = at(day.date, start + duration);
  if (startsAt < DEMO_NOW) return { ok: false, error: "Это время уже прошло" };

  if (room.kind === "class") {
    const pairs = (await classBusy([room], [day.date])).get(`${room.id}|${day.date}`) ?? [];
    const hit = pairs.find((p) => p.from < start + duration && p.to > start);
    if (hit) return { ok: false, error: `В аудитории пара с ${hhmm(hit.from)} до ${hhmm(hit.to)}` };
  }

  // проверка и запись — в одной транзакции, чтобы две брони не встали на одно время
  return db.$transaction(async (tx) => {
    const overlap = { startsAt: { lt: endsAt }, endsAt: { gt: startsAt }, ...holdsRoom() };
    const taken = await tx.roomBooking.findFirst({ where: { roomId: room.id, ...overlap }, select: { startsAt: true, endsAt: true } });
    if (taken) return { ok: false as const, error: `Занято с ${mskTime(taken.startsAt)} до ${mskTime(taken.endsAt)}` };
    const mine = await tx.roomBooking.findFirst({ where: { userId: user.id, ...overlap }, select: { roomId: true } });
    if (mine) return { ok: false as const, error: `В это время у вас уже бронь: ${roomById(mine.roomId)?.name ?? "другая комната"}` };
    const active = await tx.roomBooking.count({ where: { userId: user.id, endsAt: { gt: DEMO_NOW }, ...holdsRoom() } });
    if (active >= MAX_ACTIVE) return { ok: false as const, error: `Не больше ${MAX_ACTIVE} броней вперёд` };
    await tx.roomBooking.create({ data: { roomId: room.id, userId: user.id, title: title || null, startsAt, endsAt, status: "booked", createdAt: DEMO_NOW } });
    revalidatePath("/rooms");
    return { ok: true as const, message: `${room.name}: ${day.label.toLowerCase()} с ${hhmm(start)} до ${hhmm(start + duration)}` };
  });
}

async function own(id: unknown) {
  const user = await roomsUser();
  if (!user || !idOk(id)) return null;
  return db.roomBooking.findFirst({ where: { id, userId: user.id } });
}

/** Отметка у двери по Орбита ID: с 15 минут до начала до 15 минут после. */
export async function checkIn(id: unknown): Promise<RoomsResult> {
  const b = await own(id);
  if (!b) return { ok: false, error: "Бронь не найдена" };
  const state = bookingState(b);
  if (state === "upcoming") return { ok: false, error: `Отметиться можно с ${hhmm(mskMinutes(b.startsAt) - CHECKIN_BEFORE)}` };
  if (state === "missed") return { ok: false, error: "Бронь снята: прошло больше 15 минут" };
  if (state !== "checkin") return { ok: false, error: "Бронь не найдена" };
  const r = await db.roomBooking.updateMany({ where: { id: b.id, userId: b.userId, status: "booked" }, data: { status: "checked", checkedAt: DEMO_NOW } });
  if (!r.count) return { ok: false, error: "Бронь не найдена" };
  revalidatePath("/rooms");
  return { ok: true, message: `Комната ваша до ${mskTime(b.endsAt)}` };
}

/** Освободить раньше: комната сразу видна другим свободной. */
export async function releaseRoom(id: unknown): Promise<RoomsResult> {
  const b = await own(id);
  if (!b || bookingState(b) !== "active") return { ok: false, error: "Бронь не найдена" };
  await db.roomBooking.updateMany({ where: { id: b.id, userId: b.userId, status: "checked" }, data: { endsAt: DEMO_NOW } });
  revalidatePath("/rooms");
  return { ok: true, message: "Комната освобождена" };
}

export async function cancelBooking(id: unknown): Promise<RoomsResult> {
  const b = await own(id);
  if (!b) return { ok: false, error: "Бронь не найдена" };
  const state = bookingState(b);
  if (state !== "upcoming" && state !== "checkin") return { ok: false, error: "Эту бронь уже не отменить" };
  await db.roomBooking.updateMany({ where: { id: b.id, userId: b.userId, status: "booked" }, data: { status: "cancelled" } });
  revalidatePath("/rooms");
  return { ok: true, message: "Бронь отменена" };
}
