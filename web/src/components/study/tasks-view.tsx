"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Modal } from "@/components/time/modal";
import { cn } from "@/lib/utils";
import type { TaskDetail } from "@/server/data/types";
import { StatusTag } from "./status-tag";
import { TaskContent } from "./task-content";

const ROW =
  "-mx-3.5 grid w-[calc(100%+28px)] items-center gap-x-4 rounded-2xl px-3.5 py-3 text-left transition-colors duration-150 hover:bg-hover";

function Course({ t }: { t: TaskDetail }) {
  return (
    <span className="mt-px flex min-w-0 items-center gap-2 text-sm text-text-3">
      <i className="size-1.5 shrink-0 rounded-full" style={{ background: `var(--c-${t.color})` }} />
      <span className="truncate">{t.courseTitle}</span>
    </span>
  );
}

/** Задание впереди: дата слева (как у сессии), справа время, вес и статус. */
function OpenRow({ t, onOpen }: { t: TaskDetail; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} data-task={t.id} className={cn(ROW, "grid-cols-[44px_minmax(0,1fr)_auto_auto] max-sm:grid-cols-[40px_minmax(0,1fr)]")}>
      <span className={cn("text-center", t.dueHot ? "text-urgent" : "")}>
        <b className="block text-[22px] leading-none font-medium tracking-[-.02em] tabular-nums">{t.dueDay}</b>
        <small className={cn("text-xs", t.dueHot ? "text-urgent" : "text-text-3")}>{t.dueHot ? "сегодня" : t.dueSub}</small>
      </span>
      <span className="min-w-0">
        <span className="block truncate font-medium max-sm:line-clamp-2 max-sm:whitespace-normal">{t.title}</span>
        <Course t={t} />
        {/* на телефоне статус — под названием, чтобы не съедал его */}
        {t.tag && (
          <span className="mt-1.5 hidden max-sm:flex">
            <StatusTag status={t.tag} />
          </span>
        )}
      </span>
      <span className="min-w-[92px] text-right max-sm:hidden">
        <span className={cn("block text-sm tabular-nums", t.dueHot ? "text-urgent" : "text-text-2")}>до {t.dueTime}</span>
        <span className="block text-[13px] text-text-3">{t.room ? `ауд. ${t.room}` : `${t.weight}% оценки`}</span>
      </span>
      <span className="flex min-w-[118px] justify-end max-sm:hidden">{t.tag && <StatusTag status={t.tag} />}</span>
    </button>
  );
}

/** Проверенное: оценка слева крупно, отзыв преподавателя под названием. */
function CheckedRow({ t, onOpen }: { t: TaskDetail; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} data-task={t.id} className={cn(ROW, "grid-cols-[44px_minmax(0,1fr)_auto] items-start max-sm:grid-cols-[40px_minmax(0,1fr)]")}>
      <span className="pt-0.5 text-center">
        <b className="block text-[22px] leading-none font-medium tracking-[-.02em] tabular-nums">{t.score}</b>
        <small className="text-xs text-text-3">из 10</small>
      </span>
      <span className="min-w-0">
        <span className="block truncate font-medium">{t.title}</span>
        <Course t={t} />
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

function Group({ title, items, onOpen, checked }: { title: string; items: TaskDetail[]; onOpen: (t: TaskDetail) => void; checked?: boolean }) {
  if (!items.length) return null;
  return (
    <section aria-label={title} className="mt-12 first:mt-0">
      <h2 className="mb-2 text-lg font-semibold tracking-[-.02em]">{title}</h2>
      <div className="rows [--row-inset:14px]">
        {items.map((t) => (checked ? <CheckedRow key={t.id} t={t} onOpen={() => onOpen(t)} /> : <OpenRow key={t.id} t={t} onOpen={() => onOpen(t)} />))}
      </div>
    </section>
  );
}

/** Задания: ближайшие, позже, проверенные. По клику — окно с деталями; ?task=<id> открывает его сразу (так ведёт «Скоро» на «Сегодня»). */
export function TasksView({ upcoming, later, checked }: { upcoming: TaskDetail[]; later: TaskDetail[]; checked: TaskDetail[] }) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState<TaskDetail | null>(null);
  const openTask = useCallback((t: TaskDetail) => {
    setShown(t);
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);

  const wanted = useSearchParams().get("task");
  useEffect(() => {
    if (!wanted) return;
    const t = [...upcoming, ...later, ...checked].find((x) => x.id === wanted);
    // через кадр: страница успевает отрисоваться, окно открывается с обычной анимацией
    if (t) requestAnimationFrame(() => openTask(t));
    window.history.replaceState(null, "", "/study?tab=tasks");
  }, [wanted, upcoming, later, checked, openTask]);

  return (
    <>
      <Group title="Ближайшие" items={upcoming} onOpen={openTask} />
      <Group title="Позже" items={later} onOpen={openTask} />
      <Group title="Проверенные" items={checked} onOpen={openTask} checked />
      {!upcoming.length && !later.length && !checked.length && <p className="text-[15px] text-text-3">Заданий пока нет</p>}

      <Modal open={open} onClose={close} accent={shown ? `var(--c-${shown.color})` : "var(--accent)"} title={shown?.title ?? "Задание"} width={500}>
        {shown && <TaskContent t={shown} />}
      </Modal>
    </>
  );
}
