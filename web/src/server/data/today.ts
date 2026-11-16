import "server-only";
import { db } from "@/server/db/client";
import { requireUser } from "@/server/auth/session";
import { DEMO_NOW, DEMO_DATE, addDays, dayStart, daysBetween, formatDayMonth, formatShortWeekday, mskDate, mskTime } from "@/lib/demo-clock";
import { avatarGradientByKey, formatDue, getStudent, teacherInitials } from "./shared";
import type { EventKind, Lesson, NewsItem, NotificationKind, SoonItem, WorkStatus } from "./types";
import { TASK_KINDS } from "./types";

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

/** «Скоро»: непроверенные задания на ближайшие 5 суток, сначала требующие действия. */
export async function getSoon(): Promise<SoonItem[]> {
  const user = await requireUser();
  const horizon = new Date(DEMO_NOW.getTime() + 5 * 86_400_000);
  const works = await db.studentWork.findMany({
    where: {
      userId: user.id,
      status: { not: "graded" },
      component: {
        kind: { in: TASK_KINDS },
        dueAt: { gte: DEMO_NOW, lt: horizon },
        course: { enrollments: { some: { userId: user.id } } },
      },
    },
    include: { component: { include: { course: { select: { title: true, color: true } } } } },
  });
  return works
    .sort(
      (a, b) =>
        (PRIORITY[a.status] ?? 0) - (PRIORITY[b.status] ?? 0) ||
        a.component.dueAt!.getTime() - b.component.dueAt!.getTime(),
    )
    .slice(0, 4)
    .map((w) => {
      const due = formatDue(w.component.dueAt!);
      return {
        id: w.id,
        title: w.component.title,
        course: w.component.course.title,
        color: w.component.course.color,
        // справа под сроком: где работа сейчас или её вес
        note: STATUS_NOTE[w.status as WorkStatus] ?? `${w.component.weight}% оценки`,
        due: due.label,
        today: due.today,
      };
    });
}

function newsTime(d: Date): string {
  const diff = daysBetween(d, DEMO_NOW);
  if (diff <= 0) return mskTime(d);
  if (diff === 1) return "Вчера";
  if (diff < 7) return formatShortWeekday(mskDate(d));
  return formatDayMonth(d);
}

function parseBody(body: string): NewsItem["subtitle"] {
  const m = body.match(/^(.*?)\*\*(.+?)\*\*(.*)$/);
  return m ? { before: m[1] || undefined, emphasis: m[2], after: m[3] || undefined } : { before: body };
}

const ICON: Record<NotificationKind, "file-check-2" | "megaphone" | "map-pin"> = {
  grade: "file-check-2",
  document: "file-check-2",
  announcement: "megaphone",
  schedule: "map-pin",
};

export async function getNews(limit = 3): Promise<NewsItem[]> {
  const user = await requireUser();
  const rows = await db.notification.findMany({
    where: { userId: user.id, createdAt: { lte: DEMO_NOW } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((n) => ({
    id: n.id,
    title: n.title,
    subtitle: parseBody(n.body),
    time: newsTime(n.createdAt),
    unread: n.readAt == null,
    avatar:
      n.actorName && n.kind === "grade"
        ? { kind: "initials", text: teacherInitials(n.actorName), gradient: avatarGradientByKey(n.actorAvatar ?? "sand") }
        : { kind: "icon", icon: ICON[n.kind as NotificationKind] ?? "megaphone" },
  }));
}

export async function getUnreadCount(): Promise<number> {
  const user = await requireUser();
  return db.notification.count({ where: { userId: user.id, readAt: null, createdAt: { lte: DEMO_NOW } } });
}

