"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, MessagesSquare, PlayCircle } from "lucide-react";
import { Modal } from "@/components/time/modal";
import { ProgressBar } from "@/components/ui/progress";
import { creditsLabel } from "@/lib/phrases";
import { cn } from "@/lib/utils";
import type { CoursePageData, FormulaSegment, TaskDetail } from "@/server/data/types";
import { StatusTag } from "./status-tag";
import { TaskContent } from "./task-content";

const SEG = {
  done: "bg-(--cc)",
  pending: "bg-[color-mix(in_srgb,var(--cc)_40%,var(--s3))]",
  empty: "bg-s3",
};
const H2 = "mb-2 text-lg font-semibold tracking-[-.02em]";

/** Список курсов слева: переключение без возврата в «Учёбу». */
function Sidebar({ d }: { d: CoursePageData }) {
  const groups = [
    { title: null, items: d.nav.filter((n) => !n.online) },
    { title: "Онлайн", items: d.nav.filter((n) => n.online) },
  ];
  return (
    <aside aria-label="Мои курсы" className="sticky top-[92px] self-start max-[1000px]:hidden">
      <Link href="/study" className="-ml-1 inline-flex items-center gap-0.5 text-[15px] text-text-2 transition-colors duration-150 hover:text-text">
        <ChevronLeft size={17} strokeWidth={1.6} />
        Учёба
      </Link>
      {groups.map(
        (g) =>
          g.items.length > 0 && (
            <nav key={g.title ?? "main"} aria-label={g.title ?? "Курсы"} className="mt-4 flex flex-col gap-0.5">
              {g.title && <div className="mt-3 mb-1 px-3 text-[13px] text-text-3">{g.title}</div>}
              {g.items.map((n) => {
                const on = n.slug === d.slug;
                return (
                  <Link
                    key={n.slug}
                    href={`/study/${n.slug}`}
                    aria-current={on ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl px-3 py-2 text-[14.5px] transition-colors duration-150",
                      on ? "bg-s1 font-medium text-text" : "text-text-2 hover:bg-hover hover:text-text",
                    )}
                  >
                    <i className="size-2 shrink-0 rounded-full" style={{ background: `var(--c-${n.color})` }} />
                    <span className="truncate">{n.title}</span>
                  </Link>
                );
              })}
            </nav>
          ),
      )}
    </aside>
  );
}

function Bar({ formula, className }: { formula: FormulaSegment[]; className?: string }) {
  return (
    <div className={cn("flex gap-[3px]", className)} aria-hidden="true">
      {formula.map((s, i) => (
        <i key={i} className={`block rounded-sm ${SEG[s.state]}`} style={{ flex: s.weight }} />
      ))}
    </div>
  );
}

/** Строка формулы: вес слева, элемент, справа оценка или статус. */
function ComponentRow({ t, onOpen }: { t: TaskDetail; onOpen: () => void }) {
  const sub =
    t.score != null
      ? t.gradedAt ? `проверено ${t.gradedAt}` : "оценено"
      : t.dueShort ? `срок: ${t.dueShort.charAt(0).toLowerCase()}${t.dueShort.slice(1)}`
      : t.kind === "participation" ? "по занятиям"
      : "дата позже";
  return (
    <button
      type="button"
      onClick={onOpen}
      data-component={t.id}
      className="-mx-3.5 grid w-[calc(100%+28px)] grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-x-3 max-sm:grid-cols-[44px_minmax(0,1fr)_auto] rounded-2xl px-3.5 py-3 text-left transition-colors duration-150 hover:bg-hover"
    >
      <span className="text-[15px] text-text-3 tabular-nums">{t.weight}%</span>
      <span className="min-w-0">
        <span className="block truncate font-medium max-sm:line-clamp-2 max-sm:whitespace-normal">{t.title}</span>
        <span className={cn("block text-[13px]", t.dueHot ? "text-urgent" : "text-text-3")}>{sub}</span>
      </span>
      <span className="text-right">
        {t.score != null ? (
          <b className="text-lg font-semibold tracking-[-.02em] tabular-nums">{t.score}</b>
        ) : (
          t.tag && t.tag !== "upcoming" && <StatusTag status={t.tag} />
        )}
      </span>
    </button>
  );
}

