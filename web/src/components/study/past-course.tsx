import Link from "next/link";
import { ChevronLeft, ChevronRight, GraduationCap } from "lucide-react";
import { creditsLabel } from "@/lib/phrases";
import { cn } from "@/lib/utils";
import type { PastCoursePage } from "@/server/data/types";

const H2 = "mb-2 text-lg font-semibold tracking-[-.02em]";

/** Пройденный курс: итог, из чего сложился, что ушло в диплом. Слева — другие дисциплины того же семестра. */
export function PastCourseView({ c }: { c: PastCoursePage }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-12 min-[1000px]:grid-cols-[220px_minmax(0,1fr)]" style={{ "--cc": `var(--c-${c.color})` } as React.CSSProperties}>
      <aside aria-label={c.semester} className="sticky top-[92px] self-start max-[1000px]:hidden">
        <Link href={`/study/archive?year=${c.year}`} className="-ml-1 inline-flex items-center gap-0.5 text-[15px] text-text-2 transition-colors duration-150 hover:text-text">
          <ChevronLeft size={17} strokeWidth={1.6} />
          Архив
        </Link>
        <div className="mt-4 mb-1 px-3 text-[13px] text-text-3">{c.semester}</div>
        <nav className="flex flex-col gap-0.5">
          {c.nav.map((n) => (
            <Link
              key={n.id}
              href={`/study/past/${n.id}`}
              aria-current={n.id === c.id ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-2 text-[14.5px] transition-colors duration-150",
                n.id === c.id ? "bg-s1 font-medium text-text" : "text-text-2 hover:bg-hover hover:text-text",
              )}
            >
              <i className="size-2 shrink-0 rounded-full" style={{ background: `var(--c-${n.color})` }} />
              <span className="truncate">{n.title}</span>
            </Link>
          ))}
        </nav>
      </aside>

      <div className="min-w-0">
        <Link href={`/study/archive?year=${c.year}`} className="-ml-1 mb-4 inline-flex items-center gap-0.5 text-[15px] text-text-2 hover:text-text min-[1000px]:hidden">
          <ChevronLeft size={17} strokeWidth={1.6} />
          Архив
        </Link>
        <div className="course-cover h-[132px] rounded-[26px] max-sm:h-[104px] max-sm:rounded-[22px]" />
        <h1 className="mt-6 text-[34px] leading-[1.15] font-medium tracking-[-.03em] [text-wrap:balance] max-sm:text-[28px]">{c.title}</h1>
        <div className="mt-1.5 text-[15px] text-text-2">
          {c.semester}, {c.season}
        </div>

        <section aria-label="Итог" className="mt-9 flex flex-wrap gap-x-14 gap-y-6 max-sm:gap-x-8">
          <div>
            <b className={cn("block text-[40px] leading-none font-medium tracking-[-.035em]", !c.passed && "text-urgent")}>
              {c.grade}
              {c.assessment === "exam" && <small className="text-xl text-text-3"> из 10</small>}
            </b>
            <span className="text-sm text-text-3">{c.gradeWord}</span>
          </div>
          <div>
            <b className="block text-[40px] leading-none font-medium tracking-[-.035em]">{c.credits}</b>
            <span className="text-sm text-text-3">{creditsLabel(c.credits).replace(/^\d+\s/, "")}</span>
          </div>
          <div>
            <b className="block text-[22px] leading-[40px] font-medium tracking-[-.02em]">{c.closedAt}</b>
            <span className="text-sm text-text-3">{c.assessment === "exam" ? "экзамен" : "зачёт"}</span>
          </div>
        </section>

        <section aria-label="В диплом" data-diploma-note className="mt-9 flex items-start gap-3.5 rounded-3xl bg-s1 px-5 py-4">
          <GraduationCap size={20} strokeWidth={1.6} className="mt-0.5 shrink-0 text-text-2" />
          <span className="min-w-0 flex-1">
            <b className="block text-[17px] font-semibold tracking-[-.01em]">{c.diploma.title}</b>
            <span className="mt-0.5 block text-sm text-text-2">{c.diploma.note}</span>
          </span>
          <Link href="/study/diploma" className="shrink-0 self-center text-sm text-text-2 hover:text-text">
            Диплом ›
          </Link>
        </section>

        <div className="mt-12 grid grid-cols-[minmax(0,1fr)] gap-12 min-[1100px]:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <section aria-labelledby="formula">
            <h2 id="formula" className={H2}>
              Как сложилась оценка
            </h2>
            <div className="rows [--row-inset:14px]">
              {c.components.map((k) => (
                <div key={k.title} className="-mx-3.5 grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-x-3 rounded-2xl px-3.5 py-3">
                  <span className="text-[15px] text-text-3 tabular-nums">{k.weight}%</span>
                  <span className="truncate font-medium">{k.title}</span>
                  <b className="text-lg font-semibold tracking-[-.02em] tabular-nums">{k.score}</b>
                </div>
              ))}
            </div>
            <p className="mt-2 text-sm text-text-3">
              Сумма с весами <b className="font-medium text-text-2">{c.total}</b>
              {c.assessment === "exam" ? (
                <>
                  , в ведомость — <b className="font-medium text-text-2">{c.grade}</b>
                </>
              ) : (
                ", зачёт — от 4"
              )}
            </p>
          </section>

          <section aria-labelledby="teacher">
            <h2 id="teacher" className={H2}>
              Преподаватель
            </h2>
            {(() => {
              const inner = (
                <>
                  <span className="mono grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold" style={{ background: c.teacherGradient }}>
                    {c.teacherInitials}
                  </span>
                  <b className="min-w-0 flex-1 truncate font-medium">{c.teacher}</b>
                  {c.teacherSlug && <ChevronRight size={16} strokeWidth={1.6} className="text-text-3" />}
                </>
              );
              const cls = "-mx-3.5 flex items-center gap-3.5 rounded-2xl px-3.5 py-3";
              return c.teacherSlug ? (
                <Link href={`/people/${c.teacherSlug}`} className={cn(cls, "transition-colors duration-150 hover:bg-hover")}>
                  {inner}
                </Link>
              ) : (
                <div className={cls}>{inner}</div>
              );
            })()}
          </section>
        </div>
      </div>
    </div>
  );
}
