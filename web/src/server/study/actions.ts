"use server";

import { revalidatePath } from "next/cache";
import { DEMO_NOW } from "@/lib/demo-clock";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db/client";

export type WorkResult = { ok: true; message: string } | { ok: false; error: string };

/** Что можно сдать: документы, таблицы, архивы и сканы. */
const EXT = /\.(pdf|docx?|xlsx?|pptx?|zip|txt|jpe?g|png|r|py|ipynb)$/i;
const MAX = 20 * 1024 * 1024;

/** Задание, если текущий студент записан на его курс; работа — только своя (пользователь из сессии, id задания проверяется). */
async function ownAssignment(assignmentId: unknown) {
  const user = await requireUser();
  if (user.role !== "student" || typeof assignmentId !== "string" || assignmentId.length > 40) return null;
  const a = await db.assignment.findFirst({
    where: { id: assignmentId, course: { enrollments: { some: { userId: user.id } } } },
    include: { works: { where: { userId: user.id } }, component: { select: { id: true, aggregate: true } } },
  });
  return a ? { user, a, work: a.works[0] } : null;
}

const ATTACHABLE = ["upcoming", "in_progress", "draft", "returned"];

/** Самостоятельный элемент формулы (эссе, проект) повторяет статус своего задания. */
async function mirror(a: { component: { id: string; aggregate: boolean } | null }, userId: string, status: string, submittedAt: Date | null) {
  if (a.component && !a.component.aggregate) {
    await db.studentWork.updateMany({ where: { componentId: a.component.id, userId }, data: { status, submittedAt } });
  }
}

/**
 * Прикрепить файл — работа становится черновиком (ещё не отправлена). Прототип: сам файл на сервер не уходит,
 * сохраняются только имя и размер. Проверяем: своё задание, сдаётся файлом, ещё не отправлено, имя и размер в пределах.
 */
export async function attachFile(assignmentId: unknown, file: unknown): Promise<WorkResult> {
  const own = await ownAssignment(assignmentId);
  if (!own) return { ok: false, error: "Задание не найдено" };
  const { user, a, work } = own;
  if (!a.upload) return { ok: false, error: "Это задание не сдаётся файлом" };
  if (work && !ATTACHABLE.includes(work.status)) return { ok: false, error: "Работа уже отправлена" };
  const f = file as { name?: unknown; size?: unknown } | null;
  const name = typeof f?.name === "string" ? f.name.replace(/[\u0000-\u001f\\/]/g, "").trim().slice(0, 120) : "";
  const size = typeof f?.size === "number" && Number.isInteger(f.size) ? f.size : -1;
  if (!name || !EXT.test(name)) return { ok: false, error: "Нужен PDF, документ, таблица, архив или фото" };
  if (size <= 0 || size > MAX) return { ok: false, error: "Файл больше 20 МБ" };

  const data = { status: "draft", fileName: name, fileSize: size };
  await db.assignmentWork.upsert({
    where: { assignmentId_userId: { assignmentId: a.id, userId: user.id } },
    create: { assignmentId: a.id, userId: user.id, ...data },
    update: data,
  });
  await mirror(a, user.id, "draft", null);
  revalidatePath("/study", "layout");
  return { ok: true, message: "Файл прикреплён — осталось отправить" };
}

/** Убрать прикреплённый файл из черновика. */
export async function removeFile(assignmentId: unknown): Promise<WorkResult> {
  const own = await ownAssignment(assignmentId);
  if (!own) return { ok: false, error: "Задание не найдено" };
  const { user, a, work } = own;
  if (work?.status !== "draft") return { ok: false, error: "Файл уже отправлен" };
  await db.assignmentWork.update({ where: { id: work.id }, data: { status: "upcoming", fileName: null, fileSize: null } });
  await mirror(a, user.id, "upcoming", null);
  revalidatePath("/study", "layout");
  return { ok: true, message: "Файл убран" };
}

/** Отправить черновик на проверку. */
export async function submitWork(assignmentId: unknown): Promise<WorkResult> {
  const own = await ownAssignment(assignmentId);
  if (!own) return { ok: false, error: "Задание не найдено" };
  const { user, a, work } = own;
  if (!a.upload) return { ok: false, error: "Это задание не сдаётся файлом" };
  if (work?.status !== "draft" || !work.fileName) return { ok: false, error: "Сначала прикрепи файл" };
  await db.assignmentWork.update({ where: { id: work.id }, data: { status: "submitted", submittedAt: DEMO_NOW } });
  await mirror(a, user.id, "submitted", DEMO_NOW);
  revalidatePath("/study", "layout");
  return { ok: true, message: "Работа отправлена" };
}

/** Отозвать отправленную работу, пока её не начали проверять: снова черновик, файл остаётся. */
export async function withdrawWork(assignmentId: unknown): Promise<WorkResult> {
  const own = await ownAssignment(assignmentId);
  if (!own) return { ok: false, error: "Задание не найдено" };
  const { user, a, work } = own;
  if (work?.status !== "submitted") return { ok: false, error: "Работу уже проверяют" };
  await db.assignmentWork.update({ where: { id: work.id }, data: { status: "draft", submittedAt: null } });
  await mirror(a, user.id, "draft", null);
  revalidatePath("/study", "layout");
  return { ok: true, message: "Отправка отозвана — работа снова черновик" };
}
