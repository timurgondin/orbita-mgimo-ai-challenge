import Link from "next/link";
import { Archive, ChevronRight } from "lucide-react";
import type { ArchiveSemester, CourseCardData } from "@/server/data/types";
import { ProgressBar } from "@/components/ui/progress";

const SEG = {
  done: "bg-(--cc)",
  pending: "bg-[color-mix(in_srgb,var(--cc)_40%,var(--s3))]",
  empty: "bg-s3",
};

function Card({ c }: { c: CourseCardData }) {
  return (
    <Link
      href={`/study/${c.slug}`}
      data-course={c.slug}
      style={{ "--cc": `var(--c-${c.color})` } as React.CSSProperties}
      className="course-card flex flex-col overflow-hidden rounded-3xl bg-s1 transition-colors duration-200 hover:bg-s2"
    >
      <div className="course-cover">
        <span className="absolute top-4 left-5 text-xs font-medium text-[color-mix(in_srgb,var(--cc)_60%,var(--text))]">
          {c.kindLabel}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-0.5 px-5 pt-4 pb-5">
        <div className="text-[17px] font-semibold tracking-[-.02em]">{c.title}</div>
        <div className="text-sm text-text-3">{c.teacher}</div>
        <div className="mt-auto pt-[18px] text-2xl leading-none font-medium tracking-[-.02em]">
          {c.score}
          {c.scoreSuffix && <small className="ml-[3px] text-[13px] font-normal text-text-3">{c.scoreSuffix}</small>}
        </div>
        {c.progress != null ? (
          <ProgressBar value={c.progress} label="Курс пройден" fill="var(--cc)" className="mt-3 h-1" />
        ) : (
          <div className="mt-3 flex h-1 gap-[3px]" aria-hidden="true">
            {c.formula.map((s, i) => (
              <i key={i} className={`block rounded-sm ${SEG[s.state]}`} style={{ flex: s.weight }} />
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

const GRID = "grid grid-cols-3 gap-4 max-[1000px]:grid-cols-2 max-[640px]:grid-cols-1";

export function CoursesView({ courses, online, past = [] }: { courses: CourseCardData[]; online: CourseCardData[]; past?: ArchiveSemester[] }) {
  return (
    <>
      <section aria-label="Курсы">
        <div className={GRID}>
          {courses.map((c) => (
            <Card key={c.id} c={c} />
          ))}
        </div>
      </section>
      {online.length > 0 && (
        <section className="mt-12" aria-label="Онлайн-курсы">
          <h2 className="mb-3.5 text-lg font-semibold tracking-[-.02em]">Онлайн-курсы</h2>
          <div className={GRID}>
            {online.map((c) => (
              <Card key={c.id} c={c} />
            ))}
          </div>
        </section>
      )}
      {past.length > 0 && (
        <section className="mt-12" aria-label="Пройденные курсы">
          <h2 className="mb-3.5 text-lg font-semibold tracking-[-.02em]">Пройденные курсы</h2>
          <div className="grid grid-cols-3 gap-4 max-[1000px]:grid-cols-2 max-[640px]:grid-cols-1">
            {past.map((s) => (
              <Link
                key={s.n}
                href={`/study/semester/${s.n}`}
                data-past-semester-card={s.n}
                className="rounded-3xl bg-s1 px-5 py-4 transition-colors duration-200 hover:bg-s2"
              >
                <b className="block text-[15px] font-semibold">{s.title}</b>
                <small className="text-[13px] text-text-3">
                  {s.season}, средний {s.average ?? "—"}
                </small>
                <span className="mt-3 flex flex-wrap gap-1.5" aria-hidden="true">
                  {s.courses.map((c) => (
                    <i key={c.id} title={c.title} className="size-2 rounded-full" style={{ background: `var(--c-${c.color})` }} />
                  ))}
                </span>
              </Link>
            ))}
          </div>
          <Link
            href="/study/archive"
            data-archive-link
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-s1 px-4 text-sm font-medium transition-[background,transform] duration-150 hover:bg-s2 active:scale-[.97]"
          >
            <Archive size={16} strokeWidth={1.7} />
            Весь архив
            <ChevronRight size={15} strokeWidth={1.7} className="text-text-3" />
          </Link>
        </section>
      )}
    </>
  );
}
