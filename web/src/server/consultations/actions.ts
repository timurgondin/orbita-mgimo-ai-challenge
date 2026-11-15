"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { DEMO_NOW } from "@/lib/demo-clock";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db/client";

export type ConsultationResult = { ok: true; message: string } | { ok: false; error: string };

const MAX_QUESTION = 500;
const fail = (error: string): ConsultationResult => ({ ok: false, error });

class Refusal extends Error {}

function cleanQuestion(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw !== "string") throw new Refusal("Некорректный вопрос");
  const q = raw.trim();
  if (q.length > MAX_QUESTION) throw new Refusal(`Вопрос не длиннее ${MAX_QUESTION} символов`);
  return q || null;
}

/**
 * Общая проверка: пользователь берётся только из сессии, он студент, записан на курс
 * консультации, и консультация ещё не началась (по демо-часам).
 */
async function guard(tx: Prisma.TransactionClient, consultationId: unknown) {
  const user = await requireUser();
  if (user.role !== "student") throw new Refusal("Запись доступна студентам");
  if (typeof consultationId !== "string" || consultationId.length > 64) throw new Refusal("Консультация не найдена");
  const consultation = await tx.consultation.findUnique({ where: { id: consultationId } });
  if (!consultation) throw new Refusal("Консультация не найдена");
  const enrolled = await tx.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId: consultation.courseId } } });
  if (!enrolled) throw new Refusal("Консультация не найдена"); // не раскрываем существование чужих
  if (consultation.startsAt <= DEMO_NOW) throw new Refusal("Запись закрыта");
  return { user, consultation };
}

async function run(work: (tx: Prisma.TransactionClient) => Promise<string>): Promise<ConsultationResult> {
  try {
    const message = await db.$transaction(work);
    revalidatePath("/time");
    revalidatePath("/");
    return { ok: true, message };
  } catch (e) {
    if (e instanceof Refusal) return fail(e.message);
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return fail("Вы уже записаны");
    throw e;
  }
}

export async function signUp(consultationId: string, question?: string): Promise<ConsultationResult> {
  return run(async (tx) => {
    const { user, consultation } = await guard(tx, consultationId);
    const q = cleanQuestion(question);
    const taken = await tx.consultationSignup.count({ where: { consultationId: consultation.id } });
    if (taken >= consultation.capacity) throw new Refusal("Мест нет");
    await tx.consultationSignup.create({ data: { consultationId: consultation.id, userId: user.id, question: q } });
    // Вторая проверка уже после вставки: при гонке транзакция откатится, лимит не превысить
    if ((await tx.consultationSignup.count({ where: { consultationId: consultation.id } })) > consultation.capacity) throw new Refusal("Мест нет");
    return "Вы записаны";
  });
}

export async function updateQuestion(consultationId: string, question?: string): Promise<ConsultationResult> {
  return run(async (tx) => {
    const { user, consultation } = await guard(tx, consultationId);
    const q = cleanQuestion(question);
    const res = await tx.consultationSignup.updateMany({ where: { consultationId: consultation.id, userId: user.id }, data: { question: q } });
    if (res.count === 0) throw new Refusal("Вы не записаны");
    return "Вопрос сохранён";
  });
}

export async function cancel(consultationId: string): Promise<ConsultationResult> {
  return run(async (tx) => {
    const { user, consultation } = await guard(tx, consultationId);
    const res = await tx.consultationSignup.deleteMany({ where: { consultationId: consultation.id, userId: user.id } });
    if (res.count === 0) throw new Refusal("Вы не записаны");
    return "Запись отменена";
  });
}
