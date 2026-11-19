import "server-only";
import { db } from "@/server/db/client";
import { avatarGradientByKey, fmt1, fmtWork, getStudent, teacherInitials } from "./shared";
import { plural } from "@/lib/phrases";
import type { ArchiveData, ArchiveSemester, Assessment, PastContent, PastCoursePage } from "./types";

/** Кредитов за всю программу бакалавриата. */
const PROGRAM_CREDITS = 240;

/** Слово к оценке по 10-балльной шкале. */
export function gradeWord(grade: number): string {
  return grade >= 8 ? "отлично" : grade >= 6 ? "хорошо" : grade >= 4 ? "удовлетворительно" : "неудовлетворительно";
}

const fmtLongDate = (d: Date) =>
  d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Moscow" }).replace(/\s?г\.$/, "");

/** Средний балл по экзаменам, взвешенный по кредитам; зачёты не входят. */
function weightedAverage(list: { grade: number | null; credits: number }[]): string | null {
  const exams = list.filter((c) => c.grade != null);
  const credits = exams.reduce((s, c) => s + c.credits, 0);
  return credits ? fmt1(Math.round((exams.reduce((s, c) => s + c.grade! * c.credits, 0) / credits) * 10) / 10) : null;
}

/** Архив текущего студента: только его сданные дисциплины (пользователь — из сессии). */
export async function getArchive(): Promise<ArchiveData | null> {
  const user = await getStudent();
  if (!user) return null;

  const rows = await db.pastCourse.findMany({
    where: { userId: user.id },
    orderBy: [{ semester: "desc" }, { order: "asc" }],
    include: { components: { orderBy: { order: "asc" } } },
  });

  const admission = user.admissionYear ?? new Date().getFullYear();
  const semesters: ArchiveSemester[] = [];
  for (const r of rows) {
    let s = semesters.at(-1);
    if (s?.n !== r.semester) {
      const autumn = r.semester % 2 === 1;
      const year = Math.ceil(r.semester / 2);
      const season = autumn ? `осень ${admission + year - 1}` : `весна ${admission + year}`;
      const short = `${autumn ? 1 : 2} семестр`;
      s = { n: r.semester, year, title: `${year} курс, ${short}`, short, season, average: null, credits: 0, courses: [] };
      semesters.push(s);
    }
    const total = r.components.reduce((sum, c) => sum + c.score * c.weight, 0) / 100;
    s.credits += r.passed ? r.credits : 0;
    s.courses.push({
      id: r.id,
      title: r.title,
      color: r.color,
      assessment: r.assessment as Assessment,
      credits: r.credits,
      grade: r.grade != null ? String(r.grade) : r.passed ? "Зачёт" : "Незачёт",
      gradeWord: r.grade != null ? gradeWord(r.grade) : "",
      passed: r.passed,
      teacher: r.teacherName,
      teacherInitials: teacherInitials(r.teacherName),
      teacherGradient: avatarGradientByKey(r.teacherAvatar),
      closedAt: fmtLongDate(r.closedAt),
      total: fmt1(Math.round(total * 10) / 10),
      components: r.components.map((c) => ({ title: c.title, weight: c.weight, score: fmtWork(c.score) })),
    });
  }
  for (const s of semesters) {
    s.average = weightedAverage(rows.filter((r) => r.semester === s.n));
  }

  return {
    average: weightedAverage(rows),
    credits: semesters.reduce((sum, s) => sum + s.credits, 0),
    creditsPlan: PROGRAM_CREDITS,
    passed: rows.filter((r) => r.passed).length,
    semesters,
  };
}

const semesterTitle = (n: number) => `${Math.ceil(n / 2)} курс, ${n % 2 ? 1 : 2} семестр`;

