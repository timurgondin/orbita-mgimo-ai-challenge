import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/server/db/client";
import { DEMO_DATE, DEMO_NOW, addDays, mskDate, mskTime } from "@/lib/demo-clock";
import { avatarGradientByKey, currentScore, fmt1, getStudent, teacherInitials } from "./shared";
import type { EventKind, TimeData } from "./types";

/** Сколько недель показываем в обе стороны от текущей. */
export const WEEKS_BACK = 3;
export const WEEKS_AHEAD = 3;

const KIND_LABEL: Record<EventKind, string> = {
  lecture: "Лекция",
  seminar: "Семинар",
  practice: "Практика",
  consultation: "Консультация",
  test: "Контрольная",
};

function mondayOf(isoDate: string): string {
  const dow = new Date(`${isoDate}T12:00:00+03:00`).getUTCDay(); // 0 = вс
  return addDays(isoDate, -((dow + 6) % 7));
}

/** Расписание и консультации текущего студента: только его курсы. meetingUrl не читается вообще. */
export async function getTimeData(): Promise<TimeData | null> {
  const user = await getStudent();
  if (!user) return null;

  const baseMonday = mondayOf(DEMO_DATE);
  const from = new Date(`${addDays(baseMonday, -7 * WEEKS_BACK)}T00:00:00+03:00`);
  const to = new Date(`${addDays(baseMonday, 7 * (WEEKS_AHEAD + 1))}T00:00:00+03:00`);

  const enrolled = (await db.enrollment.findMany({ where: { userId: user.id }, select: { courseId: true } })).map((e) => e.courseId);

  const teachers = new Map((await db.teacher.findMany({ select: { short: true, slug: true, avatar: true } })).map((t) => [t.short, t]));
  const [events, consultations] = await Promise.all([
    db.scheduleEvent.findMany({
      where: { courseId: { in: enrolled }, startsAt: { gte: from, lt: to }, pair: { not: null } },
      include: {
        course: { select: { title: true, color: true, teacherAvatar: true } },
        component: {
          select: {
            weight: true,
            course: { select: { components: { select: { weight: true, works: { where: { userId: user.id }, select: { status: true, score: true } } } } } },
          },
        },
      },
      orderBy: { startsAt: "asc" },
    }),
    db.consultation.findMany({
      where: { courseId: { in: enrolled }, startsAt: { gte: from, lt: to }, pair: { not: null } },
      select: {
        id: true, courseId: true, teacherName: true, startsAt: true, endsAt: true, pair: true, place: true, online: true, capacity: true,
        course: { select: { title: true, color: true, teacherAvatar: true } },
        signups: { select: { userId: true, question: true } },
      },
      orderBy: { startsAt: "asc" },
    }),
  ]);

  return {
    baseMonday,
    syncLink: `webcal://orbita.future.edu/cal/${createHash("sha256").update(`orbita-cal:${user.id}`).digest("hex").slice(0, 20)}.ics`,
    lessons: events.map((e) => {
      const kind = e.kind as EventKind;
      const isTest = kind === "test";
      const test =
        isTest && e.component
          ? {
              weight: e.component.weight,
              score: (() => {
                const s = currentScore(e.component.course.components.map((c) => ({ weight: c.weight, work: c.works[0] })));
                return s != null ? fmt1(s) : null;
              })(),
            }
          : undefined;
      return {
        id: e.id,
        date: mskDate(e.startsAt),
        pair: e.pair!,
        start: mskTime(e.startsAt),
        end: mskTime(e.endsAt),
        color: e.course!.color,
        courseTitle: e.course!.title,
        title: isTest && e.title ? e.title : e.course!.title,
        isTest,
        kind,
        kindLabel: KIND_LABEL[kind],
        topic: e.topic ?? undefined,
        room: e.room,
        roomFrom: e.roomChangedFrom ?? undefined,
        teacher: e.teacherName,
        teacherInitials: teacherInitials(e.teacherName),
        teacherGradient: avatarGradientByKey(teachers.get(e.teacherName)?.avatar ?? e.course!.teacherAvatar),
        teacherSlug: teachers.get(e.teacherName)?.slug ?? null,
        test,
      };
    }),
    consultations: consultations.map((c) => {
      const mine = c.signups.find((s) => s.userId === user.id);
      return {
        id: c.id,
        date: mskDate(c.startsAt),
        pair: c.pair!,
        start: mskTime(c.startsAt),
        end: mskTime(c.endsAt),
        color: c.course.color,
        courseId: c.courseId,
        courseTitle: c.course.title,
        teacher: c.teacherName,
        teacherInitials: teacherInitials(c.teacherName),
        teacherGradient: avatarGradientByKey(c.course.teacherAvatar),
        place: c.place,
        online: c.online,
        count: c.signups.length,
        capacity: c.capacity,
        questions: c.signups.filter((s) => s.question).length,
        going: !!mine,
        myQuestion: mine?.question ?? "",
        past: c.endsAt <= DEMO_NOW,
      };
    }),
  };
}
