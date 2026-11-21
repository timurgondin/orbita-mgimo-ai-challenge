import "server-only";
import { db } from "@/server/db/client";
import { requireUser } from "@/server/auth/session";
import { DEMO_NOW, DEMO_DATE, addDays, dayStart, mskDate, mskTime } from "@/lib/demo-clock";
import { formatDue, getStudent } from "./shared";
import type { EventKind, Lesson, SoonItem, WorkStatus } from "./types";

const FORMAT: Partial<Record<EventKind, string>> = { lecture: "Лекция", seminar: "Семинар", practice: "Практика", test: "Контрольная" };

/** «Каб. 518» → { «каб.», «518» }; «Онлайн» → { «», «Онлайн» } */
function parsePlace(place: string): Lesson["place"] {
  const m = place.match(/^(Каб|Ауд)\.\s*(.+)$/);
  return m ? { label: m[1] === "Каб" ? "каб." : "ауд.", number: m[2] } : { label: "", number: place };
}

/** События дня студента: события его курсов + консультации, на которые он записан. */
async function eventsBetween(userId: string, from: Date, to: Date): Promise<Lesson[]> {
  const enrolled = await db.enrollment.findMany({ where: { userId }, select: { courseId: true } });
  const range = { gte: from, lt: to };
  const [events, consultations] = await Promise.all([
    db.scheduleEvent.findMany({
      where: { startsAt: range, courseId: { in: enrolled.map((e) => e.courseId) } },
      include: { course: { select: { title: true } } },
    }),
    db.consultation.findMany({
      where: { startsAt: range, signups: { some: { userId } } },
      include: { course: { select: { title: true } } },
    }),
  ]);
  const lessons: (Lesson & { at: number })[] = [
    ...events.map((e) => ({
      id: e.id,
      at: e.startsAt.getTime(),
      date: mskDate(e.startsAt),
      start: mskTime(e.startsAt),
      end: mskTime(e.endsAt),
      title: e.title ?? e.course?.title ?? "",
      format: FORMAT[e.kind as EventKind],
      place: { label: "ауд." as const, number: e.room },
      teacher: e.teacherName,
      note: e.roomChangedFrom ? { kind: "flag" as const, text: "Новая аудитория" } : undefined,
    })),
    ...consultations.map((c) => ({
      id: c.id,
      at: c.startsAt.getTime(),
      date: mskDate(c.startsAt),
      start: mskTime(c.startsAt),
      end: mskTime(c.endsAt),
      title: c.course.title,
      format: "Консультация",
      place: parsePlace(c.place),
      teacher: c.teacherName,
      note: { kind: "ok" as const, text: "Вы записаны" },
    })),
  ];
  return lessons.sort((a, b) => a.at - b.at);
}

export async function getScheduleForToday(): Promise<{ today: Lesson[]; tomorrow: Lesson | undefined } | null> {
  const user = await getStudent();
  if (!user) return null;
  const tomorrowDate = addDays(DEMO_DATE, 1);
  const lessons = await eventsBetween(user.id, dayStart(DEMO_DATE), dayStart(addDays(DEMO_DATE, 2)));
  return {
    today: lessons.filter((l) => l.date === DEMO_DATE),
    tomorrow: lessons.find((l) => l.date === tomorrowDate),
  };
}

const STATUS_NOTE: Partial<Record<WorkStatus, string>> = {
  draft: "черновик",
  submitted: "отправлено",
  reviewing: "на проверке",
};
// Сначала то, что требует действия студента, затем ожидание ответа
const PRIORITY: Record<string, number> = { submitted: 1, reviewing: 2 };

/** «Скоро»: несданные задания и контрольные на ближайшие 5 суток. Сначала то, что требует действия. */
export async function getSoon(): Promise<SoonItem[]> {
  const user = await requireUser();
  const horizon = new Date(DEMO_NOW.getTime() + 5 * 86_400_000);
  const mine = { enrollments: { some: { userId: user.id } } };
  const [works, tests] = await Promise.all([
    db.assignmentWork.findMany({
      where: {
        userId: user.id,
        status: { not: "graded" },
        assignment: { kind: { not: "prep" }, dueAt: { gte: DEMO_NOW, lt: horizon }, course: mine },
      },
      include: {
        assignment: {
          include: { course: { select: { title: true, color: true } }, component: { select: { title: true, weight: true, aggregate: true } } },
        },
      },
    }),
    // контрольные — не задания, но их тоже важно видеть заранее; ведут в расписание
    db.gradeComponent.findMany({
      where: { kind: "test", dueAt: { gte: DEMO_NOW, lt: horizon }, course: mine, works: { none: { userId: user.id, status: "graded" } } },
      include: { course: { select: { title: true, color: true } }, events: { select: { id: true }, take: 1 } },
    }),
  ]);
  const items = [
    ...works.map((w) => {
      const { assignment: a } = w;
      return {
        rank: PRIORITY[w.status] ?? 0,
        at: a.dueAt!,
        item: {
          id: w.id,
          href: `/study?tab=tasks&task=${a.id}`,
          title: a.title,
          course: a.course.title,
          color: a.course.color,
          // справа под сроком: где работа сейчас или сколько весит
          note: STATUS_NOTE[w.status as WorkStatus] ?? (a.component ? (a.component.aggregate ? `в «${a.component.title.toLowerCase()}»` : `${a.component.weight}% оценки`) : ""),
        },
      };
    }),
    ...tests.map((c) => ({
      rank: 0,
      at: c.dueAt!,
      item: {
        id: c.id,
        href: c.events[0] ? `/time?open=${c.events[0].id}` : "/time",
        title: c.title,
        course: c.course.title,
        color: c.course.color,
        note: c.room ? `ауд. ${c.room}` : `${c.weight}% оценки`,
      },
    })),
  ];
  return items
    .sort((a, b) => a.rank - b.rank || a.at.getTime() - b.at.getTime())
    .slice(0, 4)
    .map(({ at, item }) => {
      const due = formatDue(at);
      return { ...item, due: due.label, today: due.today };
    });
}

