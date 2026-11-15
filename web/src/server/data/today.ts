import "server-only";
import { db } from "@/server/db/client";
import { requireUser } from "@/server/auth/session";
import { DEMO_NOW, DEMO_DATE, addDays, dayStart, daysBetween, formatDayMonth, formatShortWeekday, mskDate, mskTime } from "@/lib/demo-clock";
import { avatarGradientByKey, formatDue, getStudent, teacherInitials } from "./shared";
import type { EventKind, Lesson, NewsItem, NotificationKind, SoonItem, WorkStatus } from "./types";
import { TASK_KINDS } from "./types";

const FORMAT: Partial<Record<EventKind, string>> = { lecture: "Лекция", seminar: "Семинар", test: "Контрольная" };

/** События дня студента: события его курсов + его личные события. */
async function eventsBetween(userId: string, from: Date, to: Date): Promise<Lesson[]> {
  const enrolled = await db.enrollment.findMany({ where: { userId }, select: { courseId: true } });
  const events = await db.scheduleEvent.findMany({
    where: {
      startsAt: { gte: from, lt: to },
      OR: [{ userId: null, courseId: { in: enrolled.map((e) => e.courseId) } }, { userId }],
    },
    include: { course: { select: { title: true } } },
    orderBy: { startsAt: "asc" },
  });
  return events.map((e) => {
    const consult = e.kind === "consultation";
    return {
      id: e.id,
      date: mskDate(e.startsAt),
      start: mskTime(e.startsAt),
      end: mskTime(e.endsAt),
      title: e.title ?? e.course?.title ?? "",
      format: FORMAT[e.kind as EventKind],
      place: { label: consult ? "каб." : "ауд.", number: e.room },
      teacher: e.teacherName,
      note: e.roomChangedFrom
        ? { kind: "flag", text: "Новая аудитория" }
        : e.userId
          ? { kind: "ok", text: "Записана" }
          : undefined,
    } satisfies Lesson;
  });
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
    include: { component: { include: { course: { select: { title: true } } } } },
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
        subtitle: `${w.component.course.title} · ${STATUS_NOTE[w.status as WorkStatus] ?? `${w.component.weight}% итоговой оценки`}`,
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

