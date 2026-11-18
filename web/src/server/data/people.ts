import "server-only";
import { db } from "@/server/db/client";
import { DEMO_DATE, DEMO_NOW, addDays, dayStart, formatLongDate, mskDate, mskTime } from "@/lib/demo-clock";
import { requireUser } from "@/server/auth/session";
import { avatarGradientByKey, formatDue, teacherInitials } from "./shared";
import type { EventKind, TeacherPageData } from "./types";

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
function mondayOf(iso: string): string {
  const dow = new Date(`${iso}T12:00:00+03:00`).getUTCDay();
  return addDays(iso, -((dow + 6) % 7));
}

/**
 * Публичная карточка преподавателя — для любого вошедшего: должность, контакты, публикации, расписание недели.
 * «Ведёт у тебя» и ссылки на консультации — только по курсам, на которые записан текущий студент.
 */
export async function getTeacher(slug: string): Promise<TeacherPageData | null> {
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
  const monday = mondayOf(DEMO_DATE);
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

  // одна пара могла попасть в базу дважды (у разных студентов свой экземпляр курса) — схлопываем по времени и аудитории
  const seen = new Set<string>();
  const week: TeacherPageData["week"] = [];
  for (const e of events) {
    const key = `${e.startsAt.toISOString()}|${e.room}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const date = mskDate(e.startsAt);
    let day = week.find((d) => d.date === date);
    if (!day) week.push((day = { date, label: formatLongDate(date), items: [] }));
    day.items.push({
      id: e.id,
      start: mskTime(e.startsAt),
      end: mskTime(e.endsAt),
      title: e.title ?? KIND[e.kind as EventKind],
      course: e.course?.title ?? "",
      color: e.course?.color ?? "econ",
      room: e.room,
      mine: !!e.course && enrolled.has(e.course.id),
    });
  }

  const links: TeacherPageData["links"] = [];
  if (t.orcid) links.push({ label: "ORCID", value: t.orcid, href: `https://orcid.org/${t.orcid}` });
  if (t.scholar) links.push({ label: "Google Scholar", value: "Профиль и цитирования", href: `https://scholar.google.com/citations?user=${encodeURIComponent(t.scholar)}` });
  if (t.elibrary) links.push({ label: "eLibrary", value: `SPIN-код ${t.elibrary}`, href: null });

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
    mine: t.courses.filter((c) => c.course.enrollments.length).map((c) => ({ slug: c.course.slug, title: c.course.title, color: c.course.color, role: c.role })),
    week,
    consultation: cons ? { id: cons.id, when: formatDue(cons.startsAt).label, place: cons.place, course: cons.course.title } : null,
  };
}

/** slug карточки по короткому имени «Петрова Е. А.» — для ссылок из расписания и окон. */
export async function teacherSlugs(): Promise<Record<string, string>> {
  return Object.fromEntries((await db.teacher.findMany({ select: { short: true, slug: true } })).map((t) => [t.short, t.slug]));
}
