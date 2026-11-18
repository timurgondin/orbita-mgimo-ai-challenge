"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, ChevronRight } from "lucide-react";
import { plural } from "@/lib/phrases";
import { Modal } from "@/components/time/modal";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { TaskDetail } from "@/server/data/types";
import { StatusTag } from "./status-tag";
import { TaskContent } from "./task-content";

const ROW =
  "-mx-3.5 grid w-[calc(100%+28px)] items-center gap-x-4 rounded-2xl px-3.5 py-3 text-left transition-colors duration-150 hover:bg-hover";

function Sub({ t, showCourse }: { t: TaskDetail; showCourse: boolean }) {
  return (
    <span className="mt-px flex min-w-0 items-center gap-3 text-sm text-text-3">
      {showCourse && (
        <span className="flex min-w-0 items-center gap-2">
          <i className="size-1.5 shrink-0 rounded-full" style={{ background: `var(--c-${t.color})` }} />
          <span className="truncate">{t.courseTitle}</span>
        </span>
      )}
    </span>
  );
}

/** Задание впереди: дата слева, справа сколько осталось и до какого часа; тег — только если работа уже начата или сдана. */
export function OpenRow({ t, onOpen, showCourse = true }: { t: TaskDetail; onOpen: () => void; showCourse?: boolean }) {
  return (
    <button type="button" onClick={onOpen} data-task={t.id} className={cn(ROW, "grid-cols-[44px_minmax(0,1fr)_auto_auto] max-sm:grid-cols-[40px_minmax(0,1fr)_auto]")}>
      <span className={cn("text-center", t.dueHot && "text-urgent")}>
        <b className="block text-[22px] leading-none font-medium tracking-[-.02em] tabular-nums">{t.dueDay}</b>
        <small className={cn("text-xs", t.dueHot ? "text-urgent" : "text-text-3")}>{t.dueSub}</small>
      </span>
      <span className="min-w-0">
        <span className="block truncate font-medium max-sm:line-clamp-2 max-sm:whitespace-normal">{t.title}</span>
        <Sub t={t} showCourse={showCourse} />
        {t.tag && (
          <span className="mt-1.5 hidden max-sm:flex">
            <StatusTag status={t.tag} />
          </span>
        )}
      </span>
      <span className="flex justify-end max-sm:hidden">{t.tag && <StatusTag status={t.tag} />}</span>
      <span className="min-w-[96px] text-right">
        {t.left ? (
          <span className={cn("block text-sm whitespace-nowrap tabular-nums", t.dueHot ? "font-medium text-urgent" : "text-text-2")}>{t.left}</span>
        ) : (
          <span className="block text-sm text-text-3">сдано</span>
        )}
        <span className="block text-[13px] whitespace-nowrap text-text-3 tabular-nums">
          {t.kind === "prep" ? "к" : "до"} {t.dueTime}
        </span>
      </span>
    </button>
  );
}

