"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
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
      {!t.counts && <span className="shrink-0 whitespace-nowrap">без оценки</span>}
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
        <span className="block text-[13px] whitespace-nowrap text-text-3 tabular-nums">до {t.dueTime}</span>
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

const CHECKED_SHOWN = 8;

export function TaskGroup({
  title,
  items,
  onOpen,
  checked,
  showCourse = true,
}: {
  title: string;
  items: TaskDetail[];
  onOpen: (t: TaskDetail) => void;
  checked?: boolean;
  showCourse?: boolean;
}) {
  const [all, setAll] = useState(false);
  if (!items.length) return null;
  const shown = checked && !all ? items.slice(0, CHECKED_SHOWN) : items;
  return (
    <section aria-label={title} className="mt-12 first:mt-0">
      <h2 className="mb-2 flex items-baseline gap-2.5 text-lg font-semibold tracking-[-.02em]">
        {title}
        <span className="text-[15px] font-normal text-text-3 tabular-nums">{items.length}</span>
      </h2>
      <div className="rows [--row-inset:14px]">
        {shown.map((t) =>
          checked ? (
            <CheckedRow key={t.id} t={t} onOpen={() => onOpen(t)} showCourse={showCourse} />
          ) : (
            <OpenRow key={t.id} t={t} onOpen={() => onOpen(t)} showCourse={showCourse} />
          ),
        )}
      </div>
      {shown.length < items.length && (
        <button type="button" onClick={() => setAll(true)} className="mt-2 -ml-2 rounded-lg px-2 py-1 text-sm text-text-2 transition-colors hover:bg-hover hover:text-text">
          Показать все {items.length}
        </button>
      )}
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

/** Задания: ближайшие, позже, проверенные. ?task=<id> открывает окно сразу (так ведёт «Скоро» на «Сегодня»). */
export function TasksView({ upcoming, waiting, later, checked }: { upcoming: TaskDetail[]; waiting: TaskDetail[]; later: TaskDetail[]; checked: TaskDetail[] }) {
  const all = [...upcoming, ...waiting, ...later, ...checked];
  const { openTask, modal } = useTaskModal(all);

  const wanted = useSearchParams().get("task");
  useEffect(() => {
    if (!wanted) return;
    const t = [...upcoming, ...waiting, ...later, ...checked].find((x) => x.id === wanted);
    // через кадр: страница успевает отрисоваться, окно открывается с обычной анимацией
    if (t) requestAnimationFrame(() => openTask(t));
    window.history.replaceState(null, "", "/study?tab=tasks");
  }, [wanted, upcoming, waiting, later, checked, openTask]);

  return (
    <>
      <TaskGroup title="Ближайшие" items={upcoming} onOpen={openTask} />
      <TaskGroup title="На проверке" items={waiting} onOpen={openTask} />
      <TaskGroup title="Позже" items={later} onOpen={openTask} />
      <TaskGroup title="Проверенные" items={checked} onOpen={openTask} checked />
      {!all.length && <p className="text-[15px] text-text-3">Заданий пока нет</p>}
      {modal}
    </>
  );
}
