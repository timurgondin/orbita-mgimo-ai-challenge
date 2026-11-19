import "server-only";
import { db } from "@/server/db/client";
import { plural } from "@/lib/phrases";
import { getStudent } from "./shared";
import type { RatingData, RatingPeriod } from "./types";

/**
 * Рейтинг студента на курсе (как в ВШЭ): место по среднему баллу экзаменов, взвешенному по кредитам.
 * Однокурсники в прототипе вымышленные и анонимные: их баллы генерируются детерминированно по программе и курсу,
 * наружу уходят только распределение и пороги — ни имён, ни чужих мест. Свой балл — настоящий, из архива.
 */

const fmt2 = (n: number) => n.toFixed(2).replace(".", ",");

function rng(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}
const normal = (r: () => number) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
const clamp = (x: number) => Math.min(10, Math.max(4.2, x));

/** Что даёт место в рейтинге: доля лучших на курсе. */
const PERKS = [
  { title: "Именная стипендия Университета", top: 3, note: "Назначается раз в год по итогам весенней сессии" },
  { title: "Повышенная академическая стипендия", top: 10, note: "Пересчитывается после каждой сессии" },
  { title: "Приоритет в конкурсе на академическую мобильность", top: 25, note: "Рейтинг — половина баллов конкурса" },
  { title: "Запись на элективы в первой волне", top: 30, note: "Остальные выбирают из оставшихся мест" },
] as const;

const BIN = 0.25;
const MIN = 4.5;

export async function getRating(): Promise<RatingData | null> {
  const user = await getStudent();
  if (!user || !user.courseSize) return null;
  const rows = await db.pastCourse.findMany({ where: { userId: user.id }, select: { semester: true, grade: true, credits: true } });
  const semesters = [...new Set(rows.map((r) => r.semester))].sort((a, b) => a - b);
  if (!semesters.length) return { program: user.program ?? "", course: user.course ?? 1, size: user.courseSize, periods: [], perks: [] };

  // Средний по экзаменам с весом кредитов: за семестр и накопленный
  const avg = (list: typeof rows) => {
    const ex = list.filter((r) => r.grade != null);
    const c = ex.reduce((s, r) => s + r.credits, 0);
    return c ? ex.reduce((s, r) => s + r.grade! * r.credits, 0) / c : null;
  };

  // Однокурсники: «способность» + шум семестра; накопленный — среднее семестров
  const others = user.courseSize - 1;
  const r = rng(`${user.program}|${user.admissionYear}|${user.groupName?.replace(/-\d+$/, "")}`);
  const ability = Array.from({ length: others }, () => 7.05 + normal(r) * 0.72);
  const semScores = semesters.map(() => ability.map((a) => clamp(a + normal(r) * 0.38)));

  const periods: RatingPeriod[] = [];
  for (const [k, sem] of semesters.entries()) {
    const mineSem = avg(rows.filter((x) => x.semester === sem));
    const mineCum = avg(rows.filter((x) => x.semester <= sem));
    const cohortSem = semScores[k];
    const cohortCum = ability.map((_, i) => semScores.slice(0, k + 1).reduce((s, arr) => s + arr[i], 0) / (k + 1));
    const year = Math.ceil(sem / 2);
    const title = `${year} курс, ${sem % 2 ? 1 : 2} семестр`;
    for (const [kind, mine, cohort] of [
      ["cumulative", mineCum, cohortCum],
      ["semester", mineSem, cohortSem],
    ] as const) {
      if (mine == null) continue;
      const rank = 1 + cohort.filter((x) => x > mine).length;
      const all = [...cohort, mine].sort((a, b) => b - a);
      const bins = Array.from({ length: Math.round((10 - MIN) / BIN) }, (_, i) => ({ from: MIN + i * BIN, count: 0 }));
      for (const x of all) bins[Math.min(bins.length - 1, Math.max(0, Math.floor((x - MIN) / BIN)))].count++;
      const cut = (top: number) => all[Math.max(0, Math.ceil((all.length * top) / 100) - 1)];
      periods.push({
        kind,
        semester: sem,
        title,
        gpa: fmt2(mine),
        rank,
        top: Math.max(1, Math.ceil((rank / all.length) * 100)),
        median: fmt2(all[Math.floor(all.length / 2)]),
        bins: bins.map((b) => ({ label: `${fmt2(b.from)}–${fmt2(b.from + BIN)}`, from: b.from, count: b.count, mine: mine >= b.from && (mine < b.from + BIN || b.from + BIN >= 10) })),
        cutoffs: PERKS.map((p) => ({ top: p.top, gpa: cut(p.top) })),
        mine,
      });
    }
  }

  const last = periods.filter((p) => p.kind === "cumulative").at(-1)!;
  const perks = PERKS.map((p) => {
    const need = last.cutoffs.find((c) => c.top === p.top)!.gpa;
    const ok = last.top <= p.top;
    const gap = Math.max(0.01, need - last.mine + 0.005);
    return {
      title: p.title,
      top: p.top,
      note: p.note,
      ok,
      status: ok ? `Проходишь: ты в топ-${last.top}%` : `Не хватает ${fmt2(gap)} к среднему`,
    };
  });

  return {
    program: user.program ?? "",
    course: user.course ?? 1,
    size: user.courseSize,
    periods: periods.map((p) => ({ ...p, cutoffs: p.cutoffs.map((c) => ({ ...c, gpa: Math.round(c.gpa * 100) / 100 })) })),
    perks,
  };
}

/** Короткая строка для «Успеваемости»: место и доля. */
export async function getRatingSummary(): Promise<{ rank: number; size: number; top: number; label: string } | null> {
  const d = await getRating();
  const last = d?.periods.filter((p) => p.kind === "cumulative").at(-1);
  if (!d || !last) return null;
  return { rank: last.rank, size: d.size, top: last.top, label: `место из ${d.size}, топ-${last.top}%` };
}

export const studentsLabel = (n: number) => `${n} ${plural(n, "студент", "студента", "студентов")}`;
