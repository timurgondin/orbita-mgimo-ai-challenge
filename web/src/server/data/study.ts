import "server-only";
import { db } from "@/server/db/client";
import {
  DEMO_DATE,
  DEMO_NOW,
  daysBetween,
  formatDayMonth,
  formatLongDate,
  formatMonthShort,
  formatShortWeekday,
  mskDate,
  mskTime,
} from "@/lib/demo-clock";
import { plural } from "@/lib/phrases";
import { avatarGradientByKey, currentScore, fmt1, fmtWork, formatDue, getStudent, round1, teacherInitials } from "./shared";
import {
  TASK_KINDS,
  type Assessment,
  type ComponentKind,
  type CourseCardData,
  type CourseLesson,
  type CoursePageData,
  type EventKind,
  type ExamData,
  type FormulaSegment,
  type PerfRowData,
  type StudyData,
  type TagKind,
  type TaskDetail,
  type TaskStep,
  type WorkStatus,
} from "./types";

const CREDITS_PLAN = 30;
/** «Ближайшие» — задания со сроком в пределах 10 суток, дальше — «Позже». */
const UPCOMING_DAYS = 10;

const KIND_LABEL: Record<ComponentKind, string> = {
  test: "Проверочная работа",
  homework: "Домашнее задание",
  essay: "Письменная работа",
  project: "Проект",
  exam: "Экзамен",
  participation: "Работа на занятиях",
};

const EVENT_LABEL: Record<EventKind, string> = {
  lecture: "Лекция",
  seminar: "Семинар",
  practice: "Практика",
  consultation: "Консультация",
  test: "Контрольная",
};

type Course = { slug: string; title: string; color: string; assessment: string; teacherName: string; teacherAvatar: string };
type Component = {
  id: string;
  title: string;
  kind: string;
  weight: number;
  dueAt: Date | null;
  room: string | null;
  description: string | null;
  events: { id: string }[];
};
type Work = { status: string; score: number | null; feedback: string | null; submittedAt: Date | null; gradedAt: Date | null } | undefined;

const dayTime = (d: Date) => `${formatDayMonth(d)}, ${mskTime(d)}`;

/** «сегодня», «завтра», «через 4 дня», «срок прошёл» */
function leftLabel(due: Date): string {
  if (due < DEMO_NOW) return "срок прошёл";
  const n = daysBetween(DEMO_NOW, due);
  if (n === 0) return "сегодня";
  if (n === 1) return "завтра";
  return `через ${n} ${plural(n, "день", "дня", "дней")}`;
}

/** Трекер задания: в работе → сдано → проверка → оценка. */
function steps(status: WorkStatus, work: Work): TaskStep[] {
  const cur = { upcoming: -1, draft: 0, in_progress: 0, submitted: -1, reviewing: 2, returned: 0, graded: -1 }[status];
  const fin = { upcoming: -1, draft: -1, in_progress: -1, submitted: 1, reviewing: 1, returned: -1, graded: 3 }[status];
  const when = [
    status === "draft" ? "черновик" : status === "returned" ? "на доработку" : "",
    work?.submittedAt ? dayTime(work.submittedAt) : "",
    status === "reviewing" ? "идёт" : "",
    work?.gradedAt ? formatDayMonth(work.gradedAt) : "",
  ];
  return ["В работе", "Сдано", "Проверка", "Оценка"].map((label, i) => ({
    label,
    when: when[i],
    state: i <= fin ? "fin" : i === cur ? "cur" : "todo",
  }));
}

/** Элемент оценки со всем для строки списка и окна. */
function taskDetail(course: Course, c: Component, work: Work): TaskDetail {
  const status = (work?.status ?? "upcoming") as WorkStatus;
  const kind = c.kind as ComponentKind;
  const graded = status === "graded";
  const due = c.dueAt;
  const short = due ? formatDue(due) : null;
  const near = due ? daysBetween(DEMO_NOW, due) : 0;
  return {
    id: c.id,
    courseSlug: course.slug,
    courseTitle: course.title,
    color: course.color,
    kind,
    kindLabel: kind === "exam" && course.assessment === "credit" ? "Зачёт" : KIND_LABEL[kind],
    title: c.title,
    weight: c.weight,
    tag: graded ? null : (status as TagKind),
    dueLong: due ? `${formatLongDate(mskDate(due))}, ${mskTime(due)}` : null,
    dueShort: short?.label ?? null,
    dueTime: due ? mskTime(due) : null,
    dueDay: due ? mskDate(due).slice(8).replace(/^0/, "") : null,
    dueSub: due ? (near >= 0 && near < 7 ? formatShortWeekday(mskDate(due)).toLowerCase() : formatMonthShort(due)) : null,
    dueHot: !!short?.today && !graded,
    dueLeft: due && !graded ? leftLabel(due) : null,
    room: c.room,
    eventId: c.events[0]?.id ?? null,
    description: c.description,
    score: graded && work?.score != null ? fmtWork(work.score) : null,
    gradedAt: work?.gradedAt ? formatDayMonth(work.gradedAt) : null,
    submittedAt: work?.submittedAt ? dayTime(work.submittedAt) : null,
    feedback: work?.feedback ?? null,
    teacher: {
      name: course.teacherName,
      initials: teacherInitials(course.teacherName),
      gradient: avatarGradientByKey(course.teacherAvatar),
    },
    steps: (TASK_KINDS as string[]).includes(kind) ? steps(status, work) : null,
  };
}

