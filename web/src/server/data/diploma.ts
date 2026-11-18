import "server-only";
import { db } from "@/server/db/client";
import { plural } from "@/lib/phrases";
import { gradeWord } from "./archive";
import { fmt1, getStudent } from "./shared";
import { getStudyData } from "./study";
import type { Assessment, DiplomaData, DiplomaRow } from "./types";

/** «3 семестр», «1 и 2 семестры», «3–6 семестры» */
function semestersLabel(list: number[]): string {
  const s = [...new Set(list)].sort((a, b) => a - b);
  if (s.length === 1) return `${s[0]} семестр`;
  const contiguous = s.every((v, i) => !i || v === s[i - 1] + 1);
  return contiguous && s.length > 2 ? `${s[0]}–${s.at(-1)} семестры` : `${s.slice(0, -1).join(", ")} и ${s.at(-1)} семестры`;
}

/** Номер текущего семестра на демо-дату: осень второго курса — 3. */
const currentSemester = (admission: number | null) => (admission ? (2026 - admission) * 2 + 1 : 1);

/**
 * Что уже в приложении к диплому, что закончится в эту сессию, что идёт несколько семестров и что впереди по плану.
 * Строка диплома — дисциплина: у многосеместровой (английский, математика) итог — среднее оценок за семестры.
 * Только данные текущего студента.
 */
export async function getDiploma(): Promise<DiplomaData | null> {
  const user = await getStudent();
  if (!user) return null;
  const [past, planned, enrollments, study] = await Promise.all([
    db.pastCourse.findMany({ where: { userId: user.id }, orderBy: [{ semester: "asc" }, { order: "asc" }] }),
    db.plannedCourse.findMany({ where: { userId: user.id }, orderBy: [{ semester: "asc" }, { order: "asc" }] }),
    db.enrollment.findMany({
      where: { userId: user.id, course: { format: "offline" } },
      orderBy: { order: "asc" },
      select: { course: { select: { slug: true, title: true, color: true, credits: true, assessment: true, discipline: true } } },
    }),
    getStudyData(),
  ]);
  const now = currentSemester(user.admissionYear);
  const key = (x: { discipline: string | null; title: string }) => x.discipline ?? x.title;

  const groups = new Map<string, { past: typeof past; current: (typeof enrollments)[number]["course"][]; planned: typeof planned }>();
  const group = (k: string) => groups.get(k) ?? groups.set(k, { past: [], current: [], planned: [] }).get(k)!;
  for (const p of past) group(key(p)).past.push(p);
  for (const { course } of enrollments) group(key(course)).current.push(course);
  for (const p of planned) group(key(p)).planned.push(p);

  const done: DiplomaRow[] = [];
  const closing: DiplomaRow[] = [];
  const ongoing: DiplomaData["ongoing"] = [];

  for (const [title, g] of groups) {
    const graded = g.past.filter((p) => p.grade != null);
    const credits = [...g.past, ...g.current, ...g.planned].reduce((s, x) => s + x.credits, 0);
    const gr = graded.map((p) => String(p.grade));
    const pastGrades = gr.length > 1 ? `${gr.slice(0, -1).join(", ")} и ${gr.at(-1)}` : gr.join("");

    if (g.past.length && !g.current.length && !g.planned.length) {
      // дисциплина закончилась — оценка уже в дипломе
      const avg = graded.length ? Math.round(graded.reduce((s, p) => s + p.grade!, 0) / graded.length) : null;
      done.push({
        title,
        credits,
        grade: avg != null ? String(avg) : "Зачёт",
        word: avg != null ? gradeWord(avg) : "зачтено",
        when: semestersLabel(g.past.map((p) => p.semester)),
        parts: g.past.length > 1 ? pastGrades : undefined,
        href: g.past.length === 1 ? `/study/past/${g.past[0].id}` : undefined,
        color: g.past[0].color,
      });
    } else if (g.current.length && !g.past.length && !g.planned.length) {
      // закончится в эту сессию: показываем прогноз
      const c = g.current[0];
      const row = study?.perf.rows.find((r) => r.slug === c.slug);
      const exam = c.assessment === "exam";
      closing.push({
        title,
        credits,
        grade: exam ? (row?.forecast || "—") : "Зачёт",
        word: exam ? (row?.forecast ? `прогноз, ${gradeWord(Number(row.forecast))}` : "оценок пока нет") : "идёт",
        when: `${now} семестр`,
        href: `/study/${c.slug}`,
        color: c.color,
      });
    } else if (g.current.length || (g.past.length && g.planned.length)) {
      // многосеместровая: часть позади
      const total = g.past.length + g.current.length + g.planned.length;
      const c = g.current[0];
      ongoing.push({
        title,
        credits,
        grade: graded.length ? String(Math.round(graded.reduce((s, p) => s + p.grade!, 0) / graded.length)) : "—",
        word: graded.length ? "по прошлым семестрам" : "",
        when: semestersLabel([...g.past.map((p) => p.semester), ...(c ? [now] : []), ...g.planned.map((p) => p.semester)]),
        parts: pastGrades || undefined,
        progress: `позади ${g.past.length} из ${total}`,
        href: c ? `/study/${c.slug}` : undefined,
        color: c?.color ?? g.past[0]?.color,
      });
    }
  }

  // впереди: по семестрам; многосеместровые тоже видны в своём семестре
  const plannedBySem = new Map<number, DiplomaData["planned"][number]>();
  for (const p of planned) {
    const s = plannedBySem.get(p.semester) ?? plannedBySem.set(p.semester, { semester: p.semester, label: `${Math.ceil(p.semester / 2)} курс, ${p.semester % 2 ? 1 : 2} семестр`, items: [] }).get(p.semester)!;
    s.items.push({ title: p.title, credits: p.credits, assessment: p.assessment as Assessment });
  }

  const gradedDone = done.filter((d) => /^\d+$/.test(d.grade));
  const creditsDone = gradedDone.reduce((s, d) => s + d.credits, 0);
  const average = creditsDone ? fmt1(Math.round((gradedDone.reduce((s, d) => s + Number(d.grade) * d.credits, 0) / creditsDone) * 10) / 10) : null;
  const excellent = gradedDone.filter((d) => Number(d.grade) >= 8).length;
  const share = gradedDone.length ? Math.round((excellent / gradedDone.length) * 100) : null;
  const satisfactory = gradedDone.filter((d) => Number(d.grade) < 6).length;

  return {
    done,
    closing,
    ongoing,
    planned: [...plannedBySem.values()],
    stats: { inDiploma: done.length, total: groups.size, average, excellentShare: share },
    honors:
      share == null
        ? null
        : share >= 75 && !satisfactory
          ? { ok: true, text: `Пока выходит: «отлично» — ${share}% оценок, «удовлетворительно» нет. Нужно не меньше 75% «отлично» и отличная защита ВКР.` }
          : {
              ok: false,
              text: satisfactory
                ? "Пока не выходит: есть «удовлетворительно». Её можно пересдать на повышение — заявление в «Офисе»."
                : `Пока не выходит: «отлично» — ${share}% оценок, нужно не меньше 75%. Впереди ещё ${planned.length} ${plural(planned.length, "дисциплина", "дисциплины", "дисциплин")}.`,
            },
  };
}