/** Пройденный курс текущего студента; чужой или несуществующий — null (→ 404). */
export async function getPastCourse(id: string): Promise<PastCoursePage | null> {
  const user = await getStudent();
  if (!user || typeof id !== "string" || id.length > 40) return null;
  const r = await db.pastCourse.findFirst({ where: { id, userId: user.id }, include: { components: { orderBy: { order: "asc" } } } });
  if (!r) return null;
  const [same, teacher, siblings] = await Promise.all([
    db.pastCourse.findMany({ where: { userId: user.id, semester: r.semester }, orderBy: { order: "asc" }, select: { id: true, title: true, color: true } }),
    db.teacher.findUnique({ where: { short: r.teacherName }, select: { slug: true } }),
    r.discipline
      ? db.pastCourse.findMany({ where: { userId: user.id, discipline: r.discipline }, orderBy: { semester: "asc" }, select: { semester: true } })
      : Promise.resolve([]),
  ]);
  const admission = user.admissionYear ?? new Date().getFullYear();
  const year = Math.ceil(r.semester / 2);
  const total = r.components.reduce((sum, c) => sum + c.score * c.weight, 0) / 100;
  const grade = r.grade != null ? String(r.grade) : r.passed ? "Зачёт" : "Незачёт";
  const word = r.grade != null ? gradeWord(r.grade) : r.passed ? "зачтено" : "не зачтено";
  const planned = r.discipline ? await db.plannedCourse.count({ where: { userId: user.id, discipline: r.discipline } }) : 0;
  const current = r.discipline ? await db.enrollment.count({ where: { userId: user.id, course: { discipline: r.discipline } } }) : 0;
  const multi = r.discipline && siblings.length + planned + current > 1;
  return {
    id: r.id,
    title: r.title,
    color: r.color,
    semester: semesterTitle(r.semester),
    season: r.semester % 2 ? `осень ${admission + year - 1}` : `весна ${admission + year}`,
    year,
    assessment: r.assessment as Assessment,
    credits: r.credits,
    grade,
    gradeWord: word,
    passed: r.passed,
    total: fmt1(Math.round(total * 10) / 10),
    closedAt: fmtLongDate(r.closedAt),
    teacher: r.teacherName,
    teacherInitials: teacherInitials(r.teacherName),
    teacherGradient: avatarGradientByKey(r.teacherAvatar),
    teacherSlug: teacher?.slug ?? null,
    components: r.components.map((c) => ({ title: c.title, weight: c.weight, score: fmtWork(c.score) })),
    diploma: multi
      ? {
          title: r.discipline!,
          note: `Дисциплина идёт ${siblings.length + current + planned} ${plural(siblings.length + current + planned, "семестр", "семестра", "семестров")}: в диплом — итог по всем, эта оценка — его часть`,
        }
      : { title: r.title, note: `В диплом идёт эта оценка: ${grade === "Зачёт" ? "зачтено" : `${grade}, ${word}`}` },
    nav: same,
    semesterN: r.semester,
    ...pastContentView(r.content),
  };
}

const sizeLabel = (b?: number) => (b == null ? null : b >= 1_000_000 ? `${fmt1(Math.round(b / 100_000) / 10)} МБ` : `${Math.max(1, Math.round(b / 1000))} КБ`);
const fmtDay = (iso: string) => new Date(`${iso}T12:00:00+03:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: "Europe/Moscow" });

/** Разбор JSON-наполнения курса; битое или пустое — пустые разделы, страница не падает. */
function pastContentView(raw: string | null) {
  let c: Partial<PastContent> = {};
  try {
    c = raw ? (JSON.parse(raw) as PastContent) : {};
  } catch {}
  return {
    annotation: c.annotation ?? null,
    topics: c.topics ?? [],
    materials: (c.materials ?? []).map((m, n) => ({ n, title: m.title, kind: m.kind, meta: m.meta, size: sizeLabel(m.size), group: m.group, download: m.kind !== "video" })),
    works: (c.works ?? []).map((w) => ({ title: w.title, kind: w.kind, score: w.score != null ? fmtWork(w.score) : null, date: fmtDay(w.date), feedback: w.feedback ?? null, file: w.file ?? null })),
    exam: c.exam ? { title: c.exam.title, questions: c.exam.questions, note: c.exam.note } : null,
    review: c.review ?? null,
  };
}

/** Материал своего пройденного курса для PDF: курс, преподаватель, семестр и пункты плана. Чужой — null. */
export async function getPastMaterial(id: string, n: number) {
  const user = await getStudent();
  if (!user || typeof id !== "string" || id.length > 40 || !Number.isInteger(n) || n < 0 || n > 200) return null;
  const r = await db.pastCourse.findFirst({ where: { id, userId: user.id } });
  if (!r?.content) return null;
  let c: PastContent;
  try {
    c = JSON.parse(r.content) as PastContent;
  } catch {
    return null;
  }
  const m = c.materials?.[n];
  if (!m || m.kind === "video") return null;
  return { course: r.title, teacher: r.teacherName, semester: semesterTitle(r.semester), material: m };
}
