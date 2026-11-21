import "server-only";
import { db } from "@/server/db/client";
import { DEMO_DATE, DEMO_NOW, addDays, dayStart, formatDayMonth, formatShortWeekday, mskDate, mskTime } from "@/lib/demo-clock";
import { requireUser } from "@/server/auth/session";
import { avatarGradientByKey, formatDue, teacherInitials } from "./shared";
import type { EventKind, TeacherPageData, WeekDay, WeekNav } from "./types";

const KIND: Record<EventKind, string> = { lecture: "Лекция", seminar: "Семинар", practice: "Практика", consultation: "Консультация", test: "Контрольная" };

function list<T>(raw: string): T[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** Понедельник недели, в которую попадает дата. */
export function mondayOf(iso: string): string {
  const dow = new Date(`${iso}T12:00:00+03:00`).getUTCDay();
  return addDays(iso, -((dow + 6) % 7));
}

/** Листать карточки людей можно на столько недель в обе стороны (как «Время»). */
const WEEKS_RANGE = 3;

/** Понедельник недели из адреса (?week=2026-11-23): только понедельники в пределах ±3 недель, иначе — текущая. */
export function weekNav(raw: unknown): WeekNav {
  const base = mondayOf(DEMO_DATE);
  const offsets = Array.from({ length: WEEKS_RANGE * 2 + 1 }, (_, i) => i - WEEKS_RANGE);
  const k = offsets.find((o) => addDays(base, 7 * o) === raw) ?? 0;
  const monday = addDays(base, 7 * k);
  const sat = addDays(monday, 5);
  const noon = (iso: string) => new Date(`${iso}T12:00:00+03:00`);
  const range =
    monday.slice(5, 7) === sat.slice(5, 7)
      ? `${Number(monday.slice(8))} – ${formatDayMonth(noon(sat))}`
      : `${formatDayMonth(noon(monday))} – ${formatDayMonth(noon(sat))}`;
  return {
    monday,
    label: k === 0 ? "Эта неделя" : k === 1 ? "Следующая неделя" : k === -1 ? "Прошлая неделя" : range,
    range,
    prev: k > -WEEKS_RANGE ? addDays(monday, -7) : null,
    next: k < WEEKS_RANGE ? addDays(monday, 7) : null,
  };
}

type WeekEvent = {
  id: string; startsAt: Date; endsAt: Date; room: string; kind: string; title: string | null; groupName: string | null; teacherName: string;
  course: { id: string; title: string; color: string } | null;
};

/** Неделя Пн–Сб по дням (даже пустые дни — так видно ритм нагрузки); свои пары (курсы текущего студента) помечены. */
export function buildWeek(events: WeekEvent[], enrolled: Set<string>, monday = mondayOf(DEMO_DATE)): WeekDay[] {
  const week: WeekDay[] = Array.from({ length: 6 }, (_, i) => {
    const date = addDays(monday, i);
    return { date, dow: formatShortWeekday(date), day: date.slice(8).replace(/^0/, ""), items: [] };
  });
  const seen = new Set<string>();
  for (const e of events) {
    // одна пара могла попасть в базу дважды (у разных студентов свой экземпляр курса) — схлопываем по времени и аудитории
    const key = `${e.startsAt.toISOString()}|${e.room}`;
    if (seen.has(key)) continue;
    seen.add(key);
    week.find((d) => d.date === mskDate(e.startsAt))?.items.push({
      id: e.id,
      start: mskTime(e.startsAt),
      end: mskTime(e.endsAt),
      title: e.course?.title ?? e.title ?? "",
      kind: KIND[e.kind as EventKind],
      group: e.groupName ?? "",
      color: e.course?.color ?? null,
      room: e.room,
      teacher: e.teacherName,
      mine: !!e.course && enrolled.has(e.course.id),
    });
  }
  return week;
}

/**
 * Публичная карточка преподавателя — для любого вошедшего: должность, контакты, публикации, расписание недели.
 * «Ведёт у тебя» и ссылки на консультации — только по курсам, на которые записан текущий студент.
 */
export async function getTeacher(slug: string, rawWeek?: unknown): Promise<TeacherPageData | null> {
  const user = await requireUser();
  if (typeof slug !== "string" || slug.length > 60) return null;
  const t = await db.teacher.findUnique({
    where: { slug },
    include: { courses: { include: { course: { select: { id: true, slug: true, title: true, color: true, enrollments: { where: { userId: user.id }, select: { id: true } } } } } } },
  });
  if (!t) return null;

  const enrolled = new Set(
    (await db.enrollment.findMany({ where: { userId: user.id }, select: { courseId: true } })).map((e) => e.courseId),
  );
  const nav = weekNav(rawWeek);
  const monday = nav.monday;
  const [events, cons] = await Promise.all([
    db.scheduleEvent.findMany({
      where: { teacherName: t.short, startsAt: { gte: dayStart(monday), lt: dayStart(addDays(monday, 7)) }, pair: { not: null } },
      include: { course: { select: { id: true, title: true, color: true } } },
      orderBy: { startsAt: "asc" },
    }),
    db.consultation.findFirst({
      where: { teacherName: t.short, startsAt: { gte: DEMO_NOW }, courseId: { in: [...enrolled] } },
      include: { course: { select: { title: true } } },
      orderBy: { startsAt: "asc" },
    }),
  ]);

  const week = buildWeek(events, enrolled, monday);

  const PROFILE: Record<string, { label: string; href: (id: string) => string; value?: (id: string) => string }> = {
    orcid: { label: "ORCID", href: (id) => `https://orcid.org/${id}` },
    scholar: { label: "Google Scholar", href: (id) => `https://scholar.google.com/citations?user=${encodeURIComponent(id)}&hl=ru`, value: () => "Профиль автора" },
    elibrary: { label: "eLibrary, РИНЦ", href: (id) => `https://elibrary.ru/author_profile.asp?id=${id}`, value: (id) => `AuthorID ${id}` },
    scopus: { label: "Scopus", href: (id) => `https://www.scopus.com/authid/detail.uri?authorId=${id}`, value: (id) => `Author ID ${id}` },
    ssrn: { label: "SSRN", href: (id) => `https://papers.ssrn.com/sol3/cf_dev/AbsByAuth.cfm?per_id=${id}`, value: () => "Страница автора" },
    site: { label: "Сайт", href: (id) => `https://${id}`, value: (id) => id },
  };
  const links = list<{ kind: string; id: string; metric?: string }>(t.profiles)
    .filter((p) => PROFILE[p.kind])
    .map((p) => ({
      kind: p.kind,
      label: PROFILE[p.kind].label,
      value: PROFILE[p.kind].value?.(p.id) ?? p.id,
      metric: p.metric ?? null,
      href: PROFILE[p.kind].href(p.id),
    }));
  const items = week.flatMap((d) => d.items);

  return {
    slug: t.slug,
    name: [t.lastName, t.firstName, t.middleName].filter(Boolean).join(" "),
    initials: teacherInitials(t.short),
    gradient: avatarGradientByKey(t.avatar),
    position: t.position,
    department: t.department,
    degree: t.degree,
    email: t.email,
    office: t.office,
    bio: t.bio,
    interests: list<string>(t.interests),
    publications: list<{ title: string; venue: string; year: number }>(t.publications).sort((a, b) => b.year - a.year),
    links,
    load: { pairs: items.length, groups: new Set(items.map((i) => i.group).filter(Boolean)).size },
    mine: t.courses.filter((c) => c.course.enrollments.length).map((c) => ({ slug: c.course.slug, title: c.course.title, color: c.course.color, role: c.role })),
    week,
    nav,
    consultation: cons ? { id: cons.id, when: formatDue(cons.startsAt).label, place: cons.place, course: cons.course.title } : null,
  };
}

/** slug карточки по короткому имени «Петрова Е. А.» — для ссылок из расписания и окон. */
export async function teacherSlugs(): Promise<Record<string, string>> {
  return Object.fromEntries((await db.teacher.findMany({ select: { short: true, slug: true } })).map((t) => [t.short, t.slug]));
}
