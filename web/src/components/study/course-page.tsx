"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BookOpenText, CalendarClock, ChevronLeft, ChevronRight, ClipboardCheck, MapPin, MessagesSquare, PlayCircle, Target } from "lucide-react";
import { Modal } from "@/components/time/modal";
import { ProgressBar } from "@/components/ui/progress";
import { Segmented } from "@/components/ui/segmented";
import { creditsLabel, plural } from "@/lib/phrases";
import { cn } from "@/lib/utils";
import type { CoursePageData, FormulaItem, FormulaSegment, TaskDetail } from "@/server/data/types";
import { CourseDoc, type DocKind } from "./course-doc";
import { Description, IconBox, InfoRow } from "./task-content";
import { TaskGroup, useTaskModal } from "./tasks-view";

const SEG = {
  done: "bg-(--cc)",
  pending: "bg-[color-mix(in_srgb,var(--cc)_40%,var(--s3))]",
  empty: "bg-s3",
};
const H2 = "mb-2 text-lg font-semibold tracking-[-.02em]";

const TABS = [
  { id: "overview", label: "Обзор" },
  { id: "tasks", label: "Задания" },
  { id: "docs", label: "Документы" },
] as const;
type Tab = (typeof TABS)[number]["id"];

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

/** Строка формулы: вес, элемент, справа балл. Срок — только во второй строке, без повторов в шапке. */
function ComponentRow({ c, onOpen }: { c: FormulaItem; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      data-component={c.id}
      className="-mx-3.5 grid w-[calc(100%+28px)] grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-x-3 rounded-2xl px-3.5 py-3 text-left transition-colors duration-150 hover:bg-hover max-sm:grid-cols-[44px_minmax(0,1fr)_auto]"
    >
      <span className="text-[15px] text-text-3 tabular-nums">{c.weight}%</span>
      <span className="min-w-0">
        <span className="block truncate font-medium">{c.title}</span>
        <span className={cn("block text-[13px]", c.hot ? "text-urgent" : "text-text-3")}>{c.sub}</span>
      </span>
      <b className={cn("text-right text-lg font-semibold tracking-[-.02em] tabular-nums", c.state !== "done" && "text-text-2")}>{c.score ?? ""}</b>
    </button>
  );
}

function ComponentContent({ c, onTask }: { c: FormulaItem; onTask: (id: string) => void }) {
  return (
    <>
      {c.kindLabel !== c.title && <div className="text-sm text-text-2">{c.kindLabel}</div>}
      <div className="mt-1 text-[26px] leading-[1.15] font-semibold tracking-[-.03em]">{c.title}</div>
      {c.score != null && (
        <div className="mt-5 flex items-end gap-3">
          <b className="text-[44px] leading-none font-medium tracking-[-.035em] tabular-nums">{c.score}</b>
          <span className="pb-1 text-[15px] text-text-2">{c.aggregate ? `из 10, среднее по проверенным: ${c.sub.replace("проверено ", "")}` : "из 10"}</span>
        </div>
      )}
      {c.description && (
        <section className="mt-6">
          <Description text={c.description} />
        </section>
      )}
      {c.tasks.length > 0 && (
        <section className="mt-6">
          <h3 className="mb-1 text-[15px] font-semibold">{c.aggregate ? "Из чего складывается" : "Задание"}</h3>
          <div className="rows [--row-inset:0px]">
            {c.tasks.map((t) => (
              <button key={t.id} type="button" onClick={() => onTask(t.id)} className="-mx-2 flex w-[calc(100%+16px)] items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-hover">
                <span className="min-w-0 flex-1 truncate">{t.title}</span>
                {t.score != null ? <b className="font-semibold tabular-nums">{t.score}</b> : <span className="text-sm text-text-3">{t.status}</span>}
              </button>
            ))}
          </div>
        </section>
      )}
      <div className="mt-5">
        <InfoRow icon={<IconBox><Target size={16} strokeWidth={1.6} /></IconBox>} title={`${c.weight}% итоговой оценки`} />
        {c.dueLong && <InfoRow icon={<IconBox><CalendarClock size={16} strokeWidth={1.6} /></IconBox>} title={c.dueLong} />}
        {c.room && (
          <InfoRow
            icon={<IconBox><MapPin size={16} strokeWidth={1.6} /></IconBox>}
            title={`Аудитория ${c.room}`}
            sub={c.eventId ? "Открыть в расписании" : undefined}
            href={c.eventId ? `/time?open=${c.eventId}` : undefined}
          />
        )}
      </div>
    </>
  );
}