/** «Что нужно, чтобы вышло N»: итог = Σ балл·вес, в ведомость — округлённый. */
function Calculator({ calc, forecast }: { calc: NonNullable<CoursePageData["calc"]>; forecast: string | null }) {
  const [target, setTarget] = useState(() => Math.min(10, Math.max(6, (Number(forecast) || 7) + 1)));
  const need = ((target - 0.5) * 100 - calc.gradedSum) / calc.remainingWeight;
  const value = Math.ceil(need * 10) / 10;
  const shown = Number.isInteger(value) ? String(value) : value.toFixed(1).replace(".", ",");
  return (
    <section aria-labelledby="calc" className="mt-12">
      <h2 id="calc" className={H2}>
        Что нужно, чтобы вышло
      </h2>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Итоговая оценка">
        {[5, 6, 7, 8, 9, 10].map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={n === target}
            onClick={() => setTarget(n)}
            className={cn(
              "h-10 min-w-11 rounded-xl px-3 text-[15px] font-medium tabular-nums transition-[background,color,transform] duration-150 active:scale-[.97]",
              n === target ? "bg-text text-bg" : "bg-s1 text-text-2 hover:bg-s2 hover:text-text",
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="mt-4 text-[15px] text-text-2" data-calc-result>
        {need <= 0 ? (
          <>
            <b className="font-semibold text-text">{target}</b> уже обеспечена — даже без оставшихся работ
          </>
        ) : need > 10 ? (
          <>
            <b className="font-semibold text-text">{target}</b> уже не выйдет: не хватит даже десяти баллов
          </>
        ) : (
          <>
            {calc.examOnly ? "На экзамене" : "За оставшиеся работы"} нужно в среднем{" "}
            <b className="text-[22px] font-semibold tracking-[-.02em] text-text tabular-nums">{shown}</b> из 10
          </>
        )}
      </p>
    </section>
  );
}

function OnlineBody({ d }: { d: CoursePageData }) {
  const done = d.lessonsDone ?? 0;
  const total = d.lessonsTotal ?? 0;
  return (
    <>
      <section aria-label="Прогресс" className="mt-9">
        <b className="block text-[40px] leading-none font-medium tracking-[-.035em]">
          {done}
          <small className="text-xl text-text-3"> / {total}</small>
        </b>
        <span className="text-sm text-text-3">уроков пройдено</span>
        <ProgressBar value={total ? Math.round((done / total) * 100) : 0} label="Курс пройден" fill="var(--cc)" className="mt-5 h-1.5 max-w-[520px]" />
      </section>
      {d.nextLesson && (
        <section aria-label="Следующий урок" className="mt-10 flex max-w-[520px] items-center gap-4 rounded-3xl bg-s1 px-5 py-4">
          <PlayCircle size={28} strokeWidth={1.4} className="shrink-0 text-(--cc)" />
          <span className="min-w-0 flex-1">
            <b className="block font-medium">{d.nextLesson.title}</b>
            <small className="text-[13px] text-text-3">Следующий урок, {d.nextLesson.minutes} мин</small>
          </span>
        </section>
      )}
    </>
  );
}

export function CoursePage({ d }: { d: CoursePageData }) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState<TaskDetail | null>(null);
  const close = useCallback(() => setOpen(false), []);
  const isExam = d.assessment === "exam";
  const gradedCount = d.components.filter((c) => c.score != null).length;

  const stats = d.online
    ? []
    : [
        isExam ? { value: d.score ?? "—", suffix: d.score ? " из 10" : "", label: "текущий балл" } : { value: String(gradedCount), suffix: ` из ${d.components.length}`, label: "работ оценено" },
        isExam && d.forecast ? { value: d.forecast, label: "прогноз в ведомость" } : null,
        { value: `${d.doneWeight}%`, label: "формулы уже оценено" },
      ].filter((s) => !!s);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-12 min-[1000px]:grid-cols-[220px_minmax(0,1fr)]" style={{ "--cc": `var(--c-${d.color})` } as React.CSSProperties}>
      <Sidebar d={d} />

      <div className="min-w-0">
        <Link href="/study" className="-ml-1 mb-4 inline-flex items-center gap-0.5 text-[15px] text-text-2 hover:text-text min-[1000px]:hidden">
          <ChevronLeft size={17} strokeWidth={1.6} />
          Учёба
        </Link>
        <div className="course-cover h-[132px] rounded-[26px] max-sm:h-[104px] max-sm:rounded-[22px]">
          <span className="absolute top-5 left-6 text-[13px] font-medium text-[color-mix(in_srgb,var(--cc)_60%,var(--text))]">{d.kindLabel}</span>
        </div>

        <h1 className="mt-6 text-[34px] leading-[1.15] font-medium tracking-[-.03em] [text-wrap:balance] max-sm:text-[28px]">{d.title}</h1>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-6 gap-y-2 text-[15px] text-text-2">
          <span className="flex items-center gap-2">
            <span className="mono grid size-[22px] shrink-0 place-items-center rounded-full text-[9.5px] font-semibold" style={{ background: d.teacher.gradient }}>
              {d.teacher.initials}
            </span>
            {d.teacher.name}
          </span>
          {!d.online && (
            <span className="flex items-center gap-2">
              <CalendarDays size={16} strokeWidth={1.6} className="text-text-3" />
              {d.finalLabel}, {creditsLabel(d.credits)}
            </span>
          )}
        </div>

        {d.online ? (
          <OnlineBody d={d} />
        ) : (
          <>
            <section aria-label="Итоги" className="mt-9 flex flex-wrap gap-x-14 gap-y-6 max-sm:gap-x-8">
              {stats.map((s) => (
                <div key={s.label}>
                  <b className="block text-[40px] leading-none font-medium tracking-[-.035em] max-sm:text-[32px]">
                    {s.value}
                    {"suffix" in s && s.suffix && <small className="text-xl text-text-3">{s.suffix}</small>}
                  </b>
                  <span className="text-sm text-text-3">{s.label}</span>
                </div>
              ))}
            </section>

            <section aria-labelledby="formula" className="mt-12">
              <h2 id="formula" className={H2}>
                Формула оценки
              </h2>
              <Bar formula={d.formula} className="mt-3 mb-3 h-2" />
              <div className="rows [--row-inset:14px]">
                {d.components.map((t) => (
                  <ComponentRow
                    key={t.id}
                    t={t}
                    onOpen={() => {
                      setShown(t);
                      setOpen(true);
                    }}
                  />
                ))}
              </div>
            </section>

            {d.calc && <Calculator calc={d.calc} forecast={d.forecast} />}

            <div className="mt-12 grid grid-cols-[minmax(0,1fr)] gap-12 min-[1100px]:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              <section aria-labelledby="lessons">
                <h2 id="lessons" className={H2}>
                  Ближайшие занятия
                </h2>
                {d.lessons.length ? (
                  <div className="rows [--row-inset:14px]">
                    {d.lessons.map((l) => (
                      <Link
                        key={l.id}
                        href={`/time?open=${l.id}`}
                        className="-mx-3.5 grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-x-3 rounded-2xl px-3.5 py-3 transition-colors duration-150 hover:bg-hover"
                      >
                        <span className="text-center">
                          <b className="block text-[20px] leading-none font-medium tabular-nums">{l.day}</b>
                          <small className={cn("text-xs", l.today ? "text-text" : "text-text-3")}>{l.today ? "сегодня" : l.weekday}</small>
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{l.title}</span>
                          <span className="block text-[13px] text-text-3 tabular-nums">
                            с {l.start} до {l.end}
                          </span>
                        </span>
                        <span className="text-[13px] whitespace-nowrap text-text-3">ауд. {l.room}</span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-[15px] text-text-3">Занятий больше нет</p>
                )}
              </section>

              <section aria-labelledby="cons">
                <h2 id="cons" className={H2}>
                  Консультация
                </h2>
                {d.consultation ? (
                  <Link
                    href={`/time?tab=cons&open=${d.consultation.id}`}
                    className="-mx-3.5 flex items-center gap-3.5 rounded-2xl px-3.5 py-3 transition-colors duration-150 hover:bg-hover"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-s1 text-text-2">
                      <MessagesSquare size={16} strokeWidth={1.6} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <b className="block font-medium">{d.consultation.when}</b>
                      <small className="text-[13px] text-text-3">{d.consultation.place}</small>
                    </span>
                    <ChevronRight size={16} strokeWidth={1.6} className="text-text-3" />
                  </Link>
                ) : (
                  <p className="text-[15px] text-text-3">Ближайших консультаций нет</p>
                )}
              </section>
            </div>
          </>
        )}
      </div>

      <Modal open={open} onClose={close} accent={`var(--c-${d.color})`} title={shown?.title ?? "Элемент оценки"} width={500}>
        {shown && <TaskContent t={shown} showCourse={false} />}
      </Modal>
    </div>
  );
}
