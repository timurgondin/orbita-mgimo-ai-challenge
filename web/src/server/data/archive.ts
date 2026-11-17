import "server-only";
import { db } from "@/server/db/client";
import { avatarGradientByKey, fmt1, fmtWork, getStudent, teacherInitials } from "./shared";
import type { ArchiveData, ArchiveSemester, Assessment } from "./types";

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
      const season = autumn ? `Осень ${admission + year - 1}` : `Весна ${admission + year}`;
      s = { n: r.semester, year, title: `${year} курс, ${season.toLowerCase()}`, season, average: null, credits: 0, courses: [] };
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
