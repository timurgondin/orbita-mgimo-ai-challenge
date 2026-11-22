"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Segmented } from "@/components/ui/segmented";
import { ProgressBar } from "@/components/ui/progress";
import { plural } from "@/lib/phrases";
import type { TeachCourseCard } from "@/server/data/teach-types";
import { H1 } from "./ui";

const TABS = [
  { id: "courses", label: "Курсы" },
  { id: "review", label: "Проверка" },
  { id: "journal", label: "Журнал" },
] as const;
type Tab = (typeof TABS)[number]["id"];
const isTab = (v: string | null): v is Tab => TABS.some((t) => t.id === v);

/** «Курсы» преподавателя: вкладки в адресе (?tab=review, ?tab=journal), переключение на клиенте. */
export function TeachStudy({ views, toReview }: { views: Record<Tab, React.ReactNode>; toReview: number }) {
  const p = useSearchParams().get("tab");
  const tab: Tab = isTab(p) ? p : "courses";
  return (
    <>
      <div className="flex items-end justify-between gap-6 max-sm:flex-col max-sm:items-stretch max-sm:gap-5">
        <h1 className={H1}>Курсы</h1>
        <Segmented
          variant="tabs"
          label="Разделы курсов"
          value={tab}
          onChange={(t) => window.history.pushState(null, "", t === "courses" ? "/study" : `/study?tab=${t}`)}
          items={TABS.map((t) => ({
            id: t.id,
            label:
              t.id === "review" && toReview ? (
                <span className="inline-flex items-center gap-1.5">
                  {t.label}
                  <span className="rounded-full bg-accent px-1.5 text-[11.5px] leading-[18px] font-semibold text-white tabular-nums">{toReview}</span>
                </span>
              ) : (
                t.label
              ),
          }))}
        />
      </div>
      <div key={tab} role="tabpanel" aria-label={TABS.find((t) => t.id === tab)?.label} className="view-in mt-9">
        {views[tab]}
      </div>
    </>
  );
}

export function TeachCourses({ courses }: { courses: TeachCourseCard[] }) {
  return (
    <div className="grid grid-cols-3 gap-4 max-[1000px]:grid-cols-2 max-[640px]:grid-cols-1">
      {courses.map((c) => (
        <Link
          key={c.slug}
          href={`/study/${c.slug}`}
          data-teach-course={c.slug}
          style={{ "--cc": `var(--c-${c.color})` } as React.CSSProperties}
          className="course-card flex flex-col overflow-hidden rounded-3xl bg-s1 transition-colors duration-200 hover:bg-s2"
        >
          <div className="course-cover">
            <span className="absolute top-4 left-5 text-xs font-medium text-[color-mix(in_srgb,var(--cc)_60%,var(--text))]">{c.kindLabel}</span>
          </div>
          <div className="flex flex-1 flex-col gap-0.5 px-5 pt-4 pb-5">
            <div className="text-[17px] font-semibold tracking-[-.02em]">{c.title}</div>
            <div className="text-sm text-text-3">{c.groups}</div>
            <div className="mt-auto flex items-end justify-between pt-[18px]">
              <span className="text-2xl leading-none font-medium tracking-[-.02em] tabular-nums">
                {c.students}
                <small className="ml-[5px] text-[13px] font-normal text-text-3">{plural(c.students, "студент", "студента", "студентов")}</small>
              </span>
              {c.toReview > 0 && <span className="text-[13px] text-accent">{c.toReview} на проверке</span>}
            </div>
            <ProgressBar value={c.progress} label="Семестр пройден" fill="var(--cc)" className="mt-3 h-1" />
          </div>
        </Link>
      ))}
    </div>
  );
}
