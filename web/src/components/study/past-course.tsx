"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Download, FileSpreadsheet, FileText, GraduationCap, MessageSquareQuote, Presentation, PlayCircle } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { creditsLabel } from "@/lib/phrases";
import { cn } from "@/lib/utils";
import type { PastCoursePage, PastMaterialView } from "@/server/data/types";

const H2 = "mb-2 text-lg font-semibold tracking-[-.02em]";

/** Пройденный курс: итог, из чего сложился, что ушло в диплом. Слева — другие дисциплины того же семестра. */
const TABS = [
  { id: "overview", label: "Обзор" },
  { id: "materials", label: "Материалы" },
  { id: "works", label: "Мои работы" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export function PastCourseView({ c }: { c: PastCoursePage }) {
  const param = useSearchParams().get("tab");
  const tab: Tab = TABS.some((t) => t.id === param) ? (param as Tab) : "overview";
  const go = (t: Tab) => window.history.pushState(null, "", t === "overview" ? `/study/past/${c.id}` : `/study/past/${c.id}?tab=${t}`);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-12 min-[1000px]:grid-cols-[220px_minmax(0,1fr)]" style={{ "--cc": `var(--c-${c.color})` } as React.CSSProperties}>
      <aside aria-label={c.semester} className="sticky top-[92px] self-start max-[1000px]:hidden">
        <Link href={`/study/semester/${c.semesterN}`} className="-ml-1 inline-flex items-center gap-0.5 text-[15px] text-text-2 transition-colors duration-150 hover:text-text">
          <ChevronLeft size={17} strokeWidth={1.6} />
          {c.semester}
        </Link>
        <div className="mt-4 mb-1 px-3 text-[13px] text-text-3">{c.season.charAt(0).toUpperCase() + c.season.slice(1)}</div>
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
        <Link href={`/study/semester/${c.semesterN}`} className="-ml-1 mb-4 inline-flex items-center gap-0.5 text-[15px] text-text-2 hover:text-text min-[1000px]:hidden">
          <ChevronLeft size={17} strokeWidth={1.6} />
          {c.semester}
        </Link>
        <div className="course-cover h-[132px] rounded-[26px] max-sm:h-[104px] max-sm:rounded-[22px]" />
        <div className="mt-6 flex items-end justify-between gap-6 max-[700px]:flex-col max-[700px]:items-stretch max-[700px]:gap-4">
          <div className="min-w-0">
            <h1 className="text-[34px] leading-[1.15] font-medium tracking-[-.03em] [text-wrap:balance] max-sm:text-[28px]">{c.title}</h1>
            <div className="mt-1.5 text-[15px] text-text-2">
              {c.semester}, {c.season}
            </div>
          </div>
          <Segmented label="Разделы курса" value={tab} onChange={go} items={TABS.map((t) => ({ id: t.id, label: t.label }))} />
        </div>

        <div key={tab} className="view-in">
        {tab === "materials" ? (
          <Materials c={c} />
        ) : tab === "works" ? (
          <Works c={c} />
        ) : (
        <>

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
        {c.topics.length > 0 && (
          <section aria-labelledby="topics" className="mt-12">
            <h2 id="topics" className={H2}>
              Темы курса
            </h2>
            {c.annotation && <p className="mb-4 max-w-[640px] text-[15px] text-text-2">{c.annotation}</p>}
            <ol className="grid grid-cols-[minmax(0,1fr)] gap-x-10 min-[800px]:grid-cols-2">
              {c.topics.map((t, i) => (
                <li key={t} className="flex gap-3 py-2 text-[15px]">
                  <span className="w-5 shrink-0 text-right text-text-3 tabular-nums">{i + 1}</span>
                  {t}
                </li>
              ))}
            </ol>
          </section>
        )}
        </>
        )}
        </div>
      </div>
    </div>
  );
}

const MAT_ICON: Record<PastMaterialView["kind"], React.ReactNode> = {
  slides: <Presentation size={18} strokeWidth={1.6} />,
  pdf: <FileText size={18} strokeWidth={1.6} />,
  doc: <FileText size={18} strokeWidth={1.6} />,
  data: <FileSpreadsheet size={18} strokeWidth={1.6} />,
  video: <PlayCircle size={18} strokeWidth={1.6} />,
};

/** Материалы курса по разделам: файлы открываются настоящим PDF, записи лекций — только строкой (в прототипе видео нет). */
function Materials({ c }: { c: PastCoursePage }) {
  if (!c.materials.length) return <p className="mt-9 text-[15px] text-text-3">Материалов нет</p>;
  const groups = [...new Set(c.materials.map((m) => m.group))];
  return (
    <div className="mt-9 flex flex-col gap-10">
      {groups.map((g) => (
        <section key={g} aria-label={g}>
          <h2 className={H2}>{g}</h2>
          <div className="rows [--row-inset:14px]">
            {c.materials
              .filter((m) => m.group === g)
              .map((m) => {
                const inner = (
                  <>
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-s1 text-(--cc)">{MAT_ICON[m.kind]}</span>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate font-medium">{m.title}</b>
                      <small className="text-[13px] text-text-3">
                        {m.meta}
                        {m.size && `, ${m.size}`}
                      </small>
                    </span>
                    {m.download && <Download size={16} strokeWidth={1.6} className="shrink-0 text-text-3" />}
                  </>
                );
                const cls = "-mx-3.5 flex items-center gap-3.5 rounded-2xl px-3.5 py-3";
                return m.download ? (
                  <a key={m.n} href={`/study/past/${c.id}/files/${m.n}`} target="_blank" rel="noopener" data-material={m.n} className={cn(cls, "transition-colors duration-150 hover:bg-hover")}>
                    {inner}
                  </a>
                ) : (
                  <div key={m.n} className={cls}>
                    {inner}
                  </div>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}

/** Мои работы за семестр: балл, дата, отзыв преподавателя. В конце — экзаменационный билет и отзыв по итогам. */
function Works({ c }: { c: PastCoursePage }) {
  return (
    <div className="mt-9 grid grid-cols-[minmax(0,1fr)] gap-12 min-[1100px]:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <section aria-labelledby="works">
        <h2 id="works" className={H2}>
          Мои работы
        </h2>
        {c.works.length ? (
          <div className="rows [--row-inset:14px]">
            {c.works.map((w, i) => (
              <div key={i} data-past-work className="-mx-3.5 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 rounded-2xl px-3.5 py-3">
                <span className="min-w-0">
                  <b className="block truncate font-medium">{w.title}</b>
                  <small className="text-[13px] text-text-3">
                    {w.date}
                    {w.file && `, ${w.file}`}
                  </small>
                  {w.feedback && <span className="mt-1.5 block text-sm text-text-2">«{w.feedback}»</span>}
                </span>
                {w.score && (
                  <b className="text-right text-lg font-semibold tracking-[-.02em] tabular-nums">
                    {w.score}
                    <small className="ml-0.5 text-[13px] font-normal text-text-3">/10</small>
                  </b>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[15px] text-text-3">Работ нет</p>
        )}
      </section>
      <div className="flex flex-col gap-10">
        {c.exam && (
          <section aria-labelledby="exam" className="rounded-3xl bg-s1 px-5 py-4">
            <h2 id="exam" className="text-[17px] font-semibold tracking-[-.01em]">
              {c.exam.title}
            </h2>
            <ol className="mt-2.5 flex flex-col gap-1.5">
              {c.exam.questions.map((q, i) => (
                <li key={q} className="flex gap-2.5 text-[15px]">
                  <span className="text-text-3 tabular-nums">{i + 1}.</span>
                  {q}
                </li>
              ))}
            </ol>
            <p className="mt-3 text-sm text-text-2">{c.exam.note}</p>
          </section>
        )}
        {c.review && (
          <section aria-labelledby="review">
            <h2 id="review" className={H2}>
              Отзыв преподавателя
            </h2>
            <figure className="flex gap-3.5">
              <MessageSquareQuote size={20} strokeWidth={1.5} className="mt-0.5 shrink-0 text-text-3" />
              <span>
                <blockquote className="text-[15px] text-text-2">{c.review}</blockquote>
                <figcaption className="mt-2 flex items-center gap-2 text-sm text-text-3">
                  <span className="mono grid size-6 place-items-center rounded-full text-[10px] font-semibold" style={{ background: c.teacherGradient }}>
                    {c.teacherInitials}
                  </span>
                  {c.teacher}
                </figcaption>
              </span>
            </figure>
          </section>
        )}
      </div>
    </div>
  );
}
