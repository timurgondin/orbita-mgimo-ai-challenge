import Link from "next/link";
import { Archive, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { creditsLabel, plural } from "@/lib/phrases";
import { cn } from "@/lib/utils";
import type { ArchiveCourse, ArchiveSemester } from "@/server/data/types";

const BTN =
  "inline-flex h-10 items-center gap-2 rounded-xl bg-s1 px-4 text-sm font-medium transition-[background,transform] duration-150 hover:bg-s2 active:scale-[.97]";

/** Карточка сданной дисциплины: та же обложка цвета курса, что у текущих, вместо прогресса — итог. */
function PastCard({ c }: { c: ArchiveCourse }) {
  return (
    <Link
      href={`/study/past/${c.id}`}
      data-archive-course={c.id}
      style={{ "--cc": `var(--c-${c.color})` } as React.CSSProperties}
      className="course-card flex flex-col overflow-hidden rounded-3xl bg-s1 transition-colors duration-200 hover:bg-s2"
    >
      <div className="course-cover">
        <span className="absolute top-4 left-5 text-xs font-medium text-[color-mix(in_srgb,var(--cc)_60%,var(--text))]">
          {c.assessment === "exam" ? "Экзамен" : "Зачёт"}, {creditsLabel(c.credits)}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-0.5 px-5 pt-4 pb-5">
        <div className="text-[17px] font-semibold tracking-[-.02em]">{c.title}</div>
        <div className="text-sm text-text-3">{c.teacher}</div>
        <div className="mt-auto flex items-baseline gap-2 pt-[18px]">
          {c.assessment === "exam" ? (
            <>
              <b className="text-2xl leading-none font-medium tracking-[-.02em] tabular-nums">{c.grade}</b>
              <small className="text-[13px] text-text-3">{c.gradeWord}</small>
            </>
          ) : (
            <b className={cn("inline-flex items-center gap-1.5 text-xl leading-none font-medium", !c.passed && "text-urgent")}>
              {c.passed && <Check size={18} strokeWidth={1.8} className="text-(--cc)" />}
              {c.grade}
            </b>
          )}
        </div>
      </div>
    </Link>
  );
}

export function SemesterView({ s, all }: { s: ArchiveSemester; all: { n: number; title: string }[] }) {
  const i = all.findIndex((x) => x.n === s.n);
  const prev = all[i - 1];
  const next = all[i + 1];
  const exams = s.courses.filter((c) => c.assessment === "exam").length;
  const stats = [
    s.average && { value: s.average, label: "средний балл" },
    { value: String(s.credits), label: plural(s.credits, "кредит", "кредита", "кредитов") },
    { value: String(exams), label: `${plural(exams, "экзамен", "экзамена", "экзаменов")}, ${s.courses.length - exams} ${plural(s.courses.length - exams, "зачёт", "зачёта", "зачётов")}` },
  ].filter((x) => !!x);

  return (
    <>
      <Link href="/study" className="-ml-1 inline-flex items-center gap-0.5 rounded-lg pr-1.5 text-[15px] text-text-2 transition-colors duration-150 hover:text-text">
        <ChevronLeft size={17} strokeWidth={1.6} />
        Учёба
      </Link>
      <h1 className="mt-1 text-[34px] leading-[1.15] font-medium tracking-[-.03em] max-sm:text-[28px]">{s.title}</h1>
      <div className="mt-1 text-[15px] text-text-2">{s.season.charAt(0).toUpperCase() + s.season.slice(1)}</div>

      <section aria-label="Итоги семестра" className="mt-9 flex flex-wrap gap-x-14 gap-y-6 max-sm:gap-x-8">
        {stats.map((x) => (
          <div key={x.label}>
            <b className="block text-[40px] leading-none font-medium tracking-[-.035em] max-sm:text-[32px]">{x.value}</b>
            <span className="text-sm text-text-3">{x.label}</span>
          </div>
        ))}
      </section>

      <section aria-label="Дисциплины" className="mt-12 grid grid-cols-3 gap-4 max-[1000px]:grid-cols-2 max-[640px]:grid-cols-1">
        {s.courses.map((c) => (
          <PastCard key={c.id} c={c} />
        ))}
      </section>

      <nav aria-label="Другие семестры" className="mt-12 flex flex-wrap items-center gap-2">
        {prev && (
          <Link href={`/study/semester/${prev.n}`} className={BTN}>
            <ChevronLeft size={16} strokeWidth={1.7} />
            {prev.title}
          </Link>
        )}
        {next && (
          <Link href={`/study/semester/${next.n}`} className={BTN}>
            {next.title}
            <ChevronRight size={16} strokeWidth={1.7} />
          </Link>
        )}
        <Link href={`/study/archive?year=${s.year}`} className={cn(BTN, "ml-auto max-sm:ml-0")}>
          <Archive size={16} strokeWidth={1.7} />
          Весь архив
        </Link>
      </nav>
    </>
  );
}
