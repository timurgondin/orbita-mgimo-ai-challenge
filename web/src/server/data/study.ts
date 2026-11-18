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
import { avatarGradientByKey, fmt1, fmtWork, formatDue, getStudent, round1, teacherInitials } from "./shared";
import type {
  Assessment,
  AssignmentKind,
  ComponentKind,
  CourseCardData,
  CourseLesson,
  CoursePageData,
  EventKind,
  ExamData,
  FormulaItem,
  FormulaSegment,
  PerfRowData,
  StaffRef,
  StudyData,
  Syllabus,
  TagKind,
  TaskDetail,
  TaskStep,
  WorkStatus,
} from "./types";

const CREDITS_PLAN = 30;
/** «Ближайшие» — задания со сроком в пределах 10 суток, дальше — «Позже». */
const UPCOMING_DAYS = 10;
const HOUR = 3_600_000;

const COMPONENT_LABEL: Record<ComponentKind, string> = {
  test: "Проверочная работа",
  homework: "Домашние задания",
  essay: "Письменная работа",
  project: "Проект",
  exam: "Экзамен",
  participation: "Работа на занятиях",
};
const TASK_LABEL: Record<AssignmentKind, string> = {
  homework: "Домашнее задание",
  essay: "Письменная работа",
  test: "Проверочная работа",
  project: "Проект",
  practice: "Для практики",
};
const EVENT_LABEL: Record<EventKind, string> = {
  lecture: "Лекция",
  seminar: "Семинар",
  practice: "Практика",
  consultation: "Консультация",
  test: "Контрольная",
};
const STATUS_WORD: Record<WorkStatus, string> = {
  upcoming: "впереди",
  draft: "черновик",
  in_progress: "в работе",
  submitted: "отправлено",
  reviewing: "на проверке",
  graded: "проверено",
  returned: "на доработку",
};
/** Статусы, при которых тег не нужен: «впереди» и так понятно по сроку. */
const QUIET: WorkStatus[] = ["upcoming", "graded"];
const OPEN_FOR_UPLOAD: WorkStatus[] = ["upcoming", "draft", "in_progress", "returned"];