/** Автомат: выходит или сколько не хватает. */
function AutoPass({ a, credit }: { a: NonNullable<CoursePageData["autoPass"]>; credit: boolean }) {
  return (
    <section
      aria-label="Автомат"
      data-autopass={a.ok ? "yes" : "no"}
      style={{ "--c": a.ok ? "var(--st-green)" : "var(--st-orange)" } as React.CSSProperties}
      className="mt-9 flex items-start gap-3.5 rounded-3xl bg-s1 px-5 py-4"
    >
      <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-(--c)" />
      <span className="min-w-0">
        <b className="block text-[17px] font-semibold tracking-[-.01em]">
          {a.ok ? (credit ? "Зачёт автоматом выходит" : "Автомат выходит") : `До автомата не хватает ${a.gap}`}
        </b>
        <span className="mt-0.5 block text-sm text-text-2">{a.rule}</span>
      </span>
    </section>
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

function Staff({ d }: { d: CoursePageData }) {
  return (
    <section aria-labelledby="staff">
      <h2 id="staff" className={H2}>
        Преподаватели
      </h2>
      <div className="rows [--row-inset:14px]">
        {d.staff.map((s) => (
          <Link key={s.slug} href={`/people/${s.slug}`} data-staff={s.slug} className="-mx-3.5 flex items-center gap-3.5 rounded-2xl px-3.5 py-3 transition-colors duration-150 hover:bg-hover">
            <span className="mono grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold" style={{ background: s.gradient }}>
              {s.initials}
            </span>
            <span className="min-w-0 flex-1">
              <b className="block truncate font-medium">{s.name}</b>
              <small className="text-[13px] text-text-3">
                {s.role}, {s.position.toLowerCase()}
              </small>
            </span>
            <ChevronRight size={16} strokeWidth={1.6} className="text-text-3" />
          </Link>
        ))}
      </div>
    </section>
  );
}

function Overview({ d, onComponent }: { d: CoursePageData; onComponent: (c: FormulaItem) => void }) {
  const isExam = d.assessment === "exam";
  const gradedCount = d.components.filter((c) => c.state === "done").length;
  const stats = [
    isExam ? { value: d.score ?? "—", suffix: d.score ? " из 10" : "", label: "текущий балл" } : { value: String(gradedCount), suffix: ` из ${d.components.length}`, label: "элементов оценено" },
    isExam && d.forecast ? { value: d.forecast, label: "прогноз в ведомость" } : null,
    { value: `${d.doneWeight}%`, label: "формулы уже оценено" },
  ].filter((s) => !!s);

  return (
    <>
      <section aria-label="Итоги" className="flex flex-wrap gap-x-14 gap-y-6 max-sm:gap-x-8">
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
      {d.autoPass && <AutoPass a={d.autoPass} credit={!isExam} />}

      <section aria-labelledby="formula" className="mt-12">
        <h2 id="formula" className={H2}>
          Формула оценки
        </h2>
        <Bar formula={d.formula} className="mt-3 mb-3 h-2" />
        <div className="rows [--row-inset:14px]">
          {d.components.map((c) => (
            <ComponentRow key={c.id} c={c} onOpen={() => onComponent(c)} />
          ))}
        </div>
      </section>

      {d.calc && <Calculator calc={d.calc} forecast={d.forecast} />}

      <div className="mt-12 grid grid-cols-[minmax(0,1fr)] gap-12 min-[1100px]:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
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

        <div className="flex flex-col gap-10">
          {d.staff.length > 0 && <Staff d={d} />}
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
      </div>
    </>
  );
}

function Tasks({ tasks, onOpen }: { tasks: TaskDetail[]; onOpen: (t: TaskDetail) => void }) {
  const waiting = tasks.filter((t) => !t.done && (t.tag === "submitted" || t.tag === "reviewing"));
  const prep = tasks.filter((t) => t.kind === "prep");
  const open = tasks.filter((t) => !t.done && !waiting.includes(t) && !prep.includes(t));
  const done = tasks.filter((t) => t.done).reverse();
  return (
    <>
      <TaskGroup title="Открытые" items={open} onOpen={onOpen} showCourse={false} />
      <TaskGroup title="На проверке" items={waiting} onOpen={onOpen} showCourse={false} />
      <TaskGroup title="Подготовка к занятиям" items={prep} onOpen={onOpen} showCourse={false} />
      <TaskGroup title="Выполненные" items={done} onOpen={onOpen} checked showCourse={false} />
      {!tasks.length && <p className="text-[15px] text-text-3">Заданий нет</p>}
    </>
  );
}

function Docs({ d, onOpen }: { d: CoursePageData; onOpen: (k: DocKind) => void }) {
  if (!d.syllabus) return <p className="text-[15px] text-text-3">Программа дисциплины появится после утверждения кафедрой</p>;
  const s = d.syllabus;
  const hours = s.hours.lectures + s.hours.seminars + s.hours.self;
  const rows: { kind: DocKind; icon: React.ReactNode; title: string; sub: string }[] = [
    { kind: "program", icon: <BookOpenText size={18} strokeWidth={1.6} />, title: "Программа дисциплины", sub: `${s.code}, ${hours} ${plural(hours, "час", "часа", "часов")}, ${s.topics.length} тем` },
    { kind: "assessment", icon: <ClipboardCheck size={18} strokeWidth={1.6} />, title: d.assessment === "exam" ? "Оценочные материалы и вопросы к экзамену" : "Оценочные материалы и вопросы к зачёту", sub: `Формула, правила округления и автомата, ${s.questions.length} ${plural(s.questions.length, "вопрос", "вопроса", "вопросов")}` },
  ];
  return (
    <div className="rows [--row-inset:14px]">
      {rows.map((r) => (
        <button key={r.kind} type="button" data-doc={r.kind} onClick={() => onOpen(r.kind)} className="-mx-3.5 flex w-[calc(100%+28px)] items-center gap-3.5 rounded-2xl px-3.5 py-3.5 text-left transition-colors duration-150 hover:bg-hover">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-s1 text-text-2">{r.icon}</span>
          <span className="min-w-0 flex-1">
            <b className="block font-medium">{r.title}</b>
            <small className="text-[13px] text-text-3">{r.sub}</small>
          </span>
          <ChevronRight size={16} strokeWidth={1.6} className="text-text-3" />
        </button>
      ))}
    </div>
  );
}

function OnlineBody({ d }: { d: CoursePageData }) {
  const done = d.lessonsDone ?? 0;
  const total = d.lessonsTotal ?? 0;
  return (
    <>
      <section aria-label="Прогресс">
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
  const param = useSearchParams().get("tab");
  const tab: Tab = TABS.some((t) => t.id === param) ? (param as Tab) : "overview";
  const go = (t: Tab) => window.history.pushState(null, "", t === "overview" ? `/study/${d.slug}` : `/study/${d.slug}?tab=${t}`);

  const { openTask, modal: taskModal } = useTaskModal(d.tasks, false);
  const [compOpen, setCompOpen] = useState(false);
  const [comp, setComp] = useState<FormulaItem | null>(null);
  const [docOpen, setDocOpen] = useState(false);
  const [doc, setDoc] = useState<DocKind>("program");
  const closeComp = useCallback(() => setCompOpen(false), []);
  const closeDoc = useCallback(() => setDocOpen(false), []);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-12 min-[1000px]:grid-cols-[220px_minmax(0,1fr)]" style={{ "--cc": `var(--c-${d.color})` } as React.CSSProperties}>
      <Sidebar d={d} />

      <div className="min-w-0">
        <Link href="/study" className="-ml-1 mb-4 inline-flex items-center gap-0.5 text-[15px] text-text-2 hover:text-text min-[1000px]:hidden">
          <ChevronLeft size={17} strokeWidth={1.6} />
          Учёба
        </Link>
        <div className="course-cover h-[132px] rounded-[26px] max-sm:h-[104px] max-sm:rounded-[22px]" />

        <div className="mt-6 flex items-end justify-between gap-6 max-[700px]:flex-col max-[700px]:items-stretch max-[700px]:gap-4">
          <div className="min-w-0">
            <h1 className="text-[34px] leading-[1.15] font-medium tracking-[-.03em] [text-wrap:balance] max-sm:text-[28px]">{d.title}</h1>
            <div className="mt-1.5 text-[15px] text-text-2">
              {d.online ? d.provider : `${d.finalLabel}, ${creditsLabel(d.credits)}`}
            </div>
          </div>
          {!d.online && <Segmented label="Разделы курса" value={tab} onChange={go} items={TABS.map((t) => ({ id: t.id, label: t.label }))} />}
        </div>

        <div key={tab} className="view-in mt-9">
          {d.online ? (
            <OnlineBody d={d} />
          ) : tab === "overview" ? (
            <Overview
              d={d}
              onComponent={(c) => {
                setComp(c);
                setCompOpen(true);
              }}
            />
          ) : tab === "tasks" ? (
            <Tasks tasks={d.tasks} onOpen={openTask} />
          ) : (
            <Docs
              d={d}
              onOpen={(k) => {
                setDoc(k);
                setDocOpen(true);
              }}
            />
          )}
        </div>
      </div>

      <Modal open={compOpen} onClose={closeComp} accent={`var(--c-${d.color})`} title={comp?.title ?? "Элемент оценки"} width={500}>
        {comp && (
          <ComponentContent
            c={d.components.find((c) => c.id === comp.id) ?? comp}
            onTask={(id) => {
              const t = d.tasks.find((x) => x.id === id);
              setCompOpen(false);
              if (t) openTask(t);
            }}
          />
        )}
      </Modal>
      <Modal open={docOpen} onClose={closeDoc} accent={`var(--c-${d.color})`} cover={false} title={doc === "program" ? "Программа дисциплины" : "Оценочные материалы"} width={760}>
        {d.syllabus && <CourseDoc kind={doc} d={d} />}
      </Modal>
      {taskModal}
    </div>
  );
}
