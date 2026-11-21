"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db/client";

export type OnboardingResult = { ok: true; photo?: string } | { ok: false; error: string };

const MAX_PHOTO = 1.5 * 1024 * 1024;
const isJpeg = (b: Buffer) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
const isPng = (b: Buffer) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

async function student() {
  const user = await requireUser();
  return user.role === "student" ? user : null;
}

/** «Всё верно»: студент подтвердил свои данные от университета (только у себя). */
export async function confirmPersonalData(): Promise<OnboardingResult> {
  const user = await student();
  if (!user) return { ok: false, error: "Только для студентов" };
  await db.user.update({ where: { id: user.id }, data: { dataConfirmedAt: new Date() } });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Фото для аватара и Орбита ID. Браузер присылает уменьшенный JPEG; тип проверяем по сигнатуре. */
export async function savePhoto(form: unknown): Promise<OnboardingResult> {
  const user = await student();
  if (!user) return { ok: false, error: "Только для студентов" };
  const file = form instanceof FormData ? form.get("photo") : null;
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Выберите фото" };
  if (file.size > MAX_PHOTO) return { ok: false, error: "Фото слишком большое" };
  const data = Buffer.from(await file.arrayBuffer());
  const mime = isJpeg(data) ? "image/jpeg" : isPng(data) ? "image/png" : null;
  if (!mime) return { ok: false, error: "Нужна фотография JPG или PNG" };
  const photoAt = new Date();
  await db.$transaction([
    db.userPhoto.upsert({ where: { userId: user.id }, create: { userId: user.id, data, mime }, update: { data, mime } }),
    db.user.update({ where: { id: user.id }, data: { photoAt } }),
  ]);
  revalidatePath("/", "layout");
  return { ok: true, photo: `/me/photo?v=${photoAt.getTime()}` };
}

/** Убрать фото — вернётся монограмма. */
export async function removePhoto(): Promise<OnboardingResult> {
  const user = await student();
  if (!user) return { ok: false, error: "Только для студентов" };
  await db.$transaction([
    db.userPhoto.deleteMany({ where: { userId: user.id } }),
    db.user.update({ where: { id: user.id }, data: { photoAt: null } }),
  ]);
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Онбординг пройден. Вызывается, когда открыт последний экран: пока студент читает «Твоя Орбита готова»,
 * клиент успевает заранее загрузить «Сегодня», и переход по кнопке — без пустого экрана. Без revalidate:
 * иначе сбросился бы только что загруженный кеш.
 */
export async function finishOnboarding(): Promise<OnboardingResult> {
  const user = await student();
  if (!user) return { ok: false, error: "Только для студентов" };
  if (!user.onboardingDone) await db.user.update({ where: { id: user.id }, data: { onboardingDone: true } });
  return { ok: true };
}
