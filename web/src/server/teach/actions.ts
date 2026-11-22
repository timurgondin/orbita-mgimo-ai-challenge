"use server";

import { revalidatePath } from "next/cache";
import { BELLS } from "@/lib/bells";
import { DEMO_NOW, addDays } from "@/lib/demo-clock";
import { db } from "@/server/db/client";
import { findCandidates, getTeacher, myCourse } from "@/server/data/teach";
import type { Candidate } from "@/server/data/teach-types";

export type TeachResult = { ok: true; message: string } | { ok: false; error: string };
const fail = (error: string): TeachResult => ({ ok: false, error });
const str = (v: unknown, max: number) => (typeof v === "string" && v.length <= max ? v : null);
/** Оценка по 10-балльной шкале с шагом 0,5. */
const toScore = (v: unknown) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(",", ".")) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= 10 && Math.round(n * 2) === n * 2 ? n : null;
};
const fmt = (n: number) => String(n).replace(".", ",");

/**
 * Проверить работу: оценка и комментарий или возврат на доработку. Работа — только по курсу,
 * который ведёт преподаватель из сессии. Студенту — уведомление, у него сразу меняется статус и балл.
 */
export async function reviewWork(workId: unknown, mode: unknown, rawScore: unknown, rawFeedback: unknown): Promise<TeachResult> {
  const ctx = await getTeacher();
  const id = str(workId, 40);
  const feedback = (str(rawFeedback, 2000) ?? "").trim() || null;
  if (!ctx || !id || (mode !== "grade" && mode !== "return")) return fail("Работа не найдена");
  const work = await db.assignmentWork.findFirst({
    where: { id, status: { in: ["submitted", "reviewing", "graded", "returned"] }, assignment: { course: { OR: [{ teacherId: ctx.user.id }, { staff: { some: { teacherId: ctx.teacher.id } } }] } } },
    include: { assignment: { include: { course: true, component: true } } },
  });
  if (!work) return fail("Работа не найдена");
  const score = mode === "grade" ? toScore(rawScore) : null;
  if (mode === "grade" && score == null) return fail("Оценка от 0 до 10");
  if (mode === "return" && !feedback) return fail("Напишите, что исправить");

  const status = mode === "grade" ? "graded" : "returned";
  await db.assignmentWork.update({ where: { id }, data: { status, score, feedback, gradedAt: DEMO_NOW } });
  const comp = work.assignment.component;
  if (comp && !comp.aggregate) {
    await db.studentWork.updateMany({ where: { componentId: comp.id, userId: work.userId }, data: { status, score, feedback, feedbackAuthor: ctx.teacher.short, gradedAt: DEMO_NOW } });
  }
  await db.notification.create({
    data: {
      userId: work.userId,
      kind: "grade",
      category: "study",
      level: mode === "grade" ? "important" : "action",
      title: mode === "grade" ? `${fmt(score!)} из 10 за ${work.assignment.title}` : `${work.assignment.title}: вернули на доработку`,
      body: feedback ? `«${feedback.length > 90 ? `${feedback.slice(0, 90)}…` : feedback}»` : work.assignment.course.title,
      link: `/study/${work.assignment.course.slug}?task=${work.assignmentId}`,
      actorName: ctx.teacher.short,
      actorAvatar: ctx.teacher.avatar,
      createdAt: DEMO_NOW,
    },
  });
  revalidatePath("/", "layout");
  return { ok: true, message: mode === "grade" ? "Оценка выставлена" : "Работа возвращена" };
}

/** Оценка в журнал за элемент формулы (контрольная, работа на семинарах, экзамен). Агрегаты считаются сами. */
export async function setScore(courseSlug: unknown, componentId: unknown, studentId: unknown, raw: unknown): Promise<TeachResult> {
  const ctx = await getTeacher();
  if (!ctx) return fail("Нет доступа");
  const course = await myCourse(ctx, courseSlug);
  const cid = str(componentId, 40);
  const uid = str(studentId, 40);
  if (!course || !cid || !uid) return fail("Нет доступа");
  const [comp, enrolled] = await Promise.all([
    db.gradeComponent.findFirst({ where: { id: cid, courseId: course.id, aggregate: false } }),
    db.enrollment.findFirst({ where: { courseId: course.id, userId: uid } }),
  ]);
  if (!comp || !enrolled) return fail("Нет доступа");
  const empty = raw === "" || raw == null;
  const score = empty ? null : toScore(raw);
  if (!empty && score == null) return fail("Оценка от 0 до 10");
  const data = empty ? { status: "upcoming", score: null, gradedAt: null } : { status: "graded", score, gradedAt: DEMO_NOW };
  const updated = await db.studentWork.updateMany({ where: { componentId: cid, userId: uid }, data });
  if (!updated.count) await db.studentWork.create({ data: { componentId: cid, userId: uid, ...data } });
  revalidatePath("/", "layout");
  return { ok: true, message: "Сохранено" };
}

export async function searchAssistants(courseSlug: unknown, q: unknown): Promise<Candidate[]> {
  const ctx = await getTeacher();
  if (!ctx) return [];
  const course = await myCourse(ctx, courseSlug);
  return course ? findCandidates(ctx, course.id, q) : [];
}