const formulaOf = (items: { c: { weight: number }; work: Work }[]): FormulaSegment[] =>
  items.map(({ c, work }) => ({
    weight: c.weight,
    state: work?.status === "graded" ? "done" : work && work.status !== "upcoming" ? "pending" : "empty",
  }));

/** Что подгружаем к курсу: элементы оценки с работой текущего студента и парой, где пишется работа. */
const courseInclude = (userId: string) => ({
  components: {
    orderBy: { order: "asc" as const },
    include: {
      works: { where: { userId } },
      events: { select: { id: true }, orderBy: { startsAt: "asc" as const }, take: 1 },
    },
  },
  onlineProgress: { where: { userId } },
});

/** Всё для экрана «Учёба» текущего студента. Только его записи на курсы и его работы. */
export async function getStudyData(): Promise<StudyData | null> {
  const user = await getStudent();
  if (!user) return null;

  const enrollments = await db.enrollment.findMany({
    where: { userId: user.id },
    orderBy: { order: "asc" },
    include: { course: { include: courseInclude(user.id) } },
  });

  const now = DEMO_NOW;
  const courses: CourseCardData[] = [];
  const online: CourseCardData[] = [];
  const upcoming: (TaskDetail & { at: number })[] = [];
  const later: (TaskDetail & { at: number })[] = [];
  const checked: (TaskDetail & { at: number })[] = [];
  const rows: PerfRowData[] = [];
  const exams: (ExamData & { at: number })[] = [];
  const examScores: { score: number; credits: number }[] = [];

  for (const { course } of enrollments) {
    const items = course.components.map((c) => ({ c, work: c.works[0] }));

    if (course.format === "online") {
      const p = course.onlineProgress[0];
      const total = course.lessonsTotal ?? 0;
      online.push({
        id: course.id,
        slug: course.slug,
        color: course.color,
        kindLabel: `${total} ${plural(total, "видеоурок", "видеоурока", "видеоуроков")}`,
        title: course.title,
        teacher: course.providerName ?? course.teacherName,
        score: String(p?.lessonsDone ?? 0),
        scoreSuffix: `из ${total}`,
        formula: [],
        progress: total ? Math.round(((p?.lessonsDone ?? 0) / total) * 100) : 0,
      });
      continue;
    }

    const score = currentScore(items.map(({ c, work }) => ({ weight: c.weight, work })));
    const isExam = course.assessment === "exam";
    courses.push({
      id: course.id,
      slug: course.slug,
      color: course.color,
      kindLabel: course.kindsLabel,
      title: course.title,
      teacher: course.teacherName,
      score: isExam ? (score != null ? fmt1(score) : "—") : "Зачёт",
      scoreSuffix: isExam && score != null ? "из 10" : "",
      formula: formulaOf(items),
    });

    // Задания
    for (const { c, work } of items) {
      if (!(TASK_KINDS as string[]).includes(c.kind)) continue;
      const t = taskDetail(course, c, work);
      if (work?.status === "graded") checked.push({ ...t, at: work.gradedAt?.getTime() ?? 0 });
      else if (!c.dueAt) continue;
      else if (c.dueAt.getTime() < now.getTime() + UPCOMING_DAYS * 86_400_000) upcoming.push({ ...t, at: c.dueAt.getTime() });
      else later.push({ ...t, at: c.dueAt.getTime() });
    }

    // Успеваемость
    if (isExam) {
      if (score != null) examScores.push({ score, credits: course.credits });
      rows.push({
        id: course.id,
        slug: course.slug,
        color: course.color,
        title: course.title,
        sub: "Экзамен",
        fill: score != null ? Math.round(score * 10) : 0,
        value: score != null ? fmt1(score) : "—",
        valueMuted: false,
        forecast: score != null ? String(Math.round(score)) : "",
      });
    } else {
      const graded = items.filter((i) => i.work?.status === "graded");
      rows.push({
        id: course.id,
        slug: course.slug,
        color: course.color,
        title: course.title,
        sub: "Зачёт",
        fill: graded.reduce((s, i) => s + i.c.weight, 0),
        value: "идёт",
        valueMuted: true,
        forecast: `${graded.length} из ${items.length} работ`,
      });
    }

    for (const { c } of items) {
      if (c.kind === "exam" && c.dueAt && c.dueAt >= now) {
        exams.push({
          id: c.id,
          slug: course.slug,
          day: mskDate(c.dueAt).slice(8).replace(/^0/, ""),
          month: formatMonthShort(c.dueAt),
          title: course.title,
          time: mskTime(c.dueAt),
          room: c.room ? `ауд. ${c.room}` : null,
          at: c.dueAt.getTime(),
        });
      }
    }
  }

  const credits = examScores.reduce((s, e) => s + e.credits, 0);
  const average = credits ? fmt1(Math.round((examScores.reduce((s, e) => s + e.score * e.credits, 0) / credits) * 10) / 10) : "—";
  const strip = <T extends { at: number }>(list: T[]) => list.map(({ at: _at, ...t }) => (void _at, t));

  return {
    courses,
    online,
    upcoming: strip(upcoming.sort((a, b) => a.at - b.at)),
    later: strip(later.sort((a, b) => a.at - b.at)),
    checked: strip(checked.sort((a, b) => b.at - a.at)),
    perf: {
      average,
      rank: user.courseRank,
      size: user.courseSize,
      credits: user.creditsEarned,
      creditsPlan: CREDITS_PLAN,
      rows,
      exams: exams.sort((a, b) => a.at - b.at),
    },
  };
}