/** Проверенное: оценка слева крупно (или галочка), отзыв под названием. */
export function CheckedRow({ t, onOpen, showCourse = true }: { t: TaskDetail; onOpen: () => void; showCourse?: boolean }) {
  return (
    <button type="button" onClick={onOpen} data-task={t.id} className={cn(ROW, "grid-cols-[44px_minmax(0,1fr)_auto] items-start max-sm:grid-cols-[40px_minmax(0,1fr)]")}>
      <span className="pt-0.5 text-center">
        {t.score != null ? (
          <>
            <b className="block text-[22px] leading-none font-medium tracking-[-.02em] tabular-nums">{t.score}</b>
            <small className="text-xs text-text-3">из 10</small>
          </>
        ) : (
          <Check size={20} strokeWidth={1.8} className="mx-auto mt-0.5 text-text-2" aria-label="Выполнено" />
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-medium">{t.title}</span>
        <Sub t={t} showCourse={showCourse} />
        {t.feedback && (
          <span className="mt-2 flex items-start gap-2.5 text-sm text-text-2">
            <span className="mono mt-px grid size-[22px] shrink-0 place-items-center rounded-full text-[9.5px] font-semibold" style={{ background: t.teacher.gradient }}>
              {t.teacher.initials}
            </span>
            <span className="line-clamp-2">{t.feedback}</span>
          </span>
        )}
      </span>
      <span className="pt-0.5 text-right text-[13px] whitespace-nowrap text-text-3 max-sm:hidden">{t.gradedAt}</span>
    </button>
  );
}

export function TaskGroup({
  title,
  items,
  onOpen,
  checked,
  showCourse = true,
  count = true,
}: {
  title: string;
  items: TaskDetail[];
  onOpen: (t: TaskDetail) => void;
  checked?: boolean;
  showCourse?: boolean;
  count?: boolean;
}) {
  if (!items.length) return null;
  return (
    <section aria-label={title} className="mt-12 first:mt-0">
      <h2 className="mb-2 flex items-baseline gap-2.5 text-lg font-semibold tracking-[-.02em]">
        {title}
        {count && <span className="text-[15px] font-normal text-text-3 tabular-nums">{items.length}</span>}
      </h2>
      <div className="rows [--row-inset:14px]">
        {items.map((t) =>
          checked ? (
            <CheckedRow key={t.id} t={t} onOpen={() => onOpen(t)} showCourse={showCourse} />
          ) : (
            <OpenRow key={t.id} t={t} onOpen={() => onOpen(t)} showCourse={showCourse} />
          ),
        )}
      </div>
    </section>
  );
}

/** Окно задания поверх списка: всегда со свежими данными (после сдачи список обновляется с сервера). */
export function useTaskModal(all: TaskDetail[], showCourse = true) {
  const [open, setOpen] = useState(false);
  const [id, setId] = useState<string | null>(null);
  const [snap, setSnap] = useState<TaskDetail | null>(null);
  const { toast, node } = useToast();
  const openTask = useCallback((t: TaskDetail) => {
    setId(t.id);
    setSnap(t);
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);
  const shown = all.find((t) => t.id === id) ?? snap;
  const modal = (
    <>
      <Modal open={open} onClose={close} accent={shown ? `var(--c-${shown.color})` : "var(--accent)"} title={shown?.title ?? "Задание"} width={520}>
        {shown && <TaskContent t={shown} toast={toast} showCourse={showCourse} />}
      </Modal>
      {node}
    </>
  );
  return { openTask, modal };
}

const CHIP = "inline-flex h-9 items-center gap-2 rounded-xl px-3.5 text-sm font-medium transition-[background,color] duration-150";
const chip = (on: boolean) => cn(CHIP, on ? "bg-text text-bg" : "bg-s1 text-text-2 hover:bg-s2 hover:text-text");

/** Все проверенные работы: фильтр по курсу, группы по месяцам — отдельный вид, а не хвост списка. */
function DoneView({ checked, onOpen }: { checked: TaskDetail[]; onOpen: (t: TaskDetail) => void }) {
  const [course, setCourse] = useState<string | null>(null);
  const courses = [...new Map(checked.map((t) => [t.courseSlug, t])).values()];
  const list = course ? checked.filter((t) => t.courseSlug === course) : checked;
  const scored = list.filter((t) => t.score != null);
  const avg = scored.length ? scored.reduce((s, t) => s + Number(t.score!.replace(",", ".")), 0) / scored.length : null;
  const months = [...new Set(list.map((t) => t.gradedMonth ?? ""))];
  return (
    <>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Курс">
        <button type="button" aria-pressed={!course} onClick={() => setCourse(null)} className={chip(!course)}>
          Все курсы
        </button>
        {courses.map((c) => (
          <button key={c.courseSlug} type="button" aria-pressed={course === c.courseSlug} onClick={() => setCourse(c.courseSlug)} className={chip(course === c.courseSlug)}>
            <i className="size-1.5 rounded-full" style={{ background: `var(--c-${c.color})` }} />
            {c.courseTitle}
          </button>
        ))}
      </div>
      <p className="mt-6 text-[15px] text-text-2" data-done-summary>
        Проверено {list.length} {plural(list.length, "работа", "работы", "работ")}
        {avg != null && (
          <>
            , средний балл <b className="font-semibold text-text tabular-nums">{avg.toFixed(1).replace(".", ",")}</b>
          </>
        )}
      </p>
      {months.map((m) => (
        <TaskGroup key={m} title={m} items={list.filter((t) => (t.gradedMonth ?? "") === m)} onOpen={onOpen} checked showCourse={!course} />
      ))}
    </>
  );
}

/** Задания: текущие (ближайшие, на проверке, подготовка, позже) и отдельно — все проверенные. ?task=<id> открывает окно сразу. */
export function TasksView({
  upcoming,
  waiting,
  prep,
  later,
  checked,
}: {
  upcoming: TaskDetail[];
  waiting: TaskDetail[];
  prep: TaskDetail[];
  later: TaskDetail[];
  checked: TaskDetail[];
}) {
  const all = [...upcoming, ...waiting, ...prep, ...later, ...checked];
  const { openTask, modal } = useTaskModal(all);
  const params = useSearchParams();
  const done = params.get("view") === "done";
  const setView = (d: boolean) => window.history.pushState(null, "", d ? "/study?tab=tasks&view=done" : "/study?tab=tasks");

  const wanted = params.get("task");
  useEffect(() => {
    if (!wanted) return;
    const t = [...upcoming, ...waiting, ...prep, ...later, ...checked].find((x) => x.id === wanted);
    // через кадр: страница успевает отрисоваться, окно открывается с обычной анимацией
    if (t) requestAnimationFrame(() => openTask(t));
    window.history.replaceState(null, "", "/study?tab=tasks");
  }, [wanted, upcoming, waiting, prep, later, checked, openTask]);

  return (
    <>
      <div className="mb-10 flex gap-1.5" role="group" aria-label="Какие задания">
        <button type="button" aria-pressed={!done} onClick={() => setView(false)} className={chip(!done)}>
          Текущие
        </button>
        <button type="button" aria-pressed={done} onClick={() => setView(true)} className={chip(done)} data-view-done>
          Проверенные
          <span className={cn("tabular-nums", done ? "text-bg/60" : "text-text-3")}>{checked.length}</span>
        </button>
      </div>

      {done ? (
        <DoneView checked={checked} onOpen={openTask} />
      ) : (
        <>
          <TaskGroup title="Ближайшие" items={upcoming} onOpen={openTask} />
          <TaskGroup title="На проверке" items={waiting} onOpen={openTask} />
          <TaskGroup title="Подготовка к занятиям" items={prep} onOpen={openTask} />
          <TaskGroup title="Позже" items={later} onOpen={openTask} />
          {checked.length > 0 && (
            <section aria-label="Недавно проверено" className="mt-12">
              <TaskGroup title="Недавно проверено" items={checked.slice(0, 3)} onOpen={openTask} checked count={false} />
              <button
                type="button"
                onClick={() => setView(true)}
                className="mt-3 inline-flex h-10 items-center gap-1 rounded-xl bg-s1 px-4 text-sm font-medium transition-colors hover:bg-s2"
              >
                Все проверенные работы
                <span className="text-text-3 tabular-nums">{checked.length}</span>
                <ChevronRight size={15} strokeWidth={1.6} className="text-text-3" />
              </button>
            </section>
          )}
          {!all.length && <p className="text-[15px] text-text-3">Заданий пока нет</p>}
        </>
      )}
      {modal}
    </>
  );
}
