import "server-only";
import { db } from "@/server/db/client";
import { requireUser } from "@/server/auth/session";
import { DEMO_NOW, DEMO_DATE, addDays, dayStart, mskDate, mskTime } from "@/lib/demo-clock";
import { avatarGradientByKey, formatDue, getStudent, teacherInitials } from "./shared";
import type { EventKind, Lesson, SoonItem, TeacherView, WorkStatus } from "./types";

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
  in_progress: "в работе",
  submitted: "отправлено",
  reviewing: "на проверке",
};
// Сначала то, что требует действия студента, затем ожидание ответа
const PRIORITY: Record<string, number> = { submitted: 1, reviewing: 2 };

/** «Скоро»: несданные задания на ближайшие 5 суток. Сначала то, что требует действия и идёт в оценку. */
export async function getSoon(): Promise<SoonItem[]> {
  const user = await requireUser();
  const horizon = new Date(DEMO_NOW.getTime() + 5 * 86_400_000);
  const works = await db.assignmentWork.findMany({
    where: {
      userId: user.id,
      status: { not: "graded" },
      assignment: { dueAt: { gte: DEMO_NOW, lt: horizon }, course: { enrollments: { some: { userId: user.id } } } },
    },
    include: {
      assignment: {
        include: { course: { select: { title: true, color: true } }, component: { select: { title: true, weight: true, aggregate: true } } },
      },
    },
  });
  return works
    .sort(
      (a, b) =>
        (PRIORITY[a.status] ?? 0) - (PRIORITY[b.status] ?? 0) ||
        Number(!a.assignment.component) - Number(!b.assignment.component) ||
        a.assignment.dueAt!.getTime() - b.assignment.dueAt!.getTime(),
    )
    .slice(0, 4)
    .map((w) => {
      const { assignment: a } = w;
      const due = formatDue(a.dueAt!);
      return {
        id: w.id,
        taskId: a.id,
        title: a.title,
        course: a.course.title,
        color: a.course.color,
        // справа под сроком: где работа сейчас или сколько весит
        note: STATUS_NOTE[w.status as WorkStatus] ?? (a.component ? (a.component.aggregate ? `в «${a.component.title.toLowerCase()}»` : `${a.component.weight}% оценки`) : "без оценки"),
        due: due.label,
        today: due.today,
      };
    });
}

/** Преподаватели текущих курсов студента (лекторы и семинаристы) и их ближайшие консультации. Только его записи на курсы. */
export async function getTeachers(): Promise<TeacherView[]> {
  const user = await getStudent();
  if (!user) return [];
  const enrollments = await db.enrollment.findMany({
    where: { userId: user.id, course: { format: "offline" } },
    orderBy: { order: "asc" },
    select: {
      course: {
        select: {
          title: true, color: true,
          staff: { orderBy: { order: "asc" }, select: { role: true, teacher: { select: { slug: true, short: true, avatar: true } } } },
          consultations: { where: { startsAt: { gte: DEMO_NOW } }, orderBy: { startsAt: "asc" }, take: 1, select: { id: true, startsAt: true, teacherName: true } },
        },
      },
    },
  });

  const bySlug = new Map<string, TeacherView & { at: number }>();
  for (const { course: c } of enrollments) {
    for (const { role, teacher } of c.staff) {
      let t = bySlug.get(teacher.slug);
      if (!t) {
        t = { slug: teacher.slug, name: teacher.short, initials: teacherInitials(teacher.short), gradient: avatarGradientByKey(teacher.avatar), courses: [], cons: null, at: Infinity };
        bySlug.set(teacher.slug, t);
      }
      t.courses.push({ title: c.title, color: c.color, role });
      const next = c.consultations[0];
      if (next && next.teacherName === teacher.short && next.startsAt.getTime() < t.at) {
        t.at = next.startsAt.getTime();
        t.cons = { id: next.id, when: formatDue(next.startsAt).label };
      }
    }
  }
  return [...bySlug.values()].map(({ at: _at, ...t }) => (void _at, t));
}
