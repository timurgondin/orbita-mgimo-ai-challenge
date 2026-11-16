"use server";

import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
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

// ---------- Загрузка документа, который ждёт офис ----------
// 8 МБ: тело запроса проходит через proxy (лимит 10 МБ) и bodySizeLimit server actions
const MAX_UPLOAD = 8 * 1024 * 1024;
const UPLOAD_DIR = join(process.cwd(), "storage", "uploads");
// Тип — по сигнатуре содержимого, а не по имени или MIME из браузера
const SIGNATURES = [
  { mime: "application/pdf", ext: "pdf", ok: (b: Buffer) => b.subarray(0, 5).toString("latin1") === "%PDF-" },
  { mime: "image/jpeg", ext: "jpg", ok: (b: Buffer) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", ext: "png", ok: (b: Buffer) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
];

/** Студент загружает документ к своей заявке, если офис его ждёт. Связанное уведомление «нужно действие» решается. */
export async function uploadRequestFile(id: string, form: FormData): Promise<OfficeResult> {
  const r = await run(async () => {
    const user = await student();
    if (!idOk(id)) throw new Refusal(NOT_FOUND);
    if (!(form instanceof FormData)) throw new Refusal("Выберите файл");
    const req = await db.officeRequest.findFirst({ where: { id, userId: user.id } });
    if (!req) throw new Refusal(NOT_FOUND);
    if (!(ACTIVE_STATUSES as readonly string[]).includes(req.status)) throw new Refusal("Заявка закрыта");
    if (!req.needDoc || req.docReceivedAt) throw new Refusal("Офис не ждёт документов по этой заявке");
    const file = form.get("file");
    if (!(file instanceof File)) throw new Refusal("Выберите файл");
    if (file.size === 0) throw new Refusal("Файл пустой");
    if (file.size > MAX_UPLOAD) throw new Refusal("Файл больше 8 МБ");
    const buf = Buffer.from(await file.arrayBuffer());
    const sig = SIGNATURES.find((s) => s.ok(buf));
    if (!sig) throw new Refusal("Нужен PDF, JPG или PNG");
    const storedAs = `${randomBytes(16).toString("hex")}.${sig.ext}`;
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(join(UPLOAD_DIR, storedAs), buf, { mode: 0o600 });
    // имя только для показа: без управляющих символов, не длиннее 120
    const name = file.name.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(-120) || `document.${sig.ext}`;
    await db.$transaction([
      db.requestFile.create({ data: { requestId: req.id, name, size: buf.length, mime: sig.mime, storedAs, createdAt: DEMO_NOW } }),
      db.officeRequest.update({ where: { id: req.id }, data: { docReceivedAt: DEMO_NOW } }),
      db.notification.updateMany({
        where: { userId: user.id, refId: req.number, level: "action", resolvedAt: null },
        data: { resolvedAt: DEMO_NOW, readAt: DEMO_NOW },
      }),
    ]);
    return { ok: true, message: `${req.needDoc} отправлен в офис` };
  });
  if (r.ok) revalidatePath("/", "layout"); // колокольчик и «Сегодня»
  return r;
}
