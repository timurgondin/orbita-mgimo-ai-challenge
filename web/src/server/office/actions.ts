"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { DEMO_NOW } from "@/lib/demo-clock";
import { ACTIVE_STATUSES, MAX_MESSAGE, getType, validateParams } from "@/lib/office-catalog";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db/client";

export type OfficeResult = { ok: true; message: string; number?: string } | { ok: false; error: string };

const fail = (error: string): OfficeResult => ({ ok: false, error });
class Refusal extends Error {}
const NOT_FOUND = "Заявка не найдена";

const HOUR_MS = 60 * 60 * 1000;
const MAX_PER_HOUR = 10;
const MAX_STUDENT_MESSAGES = 30;

async function student() {
  const user = await requireUser(); // пользователь только из сессии
  if (user.role !== "student") throw new Refusal("Заявки доступны студентам");
  return user;
}

async function run(work: () => Promise<OfficeResult>): Promise<OfficeResult> {
  try {
    const r = await work();
    if (r.ok) revalidatePath("/office");
    return r;
  } catch (e) {
    if (e instanceof Refusal) return fail(e.message);
    throw e;
  }
}

const idOk = (id: unknown): id is string => typeof id === "string" && /^[a-z0-9]{1,40}$/i.test(id);

export async function createRequest(typeId: string, params: unknown): Promise<OfficeResult> {
  return run(async () => {
    const user = await student();
    const type = getType(typeId);
    if (!type) throw new Refusal("Такой заявки нет");
    const v = validateParams(type, params);
    if (!v.ok) throw new Refusal(v.error);

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await db.$transaction(async (tx) => {
          // Лимит: не больше 10 новых заявок в час. Верхняя граница — «сейчас», чтобы демо-даты из будущего не считались.
          const now = new Date();
          const recent = await tx.officeRequest.count({ where: { userId: user.id, createdAt: { gt: new Date(now.getTime() - HOUR_MS), lte: now } } });
          if (recent >= MAX_PER_HOUR) throw new Refusal("Слишком много заявок за час. Попробуйте позже");
          const last = await tx.officeRequest.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
          const number = `R-${Number(last?.number.slice(2) ?? 2480) + 1}`;
          const eta = new Date(DEMO_NOW.getTime() + type.days * 86_400_000);
          const titles = type.kind === "cert" ? ["Заявка подана", "Принята в работу", "Готовится", "Готова"] : ["Заявление подано", "Проверка", "Решение"];
          await tx.officeRequest.create({
            data: {
              number,
              userId: user.id,
              typeId: type.id,
              params: JSON.stringify(v.params),
              status: "sent",
              stage: 1,
              eta,
              events: {
                create: titles.map((title, order) => ({
                  order,
                  title,
                  actorName: order === 0 ? "Вы" : "",
                  note: order === titles.length - 1 && type.kind === "cert" ? ("copies" in v.params && v.params.format === "Бумажная" ? "Бумажная справка" : "PDF с QR-кодом") : null,
                  at: order === 0 ? DEMO_NOW : null,
                })),
              },
            },
          });
          return { ok: true as const, message: "Заявка отправлена", number };
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue; // гонка за номер
        throw e;
      }
    }
    throw new Refusal("Не удалось отправить, повторите");
  });
}

export async function withdrawRequest(id: string): Promise<OfficeResult> {
  return run(async () => {
    const user = await student();
    if (!idOk(id)) throw new Refusal(NOT_FOUND);
    const res = await db.officeRequest.updateMany({ where: { id, userId: user.id, status: { in: [...ACTIVE_STATUSES] } }, data: { status: "withdrawn" } });
    if (res.count === 0) {
      const own = await db.officeRequest.findFirst({ where: { id, userId: user.id }, select: { id: true } });
      throw new Refusal(own ? "Отозвать уже нельзя" : NOT_FOUND);
    }
    return { ok: true, message: "Заявка отозвана" };
  });
}

export async function replyToRequest(id: string, body: string): Promise<OfficeResult> {
  return run(async () => {
    const user = await student();
    if (!idOk(id)) throw new Refusal(NOT_FOUND);
    if (typeof body !== "string") throw new Refusal("Пустое сообщение");
    const text = body.trim();
    if (!text) throw new Refusal("Пустое сообщение");
    if (text.length > MAX_MESSAGE) throw new Refusal(`Не длиннее ${MAX_MESSAGE} символов`);
    const req = await db.officeRequest.findFirst({ where: { id, userId: user.id }, select: { id: true, status: true } });
    if (!req) throw new Refusal(NOT_FOUND);
    if (!(ACTIVE_STATUSES as readonly string[]).includes(req.status)) throw new Refusal("Заявка закрыта");
    const mine = await db.requestMessage.count({ where: { requestId: req.id, authorRole: "student" } });
    if (mine >= MAX_STUDENT_MESSAGES) throw new Refusal("Слишком много сообщений");
    // Время сообщений — по демо-часам (минута на сообщение), чтобы порядок в ленте не зависел от реальных часов
    const total = await db.requestMessage.count({ where: { requestId: req.id } });
    const createdAt = new Date(DEMO_NOW.getTime() + (total + 1) * 60_000);
    await db.requestMessage.create({ data: { requestId: req.id, authorName: `${user.lastName} ${user.firstName[0]}.`, authorRole: "student", body: text, createdAt } });
    return { ok: true, message: "Сообщение отправлено" };
  });
}
