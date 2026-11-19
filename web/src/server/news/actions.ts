"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { DEMO_NOW } from "@/lib/demo-clock";
import { MOBILITY, partnerById } from "@/lib/announcements";
import { ACTIVE_STATUSES } from "@/lib/office-catalog";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { MAX_UPLOAD, storeUpload } from "@/server/office/uploads";

export type ApplyResult = { ok: true; message: string; number: string } | { ok: false; error: string };

class Refusal extends Error {}

/**
 * Заявка на конкурс мобильности: до трёх университетов по приоритету, язык, письмо и резюме (PDF), сертификат — по желанию.
 * Пользователь только из сессии, только студент, только пока идёт приём, одна активная заявка. Становится заявкой «Офиса».
 */
export async function applyMobility(form: FormData): Promise<ApplyResult> {
  try {
    const user = await requireUser();
    if (user.role !== "student") throw new Refusal("Заявки доступны студентам");
    if (!(form instanceof FormData)) throw new Refusal("Некорректная форма");
    if (DEMO_NOW >= new Date(MOBILITY.deadline)) throw new Refusal("Приём заявок закончился");

    const raw = form.getAll("priority");
    if (!raw.length || raw.length > 3) throw new Refusal("Выберите от одного до трёх университетов");
    const partners = raw.map((id) => partnerById(id));
    if (partners.some((p) => !p) || new Set(raw).size !== raw.length) throw new Refusal("Некорректный выбор университетов");
    const lang = form.get("lang");
    if (typeof lang !== "string" || !(MOBILITY.langs as readonly string[]).includes(lang)) throw new Refusal("Укажите, чем подтвердите язык");

    const files: { label: string; file: File; pdfOnly: boolean }[] = [];
    for (const d of MOBILITY.documents) {
      const f = form.get(d.id);
      const present = f instanceof File && f.size > 0;
      if (!present) {
        if (d.required) throw new Refusal(`Загрузите: ${d.title.toLowerCase()}`);
        continue;
      }
      if (f.size > MAX_UPLOAD) throw new Refusal(`${d.title}: файл больше 8 МБ`);
      files.push({ label: d.title, file: f, pdfOnly: d.id !== "cert" });
    }

    const existing = await db.officeRequest.findFirst({ where: { userId: user.id, typeId: MOBILITY.typeId, status: { in: [...ACTIVE_STATUSES] } }, select: { id: true } });
    if (existing) throw new Refusal("Заявка уже подана");

    const stored: (NonNullable<Awaited<ReturnType<typeof storeUpload>>> & { label: string })[] = [];
    for (const f of files) {
      const s = await storeUpload(f.file, f.pdfOnly);
      if (!s) throw new Refusal(f.pdfOnly ? `${f.label}: нужен PDF` : `${f.label}: нужен PDF, JPG или PNG`);
      stored.push({ ...s, label: f.label });
    }

    const params = {
      subject: partners[0]!.name,
      comment: partners.map((p, i) => `${i + 1}. ${p!.name}, ${p!.city}`).join("\n") + `\nЯзык: ${lang}`,
      priorities: partners.map((p) => p!.id),
      lang,
    };
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const number = await db.$transaction(async (tx) => {
          const last = await tx.officeRequest.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
          const number = `R-${Number(last?.number.slice(2) ?? 2480) + 1}`;
          await tx.officeRequest.create({
            data: {
              number,
              userId: user.id,
              typeId: MOBILITY.typeId,
              params: JSON.stringify(params),
              status: "sent",
              stage: 1,
              eta: new Date("2026-12-25T12:00:00+03:00"),
              createdAt: DEMO_NOW,
              events: {
                create: [
                  { order: 0, title: "Заявка подана", actorName: "Вы", at: DEMO_NOW },
                  { order: 1, title: "Проверка документов", actorName: "Международный офис", note: "8–11 декабря" },
                  { order: 2, title: "Собеседование", actorName: "", note: "14–16 декабря, приглашение придёт в Орбиту" },
                  { order: 3, title: "Решение комиссии", actorName: "", note: "25 декабря" },
                ],
              },
              files: { create: stored.map((s) => ({ name: s.name, label: s.label, size: s.size, mime: s.mime, storedAs: s.storedAs, createdAt: DEMO_NOW })) },
            },
          });
          return number;
        });
        revalidatePath("/office");
        revalidatePath(`/news/${MOBILITY.slug}`);
        return { ok: true, message: "Заявка на конкурс подана", number };
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
        throw e;
      }
    }
    throw new Refusal("Не удалось отправить, повторите");
  } catch (e) {
    if (e instanceof Refusal) return { ok: false, error: e.message };
    throw e;
  }
}