/** Назначить ассистента: только на свой курс и только старшекурсника или магистранта, не студента этого курса. */
export async function assignAssistant(courseSlug: unknown, userId: unknown, canReview: unknown, canGrade: unknown): Promise<TeachResult> {
  const ctx = await getTeacher();
  if (!ctx) return fail("Нет доступа");
  const course = await myCourse(ctx, courseSlug);
  const uid = str(userId, 40);
  if (!course || !uid || typeof canReview !== "boolean" || typeof canGrade !== "boolean") return fail("Нет доступа");
  const ok = await db.user.findFirst({ where: { id: uid, role: "student", OR: [{ course: { gte: 3 } }, { degree: "Магистратура" }], enrollments: { none: { courseId: course.id } } } });
  if (!ok) return fail("Ассистентом может быть старшекурсник или магистрант");
  await db.courseAssistant.upsert({
    where: { courseId_userId: { courseId: course.id, userId: uid } },
    create: { courseId: course.id, userId: uid, canReview, canGrade, createdAt: DEMO_NOW },
    update: { canReview, canGrade },
  });
  await db.notification.create({
    data: {
      userId: uid, kind: "announcement", category: "study", level: "important",
      title: `Вы ассистент курса «${course.title}»`, body: `Назначила **${ctx.teacher.short}**`, actorName: ctx.teacher.short, actorAvatar: ctx.teacher.avatar, createdAt: DEMO_NOW,
    },
  });
  revalidatePath(`/study/${course.slug}`);
  return { ok: true, message: "Ассистент назначен" };
}

export async function updateAssistant(id: unknown, canReview: unknown, canGrade: unknown): Promise<TeachResult> {
  const ctx = await getTeacher();
  const aid = str(id, 40);
  if (!ctx || !aid || typeof canReview !== "boolean" || typeof canGrade !== "boolean") return fail("Нет доступа");
  const a = await db.courseAssistant.findFirst({ where: { id: aid, course: { OR: [{ teacherId: ctx.user.id }, { staff: { some: { teacherId: ctx.teacher.id } } }] } }, include: { course: true } });
  if (!a) return fail("Нет доступа");
  await db.courseAssistant.update({ where: { id: aid }, data: { canReview, canGrade } });
  revalidatePath(`/study/${a.course.slug}`);
  return { ok: true, message: "Права обновлены" };
}

export async function removeAssistant(id: unknown): Promise<TeachResult> {
  const ctx = await getTeacher();
  const aid = str(id, 40);
  if (!ctx || !aid) return fail("Нет доступа");
  const a = await db.courseAssistant.findFirst({ where: { id: aid, course: { OR: [{ teacherId: ctx.user.id }, { staff: { some: { teacherId: ctx.teacher.id } } }] } }, include: { course: true } });
  if (!a) return fail("Нет доступа");
  await db.courseAssistant.delete({ where: { id: aid } });
  revalidatePath(`/study/${a.course.slug}`);
  return { ok: true, message: "Ассистент снят с курса" };
}

/** Новый слот консультации на своей неделе: курс свой, пара из сетки звонков, места 1–40. Студенты курса сразу видят его во «Времени». */
export async function addConsultation(courseId: unknown, date: unknown, pair: unknown, place: unknown, capacity: unknown): Promise<TeachResult> {
  const ctx = await getTeacher();
  if (!ctx) return fail("Нет доступа");
  const cid = str(courseId, 40);
  const d = str(date, 10);
  const p = typeof pair === "number" && Number.isInteger(pair) ? pair : NaN;
  const cap = typeof capacity === "number" && Number.isInteger(capacity) ? capacity : NaN;
  const where = (str(place, 60) ?? "").trim();
  if (!cid || !d || !/^\d{4}-\d{2}-\d{2}$/.test(d) || !BELLS[p] || !(cap >= 1 && cap <= 40) || !where) return fail("Проверьте поля");
  const course = await db.course.findFirst({ where: { id: cid, OR: [{ teacherId: ctx.user.id }, { staff: { some: { teacherId: ctx.teacher.id } } }] } });
  if (!course) return fail("Нет доступа");
  const start = new Date(`${d}T${BELLS[p][0]}:00+03:00`);
  if (start < DEMO_NOW || start > new Date(`${addDays(d, 0)}T23:59:00+03:00`) || start.getTime() - DEMO_NOW.getTime() > 60 * 86400_000) return fail("Выберите день впереди");
  const busy = await db.scheduleEvent.findFirst({ where: { teacherName: ctx.teacher.short, startsAt: start } });
  if (busy) return fail("В это время у вас пара");
  const online = /онлайн/i.test(where);
  await db.consultation.create({
    data: { courseId: course.id, teacherName: ctx.teacher.short, teacherId: ctx.user.id, startsAt: start, endsAt: new Date(`${d}T${BELLS[p][1]}:00+03:00`), pair: p, place: where, online, capacity: cap },
  });
  revalidatePath("/time");
  return { ok: true, message: "Консультация добавлена" };
}