export const fileSize = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} КБ` : `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} МБ`);
const dayTime = (d: Date) => `${formatDayMonth(d)}, ${mskTime(d)}`;

/** Сколько осталось до срока: «2 дня 6 ч», «5 ч», «40 мин». */
function timeLeft(due: Date): string {
  const ms = due.getTime() - DEMO_NOW.getTime();
  if (ms <= 0) return "срок прошёл";
  if (ms < HOUR) return `${Math.max(1, Math.round(ms / 60_000))} мин`;
  const days = Math.floor(ms / (24 * HOUR));
  const hours = Math.floor((ms % (24 * HOUR)) / HOUR);
  if (!days) return `${hours} ч`;
  return `${days} ${plural(days, "день", "дня", "дней")}${hours && days < 3 ? ` ${hours} ч` : ""}`;
}

/** Трекер задания: в работе → сдано → проверка → оценка. */
function steps(status: WorkStatus, sent: Date | null, graded: Date | null): TaskStep[] {
  const cur = { upcoming: -1, draft: 0, in_progress: 0, submitted: -1, reviewing: 2, returned: 0, graded: -1 }[status];
  const fin = { upcoming: -1, draft: -1, in_progress: -1, submitted: 1, reviewing: 1, returned: -1, graded: 3 }[status];
  const when = [
    status === "draft" ? "черновик" : status === "returned" ? "на доработку" : "",
    sent ? dayTime(sent) : "",
    status === "reviewing" ? "идёт" : "",
    graded ? formatDayMonth(graded) : "",
  ];
  return ["В работе", "Сдано", "Проверка", "Оценка"].map((label, i) => ({ label, when: when[i], state: i <= fin ? "fin" : i === cur ? "cur" : "todo" }));
}

// ---- Загрузка курсов с заданиями ----

const courseInclude = (userId: string) => ({
  components: {
    orderBy: { order: "asc" as const },
    include: {
      works: { where: { userId } },
      events: { select: { id: true }, orderBy: { startsAt: "asc" as const }, take: 1 },
    },
  },
  assignments: {
    orderBy: [{ dueAt: "asc" as const }, { order: "asc" as const }],
    include: {
      works: { where: { userId } },
      component: { select: { id: true, title: true, weight: true, aggregate: true, events: { select: { id: true }, take: 1 } } },
    },
  },
  staff: { orderBy: { order: "asc" as const }, include: { teacher: true } },
  onlineProgress: { where: { userId } },
});

type Loaded = Awaited<ReturnType<typeof loadCourses>>[number];
async function loadCourses(userId: string, slug?: string) {
  const enrollments = await db.enrollment.findMany({
    where: { userId, ...(slug ? { course: { slug } } : {}) },
    orderBy: { order: "asc" },
    include: { course: { include: courseInclude(userId) } },
  });
  return enrollments.map((e) => e.course);
}

const staffOf = (c: Loaded): StaffRef[] =>
  c.staff.map(({ teacher: t, role }) => ({
    slug: t.slug,
    name: [t.firstName, t.middleName, t.lastName].filter(Boolean).join(" "),
    initials: teacherInitials(t.short),
    gradient: avatarGradientByKey(t.avatar),
    role,
    position: t.position,
  }));

/** Кто проверяет задания: семинарист или практик, иначе лектор. */
function checkerOf(c: Loaded) {
  const s = c.staff.find((x) => x.role !== "Лекции") ?? c.staff[0];
  const short = s?.teacher.short ?? c.teacherName;
  return { name: short, initials: teacherInitials(short), gradient: avatarGradientByKey(s?.teacher.avatar ?? c.teacherAvatar) };
}

/** Задание со всем для строки и окна. */
function taskDetail(c: Loaded, a: Loaded["assignments"][number]): TaskDetail {
  const work = a.works[0];
  const status = (work?.status ?? "upcoming") as WorkStatus;
  const kind = a.kind as AssignmentKind;
  const graded = status === "graded";
  const finished = graded || status === "submitted" || status === "reviewing";
  const due = a.dueAt;
  const short = due ? formatDue(due) : null;
  const near = due ? daysBetween(DEMO_NOW, due) : 0;
  const comp = a.component;
  return {
    id: a.id,
    courseSlug: c.slug,
    courseTitle: c.title,
    color: c.color,
    kind,
    kindLabel: kind === "essay" && /эссе|essay/i.test(a.title) ? "Эссе" : TASK_LABEL[kind],
    title: a.title,
    counts: comp ? (comp.aggregate ? `В «${comp.title}» — ${comp.weight}% оценки` : `${comp.weight}% итоговой оценки`) : null,
    tag: QUIET.includes(status) ? null : (status as TagKind),
    dueLong: due ? `${formatLongDate(mskDate(due))}, ${mskTime(due)}` : null,
    dueShort: short?.label ?? null,
    dueTime: due ? mskTime(due) : null,
    dueDay: due ? mskDate(due).slice(8).replace(/^0/, "") : null,
    dueSub: due ? (near >= 0 && near < 7 ? formatShortWeekday(mskDate(due)).toLowerCase() : formatMonthShort(due)) : null,
    dueHot: !!due && !finished && due.getTime() - DEMO_NOW.getTime() < 24 * HOUR,
    left: due && !finished ? timeLeft(due) : null,
    room: a.room,
    eventId: comp?.events[0]?.id ?? null,
    description: a.description,
    score: graded && work?.score != null ? fmtWork(work.score) : null,
    done: graded,
    gradedAt: work?.gradedAt ? formatDayMonth(work.gradedAt) : null,
    submittedAt: work?.submittedAt ? dayTime(work.submittedAt) : null,
    feedback: work?.feedback ?? null,
    teacher: checkerOf(c),
    steps: a.upload || kind === "test" ? steps(status, work?.submittedAt ?? null, work?.gradedAt ?? null) : null,
    upload: a.upload,
    file: work?.fileName ? { name: work.fileName, size: fileSize(work.fileSize ?? 0) } : null,
    canSubmit: a.upload && OPEN_FOR_UPLOAD.includes(status),
    canWithdraw: a.upload && status === "submitted",
  };
}

/** Балл и состояние элемента формулы: у элемента-агрегата — среднее по проверенным заданиям. */
function componentState(c: Loaded, comp: Loaded["components"][number]) {
  const work = comp.works[0];
  if (comp.aggregate) {
    const linked = c.assignments.filter((a) => a.componentId === comp.id);
    const scored = linked.filter((a) => a.works[0]?.status === "graded" && a.works[0].score != null);
    const score = scored.length ? scored.reduce((s, a) => s + a.works[0].score!, 0) / scored.length : null;
    const active = linked.some((a) => a.works[0] && a.works[0].status !== "upcoming");
    const state: FormulaSegment["state"] = linked.length && scored.length === linked.length ? "done" : score != null || active ? "pending" : "empty";
    return { score, state, linked, scored };
  }
  const graded = work?.status === "graded" && work.score != null;
  const state: FormulaSegment["state"] = graded ? "done" : work && work.status !== "upcoming" ? "pending" : "empty";
  return { score: graded ? work!.score! : null, state, linked: c.assignments.filter((a) => a.componentId === comp.id), scored: [] };
}

/** Текущий балл: Σ балл·вес / Σ вес оценённого (у агрегатов — текущее среднее). */
function courseScore(c: Loaded) {
  let sum = 0;
  let weights = 0;
  for (const comp of c.components) {
    const { score } = componentState(c, comp);
    if (score != null) {
      sum += score * comp.weight;
      weights += comp.weight;
    }
  }
  return { score: weights ? round1(sum / weights) : null, sum, weights };
}

// ---- Экран «Учёба» ----

/** Всё для экрана «Учёба» текущего студента. Только его записи на курсы и его работы. */
export async function getStudyData(): Promise<StudyData | null> {
  const user = await getStudent();
  if (!user) return null;
  const list = await loadCourses(user.id);

  const now = DEMO_NOW;
  const courses: CourseCardData[] = [];
  const online: CourseCardData[] = [];
  const upcoming: (TaskDetail & { at: number })[] = [];
  const later: (TaskDetail & { at: number })[] = [];
  const waiting: (TaskDetail & { at: number })[] = [];
  const checked: (TaskDetail & { at: number })[] = [];
  const rows: PerfRowData[] = [];
  const exams: (ExamData & { at: number })[] = [];
  const examScores: { score: number; credits: number }[] = [];

  for (const course of list) {
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

    const { score } = courseScore(course);
    const isExam = course.assessment === "exam";
    const states = course.components.map((comp) => ({ comp, ...componentState(course, comp) }));
    courses.push({
      id: course.id,
      slug: course.slug,
      color: course.color,
      kindLabel: course.kindsLabel,
      title: course.title,
      teacher: course.staff.map((s) => s.teacher.short).join(", ") || course.teacherName,
      score: isExam ? (score != null ? fmt1(score) : "—") : "Зачёт",
      scoreSuffix: isExam && score != null ? "из 10" : "",
      formula: states.map(({ comp, state }) => ({ weight: comp.weight, state })),
    });

    // Задания: открытые — по сроку, проверенные — по дате проверки
    for (const a of course.assignments) {
      const t = taskDetail(course, a);
      const work = a.works[0];
      if (t.done) checked.push({ ...t, at: work?.gradedAt?.getTime() ?? 0 });
      else if (work?.status === "submitted" || work?.status === "reviewing") waiting.push({ ...t, at: work.submittedAt?.getTime() ?? 0 });
      else if (!a.dueAt) continue;
      else if (a.dueAt.getTime() < now.getTime() + UPCOMING_DAYS * 86_400_000) upcoming.push({ ...t, at: a.dueAt.getTime() });
      else later.push({ ...t, at: a.dueAt.getTime() });
    }

    // Успеваемость
    if (isExam) {
      if (score != null) examScores.push({ score, credits: course.credits });
      rows.push({
        id: course.id,
        slug: course.slug,
        color: course.color,
        title: course.title,
        sub: course.autoPassFrom != null ? `Экзамен, автомат от ${fmtWork(course.autoPassFrom)}` : "Экзамен",
        fill: score != null ? Math.round(score * 10) : 0,
        value: score != null ? fmt1(score) : "—",
        valueMuted: false,
        forecast: score != null ? String(Math.round(score)) : "",
      });
    } else {
      const done = states.filter((s) => s.state === "done");
      rows.push({
        id: course.id,
        slug: course.slug,
        color: course.color,
        title: course.title,
        sub: "Зачёт",
        fill: done.reduce((s, x) => s + x.comp.weight, 0),
        value: "идёт",
        valueMuted: true,
        forecast: `${done.length} из ${states.length} работ`,
      });
    }

    for (const c of course.components) {
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
  const strip = <T extends { at: number }>(xs: T[]) => xs.map(({ at: _at, ...t }) => (void _at, t));

  return {
    courses,
    online,
    upcoming: strip(upcoming.sort((a, b) => a.at - b.at)),
    later: strip(later.sort((a, b) => a.at - b.at)),
    waiting: strip(waiting.sort((a, b) => b.at - a.at)),
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

// ---- Страница курса ----

function parseSyllabus(raw: string | null): Syllabus | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Syllabus;
  } catch {
    return null;
  }
}

/** Номер семестра обучения на демо-дату: осень второго курса — 3. */
function semesterNumber(admission: number | null): number | null {
  if (!admission) return null;
  const [y, m] = DEMO_DATE.split("-").map(Number);
  return (y - admission) * 2 + (m >= 9 ? 1 : 0) || null;
}

/** Страница курса. Только если текущий студент записан на этот курс; иначе null (→ 404). */
export async function getCourse(slug: string): Promise<CoursePageData | null> {
  const user = await getStudent();
  if (!user || typeof slug !== "string" || slug.length > 80) return null;

  const [nav, [course]] = await Promise.all([
    db.enrollment.findMany({
      where: { userId: user.id },
      orderBy: { order: "asc" },
      select: { course: { select: { slug: true, title: true, color: true, format: true } } },
    }),
    loadCourses(user.id, slug),
  ]);
  if (!course) return null;

  const sem = semesterNumber(user.admissionYear);
  const base = {
    nav: nav.map(({ course: c }) => ({ slug: c.slug, title: c.title, color: c.color, online: c.format === "online" })),
    slug: course.slug,
    title: course.title,
    color: course.color,
    kindLabel: course.kindsLabel,
    staff: staffOf(course),
    credits: course.credits,
    assessment: course.assessment as Assessment,
    syllabus: parseSyllabus(course.syllabus),
    docMeta: {
      faculty: user.faculty ?? "",
      program: user.program ?? "",
      semester: sem ? `${sem} семестр` : "",
      exam: course.assessment === "exam" ? "экзамен" : "зачёт",
    },
  };

  if (course.format === "online") {
    const p = course.onlineProgress[0];
    const total = course.lessonsTotal ?? 0;
    return {
      ...base,
      online: true,
      provider: course.providerName ?? course.teacherName,
      kindLabel: `${total} ${plural(total, "видеоурок", "видеоурока", "видеоуроков")}`,
      finalLabel: "Онлайн-курс",
      score: null,
      forecast: null,
      doneWeight: 0,
      formula: [],
      components: [],
      tasks: [],
      calc: null,
      autoPass: null,
      lessons: [],
      consultation: null,
      lessonsDone: p?.lessonsDone ?? 0,
      lessonsTotal: total,
      nextLesson: p ? { title: p.nextLessonTitle, minutes: p.nextLessonMinutes } : null,
    };
  }

  const isExam = course.assessment === "exam";
  const { score, sum } = courseScore(course);
  const states = course.components.map((comp) => ({ comp, ...componentState(course, comp) }));
  const remaining = states.filter((s) => s.score == null || s.state !== "done");

  const components: FormulaItem[] = states.map(({ comp, score: sc, state, linked, scored }) => {
    const work = comp.works[0];
    const due = comp.dueAt;
    const sub = comp.aggregate
      ? `проверено ${scored.length} из ${linked.length}`
      : work?.status === "graded"
        ? work.gradedAt ? `проверено ${formatDayMonth(work.gradedAt)}` : "оценено"
        : due ? formatDue(due).label.charAt(0).toLowerCase() + formatDue(due).label.slice(1)
        : comp.kind === "participation" ? "по занятиям"
        : "дата позже";
    return {
      id: comp.id,
      title: comp.title,
      kindLabel: comp.kind === "exam" && !isExam ? "Зачёт" : COMPONENT_LABEL[comp.kind as ComponentKind],
      weight: comp.weight,
      state,
      score: sc != null ? (comp.aggregate ? fmt1(round1(sc)) : fmtWork(sc)) : null,
      sub,
      hot: !!due && work?.status !== "graded" && due.getTime() - DEMO_NOW.getTime() < 24 * HOUR && due > DEMO_NOW,
      description: comp.description,
      dueLong: due ? `${formatLongDate(mskDate(due))}, ${mskTime(due)}` : null,
      room: comp.room,
      eventId: comp.events[0]?.id ?? null,
      aggregate: comp.aggregate,
      tasks: linked.map((a) => ({
        id: a.id,
        title: a.title,
        score: a.works[0]?.status === "graded" && a.works[0].score != null ? fmtWork(a.works[0].score) : null,
        status: STATUS_WORD[(a.works[0]?.status ?? "upcoming") as WorkStatus],
      })),
    };
  });

  const tasks = course.assignments.map((a) => taskDetail(course, a));
  const [events, cons] = await Promise.all([
    db.scheduleEvent.findMany({ where: { courseId: course.id, endsAt: { gte: DEMO_NOW }, pair: { not: null } }, orderBy: { startsAt: "asc" }, take: 4 }),
    db.consultation.findFirst({ where: { courseId: course.id, startsAt: { gte: DEMO_NOW } }, orderBy: { startsAt: "asc" } }),
  ]);

  const auto =
    course.autoPassFrom != null && score != null
      ? {
          from: fmtWork(course.autoPassFrom),
          rule: course.autoPassRule ?? "",
          ok: score >= course.autoPassFrom,
          gap: score >= course.autoPassFrom ? null : fmt1(round1(course.autoPassFrom - score)),
        }
      : null;

  return {
    ...base,
    online: false,
    provider: null,
    finalLabel: isExam ? "Экзамен" : "Зачёт",
    score: isExam && score != null ? fmt1(score) : null,
    forecast: isExam && score != null ? String(Math.round(score)) : null,
    doneWeight: states.filter((s) => s.state === "done").reduce((s, x) => s + x.comp.weight, 0),
    formula: states.map(({ comp, state }) => ({ weight: comp.weight, state })),
    components,
    tasks,
    calc:
      isExam && remaining.length
        ? {
            // частично оценённые агрегаты считаем «оставшимися» целиком: так калькулятор не обещает лишнего
            gradedSum: round1(sum - states.filter((s) => s.state !== "done" && s.score != null).reduce((t, s) => t + s.score! * s.comp.weight, 0)),
            remainingWeight: remaining.reduce((t, s) => t + s.comp.weight, 0),
            examOnly: remaining.length === 1 && remaining[0].comp.kind === "exam",
          }
        : null,
    autoPass: auto,
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