/** Страница курса. Только если текущий студент записан на этот курс; иначе null (→ 404). */
export async function getCourse(slug: string): Promise<CoursePageData | null> {
  const user = await getStudent();
  if (!user || typeof slug !== "string" || slug.length > 80) return null;

  const enrollments = await db.enrollment.findMany({
    where: { userId: user.id },
    orderBy: { order: "asc" },
    select: { course: { select: { slug: true, title: true, color: true, format: true } } },
  });
  if (!enrollments.some((e) => e.course.slug === slug)) return null;

  const course = await db.course.findUniqueOrThrow({ where: { slug }, include: courseInclude(user.id) });
  const base = {
    nav: enrollments.map(({ course: c }) => ({ slug: c.slug, title: c.title, color: c.color, online: c.format === "online" })),
    slug: course.slug,
    title: course.title,
    color: course.color,
    kindLabel: course.kindsLabel,
    teacher: {
      name: course.providerName ?? course.teacherName,
      initials: teacherInitials(course.teacherName),
      gradient: avatarGradientByKey(course.teacherAvatar),
    },
    credits: course.credits,
    assessment: course.assessment as Assessment,
  };

  if (course.format === "online") {
    const p = course.onlineProgress[0];
    const total = course.lessonsTotal ?? 0;
    return {
      ...base,
      online: true,
      kindLabel: `${total} ${plural(total, "видеоурок", "видеоурока", "видеоуроков")}`,
      finalLabel: "Онлайн-курс",
      score: null,
      forecast: null,
      doneWeight: 0,
      formula: [],
      components: [],
      calc: null,
      lessons: [],
      consultation: null,
      lessonsDone: p?.lessonsDone ?? 0,
      lessonsTotal: total,
      nextLesson: p ? { title: p.nextLessonTitle, minutes: p.nextLessonMinutes } : null,
    };
  }

  const items = course.components.map((c) => ({ c, work: c.works[0] }));
  const isExam = course.assessment === "exam";
  const score = currentScore(items.map(({ c, work }) => ({ weight: c.weight, work })));
  const graded = items.filter(({ work }) => work?.status === "graded" && work.score != null);
  const remaining = items.filter(({ work }) => work?.status !== "graded");
  const exam = items.find(({ c }) => c.kind === "exam")?.c;

  const [events, cons] = await Promise.all([
    db.scheduleEvent.findMany({
      where: { courseId: course.id, endsAt: { gte: DEMO_NOW }, pair: { not: null } },
      orderBy: { startsAt: "asc" },
      take: 4,
    }),
    db.consultation.findFirst({ where: { courseId: course.id, startsAt: { gte: DEMO_NOW } }, orderBy: { startsAt: "asc" } }),
  ]);

  return {
    ...base,
    online: false,
    finalLabel: isExam ? (exam?.dueAt ? `Экзамен ${formatDayMonth(exam.dueAt)}` : "Экзамен, дата позже") : "Зачёт",
    score: isExam && score != null ? fmt1(score) : null,
    forecast: isExam && score != null ? String(Math.round(score)) : null,
    doneWeight: graded.reduce((s, { c }) => s + c.weight, 0),
    formula: formulaOf(items),
    components: items.map(({ c, work }) => taskDetail(course, c, work)),
    calc:
      isExam && remaining.length
        ? {
            gradedSum: round1(graded.reduce((s, { c, work }) => s + work!.score! * c.weight, 0)),
            remainingWeight: remaining.reduce((s, { c }) => s + c.weight, 0),
            examOnly: remaining.length === 1 && remaining[0].c.kind === "exam",
          }
        : null,
    lessons: events.map(
      (e): CourseLesson => ({
        id: e.id,
        day: mskDate(e.startsAt).slice(8).replace(/^0/, ""),
        weekday: formatShortWeekday(mskDate(e.startsAt)).toLowerCase(),
        title: e.title ?? (e.topic ? `${EVENT_LABEL[e.kind as EventKind]} «${e.topic}»` : EVENT_LABEL[e.kind as EventKind]),
        start: mskTime(e.startsAt),
        end: mskTime(e.endsAt),
        room: e.room,
        today: mskDate(e.startsAt) === DEMO_DATE,
      }),
    ),
    consultation: cons ? { id: cons.id, when: formatDue(cons.startsAt).label, place: cons.place } : null,
  };
}
