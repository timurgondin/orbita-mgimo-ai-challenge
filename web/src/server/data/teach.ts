import "server-only";
import { cache } from "react";
import { DEMO_DATE, DEMO_NOW, addDays, dayStart, daysBetween, formatDayMonth, mskDate, mskTime } from "@/lib/demo-clock";
import { plural } from "@/lib/phrases";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { avatarGradientByKey, emailOf, fmt1, formatDue, round1, teacherInitials } from "./shared";
import type { Candidate, Gradebook, ReviewItem, TeachConsultation, TeachCourseCard, TeachCoursePage, TeachLesson, TeamMember } from "./teach-types";

const KIND: Record<string, string> = { lecture: "Лекция", seminar: "Семинар", practice: "Практика", test: "Контрольная", consultation: "Консультация" };
const SEMESTER = { from: new Date("2026-09-01T00:00:00+03:00"), to: new Date("2026-12-31T00:00:00+03:00") };
const fileSize = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} КБ` : `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} МБ`);
const when = (d: Date) => {
  const diff = daysBetween(d, DEMO_NOW);
  return diff <= 0 ? `сегодня в ${mskTime(d)}` : diff === 1 ? `вчера в ${mskTime(d)}` : `${formatDayMonth(d)}, ${mskTime(d)}`;
};
const initials = (first: string, last: string) => `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();

/** Текущий преподаватель и его запись в справочнике (связь — по университетской почте). Не преподаватель — null. */
export const getTeacher = cache(async () => {
  const user = await requireUser();
  if (user.role !== "teacher") return null;
  const teacher = await db.teacher.findFirst({ where: { email: emailOf(user.login) } });
  if (!teacher) return null;
  return { user, teacher };
});
type Ctx = NonNullable<Awaited<ReturnType<typeof getTeacher>>>;

/** Курсы, которые ведёт преподаватель: он автор курса или в составе. Все проверки доступа — через этот фильтр. */
const mine = (ctx: Ctx) => ({ OR: [{ teacherId: ctx.user.id }, { staff: { some: { teacherId: ctx.teacher.id } } }] });

export async function myCourse(ctx: Ctx, slug: unknown) {
  if (typeof slug !== "string" || slug.length > 60) return null;
  return db.course.findFirst({ where: { slug, ...mine(ctx) } });
}

function lessonView(e: { id: string; startsAt: Date; endsAt: Date; pair: number | null; kind: string; title: string | null; groupName: string | null; room: string; course: { title: string; color: string; slug: string; _count: { enrollments: number } } | null }): TeachLesson {
  return {
    id: e.id,
    date: mskDate(e.startsAt),
    start: mskTime(e.startsAt),
    end: mskTime(e.endsAt),
    pair: e.pair ?? 0,
    title: e.course?.title ?? e.title ?? "Занятие",
    kindLabel: KIND[e.kind] ?? "Занятие",
    group: e.groupName ?? "",
    room: e.room,
    color: e.course?.color ?? "py",
    slug: e.course?.slug ?? null,
    students: e.course?._count.enrollments ?? null,
  };
}

const LESSON_INCLUDE = { course: { select: { title: true, color: true, slug: true, _count: { select: { enrollments: true } } } } } as const;

async function lessonsBetween(ctx: Ctx, from: string, to: string) {
  const events = await db.scheduleEvent.findMany({
    where: { teacherName: ctx.teacher.short, pair: { not: null }, startsAt: { gte: dayStart(from), lt: dayStart(to) } },
    include: LESSON_INCLUDE,
    orderBy: { startsAt: "asc" },
  });
  return events.map(lessonView);
}

