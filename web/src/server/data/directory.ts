import "server-only";
import { db } from "@/server/db/client";
import { addDays, dayStart, DEMO_DATE } from "@/lib/demo-clock";
import { requireUser } from "@/server/auth/session";
import { buildWeek, getTeacher, mondayOf, weekNav } from "./people";
import { avatarGradientByKey, emailOf, lowerFirst } from "./shared";
import type { PeopleCircle, PersonHit, StudentPageData, WeekDay } from "./types";

/**
 * Поиск людей (/people) — справочник для любого вошедшего, как в университетских порталах.
 * О студенте видно только справочное: ФИО, факультет, программа, курс, группа, почта, расписание группы.
 * Телефон и Telegram — только если студент сам открыл их в профиле. Оценок, рейтинга, формы оплаты здесь нет.
 */

export type PeopleKind = "all" | "students" | "teachers";
const KINDS: readonly PeopleKind[] = ["all", "students", "teachers"];
export const isPeopleKind = (v: unknown): v is PeopleKind => KINDS.includes(v as PeopleKind);

const MAX_QUERY = 60;
const MAX_HITS = 40;
const LOGIN_RE = /^[a-z0-9._-]{1,40}$/;

const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е");
const words = (...parts: (string | null | undefined)[]) => norm(parts.filter(Boolean).join(" ")).split(/[\s,«»"()]+/).filter(Boolean);

const STUDENT_SELECT = {
  id: true, login: true, lastName: true, firstName: true, middleName: true, faculty: true, program: true, course: true, groupName: true, avatar: true, photoAt: true,
} as const;
type StudentRow = { login: string; lastName: string; firstName: string; middleName: string | null; faculty: string | null; program: string | null; course: number | null; groupName: string | null; avatar: string; photoAt: Date | null };
type TeacherRow = { slug: string; lastName: string; firstName: string; middleName: string | null; position: string; department: string; avatar: string };

export const studentPhotoUrl = (s: { login: string; photoAt: Date | null }) => (s.photoAt ? `/people/${s.login}/photo?v=${s.photoAt.getTime()}` : null);

function studentHit(s: StudentRow): PersonHit {
  return {
    kind: "student",
    href: `/people/${s.login}`,
    name: [s.lastName, s.firstName, s.middleName].filter(Boolean).join(" "),
    initials: `${s.firstName[0] ?? ""}${s.lastName[0] ?? ""}`.toUpperCase(),
    gradient: avatarGradientByKey(s.avatar),
    photo: studentPhotoUrl(s),
    sub: [s.program, s.course ? `${s.course} курс` : null].filter(Boolean).join(", "),
    tag: s.groupName,
  };
}

function teacherHit(t: TeacherRow): PersonHit {
  return {
    kind: "teacher",
    href: `/people/${t.slug}`,
    name: [t.lastName, t.firstName, t.middleName].filter(Boolean).join(" "),
    initials: `${t.firstName[0] ?? ""}${t.lastName[0] ?? ""}`.toUpperCase(),
    gradient: avatarGradientByKey(t.avatar),
    photo: null,
    sub: `${t.position}, ${lowerFirst(t.department)}`,
    tag: null,
  };
}

/**
 * Каждое слово запроса — начало какого-то слова у человека (ФИО, группа, программа, факультет, кафедра).
 * Ранг: совпала фамилия → имя/отчество → остальное. В SQLite LIKE не понимает регистр кириллицы, поэтому фильтр в коде (людей сотни, не миллионы).
 */
function rank(query: string[], name: string[], rest: string[]): number | null {
  let worst = 0;
  for (const q of query) {
    const at = name.findIndex((w) => w.startsWith(q));
    if (at === 0) continue;
    if (at > 0) worst = Math.max(worst, 1);
    else if (rest.some((w) => w.startsWith(q))) worst = 2;
    else return null;
  }
  return worst;
}

export async function searchPeople(rawQuery: unknown, rawKind: unknown): Promise<PersonHit[]> {
  await requireUser();
  if (typeof rawQuery !== "string" || !isPeopleKind(rawKind)) return [];
  const query = words(rawQuery.slice(0, MAX_QUERY));
  if (!query.length) return [];

  const [students, teachers] = await Promise.all([
    rawKind === "teachers" ? [] : db.user.findMany({ where: { role: "student" }, select: STUDENT_SELECT }),
    rawKind === "students" ? [] : db.teacher.findMany({ select: { slug: true, lastName: true, firstName: true, middleName: true, position: true, department: true, avatar: true } }),
  ]);
  const scored: { r: number; hit: PersonHit }[] = [];
  for (const s of students) {
    const r = rank(query, words(s.lastName, s.firstName, s.middleName), words(s.groupName, s.program, s.faculty, s.course ? `${s.course} курс` : null));
    if (r !== null) scored.push({ r, hit: studentHit(s) });
  }
  for (const t of teachers) {
    const r = rank(query, words(t.lastName, t.firstName, t.middleName), words(t.position, t.department));
    if (r !== null) scored.push({ r, hit: teacherHit(t) });
  }
  return scored
    .sort((a, b) => a.r - b.r || a.hit.name.localeCompare(b.hit.name, "ru"))
    .slice(0, MAX_HITS)
    .map((s) => s.hit);
}

/**
 * Для помощника: только по ФИО, слова — основы без окончаний («Беляеву» → «беляе»), чтобы «найди Беляеву» нашло Беляеву.
 * Совпадения по программе и факультету не берём: «курс», «экономика» не должны находить людей.
 */
export async function findByName(stems: string[], limit = 5): Promise<PersonHit[]> {
  await requireUser();
  if (!stems.length) return [];
  const [students, teachers] = await Promise.all([
    db.user.findMany({ where: { role: "student" }, select: STUDENT_SELECT }),
    db.teacher.findMany({ select: { slug: true, lastName: true, firstName: true, middleName: true, position: true, department: true, avatar: true } }),
  ]);
  const scored: { r: number; hit: PersonHit }[] = [];
  for (const s of students) {
    const r = rank(stems, words(s.lastName, s.firstName, s.middleName), []);
    if (r !== null) scored.push({ r, hit: studentHit(s) });
  }
  for (const t of teachers) {
    const r = rank(stems, words(t.lastName, t.firstName, t.middleName), []);
    if (r !== null) scored.push({ r, hit: teacherHit(t) });
  }
  return scored.sort((a, b) => a.r - b.r || a.hit.name.localeCompare(b.hit.name, "ru")).slice(0, limit).map((s) => s.hit);
}

/** Пока запрос пуст — своя группа и свои преподаватели (по курсам из сессии). */
export async function getPeopleCircle(): Promise<PeopleCircle> {
  const user = await requireUser();
  if (user.role !== "student") return { group: null, classmates: [], teachers: [] };
  const [classmates, teachers] = await Promise.all([
    user.groupName
      ? db.user.findMany({ where: { role: "student", groupName: user.groupName, id: { not: user.id } }, select: STUDENT_SELECT, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] })
      : [],
    db.teacher.findMany({
      where: { courses: { some: { course: { enrollments: { some: { userId: user.id } } } } } },
      select: { slug: true, lastName: true, firstName: true, middleName: true, position: true, department: true, avatar: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ]);
  return { group: user.groupName, classmates: classmates.map(studentHit), teachers: teachers.map(teacherHit) };
}

// шифр группы или потока: «МБ-24-1», «Поток МБ-24»; всё остальное («Сборная группа») — общее для всех записанных
const GROUP_CODE = /^(Поток )?[А-ЯЁ]+-\d{2}(-\d+)?$/;

/**
 * Личное расписание студента на демо-неделю: пары курсов, на которые он записан (у каждого свой набор, есть курсы по выбору).
 * Из пар с шифром группы — только своей группы и своего потока (семинары соседних групп по тому же курсу не его).
 */
export async function personalWeek(userId: string, group: string | null, monday = mondayOf(DEMO_DATE)) {
  const stream = group ? `Поток ${group.replace(/-\d+$/, "")}` : null;
  const events = await db.scheduleEvent.findMany({
    where: { course: { enrollments: { some: { userId } } }, startsAt: { gte: dayStart(monday), lt: dayStart(addDays(monday, 7)) }, pair: { not: null } },
    include: { course: { select: { id: true, title: true, color: true } } },
    orderBy: { startsAt: "asc" },
  });
  const own = events.filter((e) => !e.groupName || e.groupName === group || e.groupName === stream || !GROUP_CODE.test(e.groupName));
  // это его расписание — все пары цветом своих курсов
  return buildWeek(own, new Set(own.flatMap((e) => (e.course ? [e.course.id] : []))), monday);
}

/** Карточка студента по логину: справочные данные и личное расписание на неделю. */
export async function getStudentPage(login: string, rawWeek?: unknown): Promise<StudentPageData | null> {
  const viewer = await requireUser();
  if (typeof login !== "string" || !LOGIN_RE.test(login)) return null;
  const s = await db.user.findUnique({
    where: { login },
    select: { ...STUDENT_SELECT, role: true, degree: true, phone: true, telegram: true, showPhone: true, showTelegram: true },
  });
  if (!s || s.role !== "student") return null;

  const nav = weekNav(rawWeek);
  const week = await personalWeek(s.id, s.groupName, nav.monday);

  const hit = studentHit(s);
  return {
    login: s.login,
    name: hit.name,
    initials: hit.initials,
    gradient: hit.gradient,
    photo: hit.photo,
    faculty: s.faculty,
    program: s.program,
    level: [s.degree, s.course ? `${s.course} курс` : null].filter(Boolean).join(", ") || null,
    group: s.groupName,
    email: emailOf(s.login),
    telegram: s.showTelegram ? s.telegram : null,
    phone: s.showPhone ? s.phone : null,
    me: s.id === viewer.id,
    nav,
    own: s.id === viewer.id ? { phone: s.phone, telegram: s.telegram, showPhone: s.showPhone, showTelegram: s.showTelegram } : null,
    week,
  };
}

/** Неделя найденного человека (для помощника): студент — личное расписание, преподаватель — его пары. */
export async function weekOf(hit: PersonHit): Promise<WeekDay[] | null> {
  await requireUser();
  const key = hit.href.slice("/people/".length);
  if (hit.kind === "teacher") return (await getTeacher(key))?.week ?? null;
  if (!LOGIN_RE.test(key)) return null;
  const u = await db.user.findUnique({ where: { login: key }, select: { id: true, role: true, groupName: true } });
  return u?.role === "student" ? personalWeek(u.id, u.groupName) : null;
}

export interface GroupRoles {
  /** чьи: «Матвей Жуков»; своя группа — null */
  who: string | null;
  group: string | null;
  headman: (PersonHit & { email: string }) | null;
  curator: (PersonHit & { email: string }) | null;
}

/** Староста и куратор группы: своей (студент из сессии) или студента по логину. Только справочные данные и почта. */
export async function groupRoles(login: string | null): Promise<GroupRoles | null> {
  const viewer = await requireUser();
  if (login !== null && !LOGIN_RE.test(login)) return null;
  const s = await db.user.findUnique({
    where: login ? { login } : { id: viewer.id },
    select: { id: true, role: true, firstName: true, lastName: true, groupName: true, headmanName: true, curatorName: true },
  });
  if (!s || s.role !== "student") return null;

  let headman: GroupRoles["headman"] = null;
  if (s.headmanName && s.groupName) {
    const [lastName = "", firstName = ""] = s.headmanName.split(" ");
    const h = await db.user.findFirst({ where: { role: "student", groupName: s.groupName, lastName, firstName }, select: STUDENT_SELECT });
    if (h) headman = { ...studentHit(h), email: emailOf(h.login) };
  }
  let curator: GroupRoles["curator"] = null;
  if (s.curatorName) {
    const [lastName = "", firstName = "", middleName = ""] = s.curatorName.split(" ");
    const t = await db.teacher.findFirst({
      where: { lastName, firstName, ...(middleName ? { middleName } : {}) },
      select: { slug: true, lastName: true, firstName: true, middleName: true, position: true, department: true, avatar: true, email: true },
    });
    if (t) curator = { ...teacherHit(t), email: t.email };
  }
  return { who: s.id === viewer.id ? null : `${s.firstName} ${s.lastName}`, group: s.groupName, headman, curator };
}
