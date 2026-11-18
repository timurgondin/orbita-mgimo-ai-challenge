"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, ChevronLeft, FileText, GraduationCap } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { creditsLabel } from "@/lib/phrases";
import { cn } from "@/lib/utils";
import type { ArchiveCourse, ArchiveData, ArchiveSemester } from "@/server/data/types";

const kindLabel = (c: ArchiveCourse) => (c.assessment === "exam" ? "Экзамен" : "Зачёт");

/** Сданная дисциплина: открывается своей страницей, как текущий курс. */
function CourseRow({ c }: { c: ArchiveCourse }) {
  return (
    <Link
      href={`/study/past/${c.id}`}
      data-archive-course={c.id}
      style={{ "--cc": `var(--c-${c.color})` } as React.CSSProperties}
      className="-mx-3.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-[14px] px-3.5 py-3 transition-colors duration-150 hover:bg-hover"
    >
      <span className="min-w-0">
        <span className="flex items-center gap-2.5 font-medium">
          <i className="size-2 shrink-0 rounded-full bg-(--cc)" />
          <span className="truncate">{c.title}</span>
        </span>
        <span className="mt-px ml-[18px] block text-[13px] text-text-3">
          {kindLabel(c)}, {creditsLabel(c.credits)}
        </span>
      </span>
      <span className="text-right">
        {c.assessment === "exam" ? (
          <>
            <b className="block text-lg leading-tight font-semibold tracking-[-.02em] tabular-nums">{c.grade}</b>
            <small className="block text-[13px] text-text-3">{c.gradeWord}</small>
          </>
        ) : (
          <span className={cn("inline-flex items-center gap-1.5 text-[15px] font-medium", c.passed ? "text-text-2" : "text-urgent")}>
            {c.passed && <Check size={15} strokeWidth={1.8} />}
            {c.grade}
          </span>
        )}
      </span>
    </Link>
  );
}

function Semester({ s, heading }: { s: ArchiveSemester; heading: string }) {
  return (
    <section aria-labelledby={`sem-${s.n}`} data-semester={s.n}>
      <div className="mb-1.5 flex items-baseline justify-between gap-4">
        <h2 id={`sem-${s.n}`} className="flex items-baseline gap-2.5 text-lg font-semibold tracking-[-.02em]">
          {heading}
          <span className="text-sm font-normal text-text-3">{s.season}</span>
        </h2>
        {s.average && (
          <span className="text-sm whitespace-nowrap text-text-3">
            средний <b className="font-semibold text-text tabular-nums">{s.average}</b>
          </span>
        )}
      </div>
      <div className="rows [--row-inset:14px]">
        {s.courses.map((c) => (
          <CourseRow key={c.id} c={c} />
        ))}
      </div>
    </section>
  );
}

const BTN = "inline-flex h-10 items-center gap-2 rounded-xl bg-s1 px-4 text-sm font-medium transition-[background,transform] duration-150 hover:bg-s2 active:scale-[.97]";

/** Архив курсов: сданные дисциплины по семестрам, курс обучения — в адресе (?year=1). */
export function ArchiveView({ data }: { data: ArchiveData }) {
  const years = [...new Set(data.semesters.map((s) => s.year))].sort((a, b) => a - b);
  const param = Number(useSearchParams().get("year"));
  const year = years.includes(param) ? param : years.at(-1);
  const shown = data.semesters.filter((s) => s.year === year).sort((a, b) => a.n - b.n);

  const stats = [
    data.average && { value: data.average, label: "средний балл за всё время" },
    { value: String(data.credits), suffix: ` / ${data.creditsPlan}`, label: "кредитов набрано" },
    { value: String(data.passed), label: "дисциплин сдано" },
  ].filter((s) => !!s);

  return (
    <>
      <div className="flex items-end justify-between gap-6 max-sm:flex-col max-sm:items-stretch max-sm:gap-5">
        <div>
          <Link
            href="/study?tab=perf"
            className="-ml-1 inline-flex items-center gap-0.5 rounded-lg pr-1.5 text-[15px] text-text-2 transition-colors duration-150 hover:text-text"
          >
            <ChevronLeft size={17} strokeWidth={1.6} />
            Учёба
          </Link>
          <h1 className="mt-1 text-[34px] leading-[1.15] font-medium tracking-[-.03em] max-sm:text-[28px]">Архив курсов</h1>
        </div>
        {years.length > 1 && year != null && (
          <Segmented
            label="Курс обучения"
            value={String(year)}
            onChange={(y) => window.history.pushState(null, "", `/study/archive?year=${y}`)}
            items={years.map((y) => ({ id: String(y), label: `${y} курс` }))}
          />
        )}
      </div>

      {data.semesters.length === 0 ? (
        <p className="mt-9 text-[15px] text-text-3">Здесь появятся курсы после первой сессии</p>
      ) : (
        <>
          <section aria-label="Итоги" className="mt-9 flex flex-wrap items-end justify-between gap-x-14 gap-y-6">
            <div className="flex flex-wrap gap-x-14 gap-y-6 max-sm:gap-x-8">
              {stats.map((s) => (
                <div key={s.label}>
                  <b className="block text-[40px] leading-none font-medium tracking-[-.035em] max-sm:text-[32px]">
                    {s.value}
                    {"suffix" in s && <small className="text-xl text-text-3">{s.suffix}</small>}
                  </b>
                  <span className="text-sm text-text-3">{s.label}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/study/diploma" className={BTN}>
                <GraduationCap size={16} strokeWidth={1.7} />
                Что идёт в диплом
              </Link>
              <Link href="/office?new=grades" className={BTN}>
                <FileText size={16} strokeWidth={1.7} />
                Выписка оценок
              </Link>
            </div>
          </section>

          <div
            key={year}
            className="view-in mt-12 grid grid-cols-[minmax(0,1fr)] gap-12 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] min-[900px]:gap-14"
          >
            {shown.map((s) => (
              <Semester key={s.n} s={s} heading={years.length > 1 ? s.short : s.title} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