async function consultationsBetween(ctx: Ctx, from: string, to: string): Promise<TeachConsultation[]> {
  const list = await db.consultation.findMany({
    where: { teacherName: ctx.teacher.short, startsAt: { gte: dayStart(from), lt: dayStart(to) } },
    select: {
      id: true, startsAt: true, endsAt: true, pair: true, place: true, capacity: true,
      course: { select: { title: true, color: true } },
      signups: { select: { question: true, user: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: { startsAt: "asc" },
  });
  return list.map((c) => ({
    id: c.id,
    date: mskDate(c.startsAt),
    start: mskTime(c.startsAt),
    end: mskTime(c.endsAt),
    pair: c.pair ?? 0,
    courseTitle: c.course.title,
    color: c.course.color,
    place: c.place,
    count: c.signups.length,
    capacity: c.capacity,
    questions: c.signups.filter((s) => s.question).map((s) => ({ name: `${s.user.firstName} ${s.user.lastName}`, text: s.question! })),
  }));
}

/** Работы на проверку и недавно проверенные по курсам преподавателя. */
async function reviewItems(ctx: Ctx, statuses: string[], take?: number, slug?: string): Promise<ReviewItem[]> {
  const works = await db.assignmentWork.findMany({
    where: { status: { in: statuses }, assignment: { course: { ...mine(ctx), ...(slug && { slug }) } } },
    include: {
      user: { select: { firstName: true, lastName: true, login: true, avatar: true, groupName: true } },
      assignment: { select: { title: true, dueAt: true, course: { select: { title: true, color: true, slug: true } } } },
    },
    orderBy: statuses.includes("graded") ? { gradedAt: "desc" } : { submittedAt: "asc" },
    take,
  });
  return works.map((w) => ({
    id: w.id,
    student: `${w.user.lastName} ${w.user.firstName}`,
    login: w.user.login,
    initials: initials(w.user.firstName, w.user.lastName),
    gradient: avatarGradientByKey(w.user.avatar),
    group: w.user.groupName ?? "",
    task: w.assignment.title,
    course: w.assignment.course.title,
    color: w.assignment.course.color,
    slug: w.assignment.course.slug,
    sent: w.submittedAt ? when(w.submittedAt) : "",
    late: !!(w.submittedAt && w.assignment.dueAt && w.submittedAt > w.assignment.dueAt),
    status: w.status,
    file: w.fileName ? { name: w.fileName, size: fileSize(w.fileSize ?? 0) } : null,
    score: w.score,
    feedback: w.feedback,
    due: w.assignment.dueAt ? formatDue(w.assignment.dueAt).label : null,
  }));
}

const WAITING = ["submitted", "reviewing"];

export async function getTeachToday() {
  const ctx = await getTeacher();
  if (!ctx) return null;
  const [today, tomorrowAll, cons, review, total] = await Promise.all([
    lessonsBetween(ctx, DEMO_DATE, addDays(DEMO_DATE, 1)),
    lessonsBetween(ctx, addDays(DEMO_DATE, 1), addDays(DEMO_DATE, 8)),
    consultationsBetween(ctx, DEMO_DATE, addDays(DEMO_DATE, 1)),
    reviewItems(ctx, WAITING, 4),
    db.assignmentWork.count({ where: { status: { in: WAITING }, assignment: { course: mine(ctx) } } }),
  ]);
  const next = tomorrowAll[0];
  return { today, cons, next: next ?? null, nextDate: next?.date ?? null, review, total };
}

/** Средний текущий балл курса по студентам — как у студента: Σ балл·вес / Σ вес оценённого. */
async function loadCourse(courseId: string) {
  return db.course.findUniqueOrThrow({
    where: { id: courseId },
    include: {
      components: { orderBy: { order: "asc" }, include: { works: { select: { userId: true, status: true, score: true } } } },
      assignments: { orderBy: [{ order: "asc" }, { dueAt: "asc" }], include: { works: { select: { userId: true, status: true, score: true } } } },
      enrollments: { include: { user: { select: { id: true, firstName: true, lastName: true, login: true, avatar: true, groupName: true } } } },
    },
  });
}
type Loaded = Awaited<ReturnType<typeof loadCourse>>;

function cellsOf(c: Loaded, userId: string) {
  const cells: Record<string, number | null> = {};
  let sum = 0;
  let weights = 0;
  for (const comp of c.components) {
    let score: number | null = null;
    if (comp.aggregate) {
      const scored = c.assignments
        .filter((a) => a.componentId === comp.id)
        .map((a) => a.works.find((w) => w.userId === userId))
        .filter((w) => w?.status === "graded" && w.score != null);
      score = scored.length ? round1(scored.reduce((s, w) => s + w!.score!, 0) / scored.length) : null;
    } else {
      const w = comp.works.find((x) => x.userId === userId);
      score = w?.status === "graded" && w.score != null ? w.score : null;
    }
    cells[comp.id] = score;
    if (score != null) {
      sum += score * comp.weight;
      weights += comp.weight;
    }
  }
  return { cells, total: weights ? round1(sum / weights) : null };
}

const groupsOf = (c: Loaded) => {
  const g = [...new Set(c.enrollments.map((e) => e.user.groupName).filter(Boolean))].sort() as string[];
  return g.length ? g.join(", ") : "";
};
const semesterProgress = () => Math.round(((DEMO_NOW.getTime() - SEMESTER.from.getTime()) / (SEMESTER.to.getTime() - SEMESTER.from.getTime())) * 100);

export async function getTeachCourses(): Promise<TeachCourseCard[] | null> {
  const ctx = await getTeacher();
  if (!ctx) return null;
  const list = await db.course.findMany({ where: mine(ctx), select: { id: true }, orderBy: { title: "asc" } });
  return Promise.all(
    list.map(async ({ id }) => {
      const c = await loadCourse(id);
      const totals = c.enrollments.map((e) => cellsOf(c, e.userId).total).filter((x): x is number => x != null);
      return {
        slug: c.slug,
        title: c.title,
        color: c.color,
        kindLabel: c.kindsLabel || "Занятия",
        groups: groupsOf(c),
        students: c.enrollments.length,
        toReview: c.assignments.reduce((s, a) => s + a.works.filter((w) => WAITING.includes(w.status)).length, 0),
        average: totals.length ? fmt1(round1(totals.reduce((s, x) => s + x, 0) / totals.length)) : null,
        progress: semesterProgress(),
        exam: (() => {
          const e = c.components.find((k) => k.kind === "exam" && k.dueAt);
          return e?.dueAt ? formatDayMonth(e.dueAt) : null;
        })(),
      };
    }),
  );
}

export async function getReview(rawCourse?: unknown) {
  const ctx = await getTeacher();
  if (!ctx) return null;
  const courses = await db.course.findMany({ where: mine(ctx), select: { slug: true, title: true, color: true }, orderBy: { title: "asc" } });
  const slug = typeof rawCourse === "string" && courses.some((c) => c.slug === rawCourse) ? rawCourse : undefined;
  const [waiting, checked] = await Promise.all([reviewItems(ctx, WAITING, undefined, slug), reviewItems(ctx, ["graded", "returned"], 8, slug)]);
  return { courses, slug: slug ?? null, waiting, checked };
}

export async function getGradebook(rawSlug?: unknown): Promise<{ courses: { slug: string; title: string; color: string }[]; book: Gradebook } | null> {
  const ctx = await getTeacher();
  if (!ctx) return null;
  const courses = await db.course.findMany({ where: mine(ctx), select: { id: true, slug: true, title: true, color: true }, orderBy: { title: "asc" } });
  if (!courses.length) return null;
  const pick = courses.find((c) => c.slug === rawSlug) ?? courses[0];
  const c = await loadCourse(pick.id);
  return {
    courses: courses.map(({ slug, title, color }) => ({ slug, title, color })),
    book: {
      slug: c.slug,
      title: c.title,
      color: c.color,
      canEdit: true,
      columns: c.components.map((k) => ({ id: k.id, title: k.title, short: k.shortTitle ?? (k.kind === "participation" ? "Семинары" : k.kind === "test" ? k.title.replace("Контрольная ", "КР ") : k.kind === "homework" && k.aggregate && k.title === "Домашние задания" ? "ДЗ" : k.title), weight: k.weight, aggregate: k.aggregate })),
      rows: c.enrollments
        .map((e) => ({
          id: e.user.id,
          name: `${e.user.lastName} ${e.user.firstName}`,
          login: e.user.login,
          initials: initials(e.user.firstName, e.user.lastName),
          gradient: avatarGradientByKey(e.user.avatar),
          group: e.user.groupName ?? "",
          ...cellsOf(c, e.userId),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "ru")),
    },
  };
}

export async function getTeachCourse(slug: unknown): Promise<TeachCoursePage | null> {
  const ctx = await getTeacher();
  if (!ctx) return null;
  const found = await myCourse(ctx, slug);
  if (!found) return null;
  const c = await loadCourse(found.id);
  const [staff, assistants] = await Promise.all([
    db.courseTeacher.findMany({ where: { courseId: c.id }, include: { teacher: true }, orderBy: { order: "asc" } }),
    db.courseAssistant.findMany({ where: { courseId: c.id }, include: { user: true }, orderBy: { createdAt: "asc" } }),
  ]);
  const total = c.enrollments.length;
  const team: TeamMember[] = [
    ...staff.map((s) => ({
      id: s.id,
      name: [s.teacher.lastName, s.teacher.firstName, s.teacher.middleName].filter(Boolean).join(" "),
      initials: teacherInitials(s.teacher.short),
      gradient: avatarGradientByKey(s.teacher.avatar),
      role: s.teacher.id === ctx.teacher.id ? `${s.role}, это вы` : s.role,
      href: `/people/${s.teacher.slug}`,
    })),
    ...assistants.map((a) => ({
      id: a.id,
      name: `${a.user.lastName} ${a.user.firstName}`,
      initials: initials(a.user.firstName, a.user.lastName),
      gradient: avatarGradientByKey(a.user.avatar),
      role: `Ассистент, ${a.user.program ?? ""}${a.user.course ? `, ${a.user.course} курс` : ""}`,
      href: `/people/${a.user.login}`,
      assistant: { canReview: a.canReview, canGrade: a.canGrade, since: `с ${formatDayMonth(a.createdAt)}` },
    })),
  ];
  let topics: string[] = [];
  try {
    topics = c.syllabus ? ((JSON.parse(c.syllabus) as { topics?: string[] }).topics ?? []) : [];
  } catch {}
  if (!topics.length) topics = ["Введение", "Двусторонние рынки", "Сетевые эффекты", "Ценообразование платформ", "Регулирование"];
  return {
    slug: c.slug,
    title: c.title,
    color: c.color,
    kindLabel: c.kindsLabel || "Занятия",
    groups: groupsOf(c),
    students: total,
    credits: c.credits,
    assessment: c.assessment === "exam" ? "Экзамен" : "Зачёт",
    formula: c.components.map((k) => ({ title: k.title, weight: k.weight })),
    tasks: c.assignments.map((a) => ({
      id: a.id,
      title: a.title,
      due: a.dueAt ? formatDue(a.dueAt).label : null,
      sent: a.works.filter((w) => w.status !== "upcoming" && w.status !== "draft").length,
      graded: a.works.filter((w) => w.status === "graded").length,
      total,
      open: !a.dueAt || a.dueAt > DEMO_NOW,
    })),
    team,
    materials: [
      { title: "Лекции", items: topics.slice(0, 6).map((t, i) => `${i + 1}. ${t}`) },
      { title: "Семинары", items: ["Задачи к семинарам", "Разборы контрольных"] },
    ],
    toReview: c.assignments.reduce((s, a) => s + a.works.filter((w) => WAITING.includes(w.status)).length, 0),
  };
}

/** Кандидаты в ассистенты: старшекурсники и магистранты, не записанные на этот курс. Поиск по фамилии или имени. */
export async function findCandidates(ctx: Ctx, courseId: string, raw: unknown): Promise<Candidate[]> {
  const q = typeof raw === "string" ? raw.trim().slice(0, 40) : "";
  const words = q.split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
  const list = await db.user.findMany({
    where: {
      role: "student",
      OR: [{ course: { gte: 3 } }, { degree: "Магистратура" }],
      enrollments: { none: { courseId } },
      assisting: { none: { courseId } },
      ...(words.length && { AND: words.map((w) => ({ OR: [{ lastName: { startsWith: w } }, { firstName: { startsWith: w } }] })) }),
    },
    orderBy: [{ course: "desc" }, { lastName: "asc" }],
    take: 200,
  });
  void ctx;
  // сначала магистранты и старшекурсники экономических программ — им проще помогать на курсе
  const RANK = ["Цифровая экономика", "Экономика и данные", "Финансы"];
  const rank = (p: string | null) => (RANK.indexOf(p ?? "") + 1 || RANK.length + 1);
  return list.sort((a, b) => rank(a.program) - rank(b.program)).slice(0, 8).map((u) => ({
    id: u.id,
    name: `${u.lastName} ${u.firstName}`,
    initials: initials(u.firstName, u.lastName),
    gradient: avatarGradientByKey(u.avatar),
    line: `${u.program ?? ""}, ${u.degree === "Магистратура" ? "магистратура" : `${u.course} курс`}`,
  }));
}

/** Неделя преподавателя для «Времени»: пары и консультации ±3 недели. */
export async function getTeachTime() {
  const ctx = await getTeacher();
  if (!ctx) return null;
  const dow = new Date(`${DEMO_DATE}T12:00:00+03:00`).getUTCDay();
  const baseMonday = addDays(DEMO_DATE, -((dow + 6) % 7));
  const from = addDays(baseMonday, -21);
  const to = addDays(baseMonday, 28);
  const [lessons, consultations, courses] = await Promise.all([
    lessonsBetween(ctx, from, to),
    consultationsBetween(ctx, from, to),
    db.course.findMany({ where: mine(ctx), select: { id: true, title: true } }),
  ]);
  const week = lessons.filter((l) => l.date >= baseMonday && l.date < addDays(baseMonday, 7));
  return {
    baseMonday,
    lessons,
    consultations,
    courses,
    load: `${week.length} ${plural(week.length, "пара", "пары", "пар")} на этой неделе`,
  };
}
