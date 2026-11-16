import Link from "next/link";
import type { TaskItemData } from "@/server/data/types";
import { cn } from "@/lib/utils";
import { StatusTag } from "./status-tag";

function Task({ t }: { t: TaskItemData }) {
  return (
    <Link
      href="#"
      style={{ "--cc": `var(--c-${t.color})` } as React.CSSProperties}
      className="-mx-3.5 grid grid-cols-[10px_minmax(0,1fr)_auto_auto] items-center gap-x-4 gap-y-1 rounded-2xl px-3.5 py-[13px] transition-colors duration-150 hover:bg-hover max-sm:grid-cols-[10px_minmax(0,1fr)_auto]"
    >
      <span className="size-2 rounded-full bg-(--cc)" />
      <div className="min-w-0">
        <div className="truncate font-medium">{t.title}</div>
        <div className="mt-px truncate text-sm text-text-3">{t.course}</div>
      </div>
      {t.status ? (
        <>
          <span className="min-w-[120px] text-right max-sm:order-last max-sm:col-start-2 max-sm:flex max-sm:min-w-0 max-sm:gap-3 max-sm:text-left">
            <span className={cn("block text-sm text-text-2 max-sm:text-[13px]", t.dueHot && "text-urgent")}>{t.due}</span>
            <span className="mt-px block text-[13px] text-text-3">{t.note}</span>
          </span>
          <span className="flex min-w-[118px] justify-end max-sm:col-start-3 max-sm:row-start-1">
            <StatusTag status={t.status} />
          </span>
        </>
      ) : (
        <span className="col-start-4 text-right max-sm:col-start-3">
          <span className="block text-lg leading-tight font-semibold tracking-[-.02em]">
            {t.score}
            <small className="text-[13px] font-normal text-text-3"> / 10</small>
          </span>
          <span className="block text-[13px] text-text-3">{t.note}</span>
        </span>
      )}
      {t.feedback && (
        <div className="col-[2/-1] flex items-start gap-2.5 text-sm text-text-2">
          <span
            className="mt-px grid size-[22px] shrink-0 place-items-center rounded-full text-[9.5px] font-semibold text-[#1d1d20]"
            style={{ background: t.feedback.gradient }}
          >
            {t.feedback.initials}
          </span>
          {t.feedback.text}
        </div>
      )}
    </Link>
  );
}

function Group({ title, items }: { title: string; items: TaskItemData[] }) {
  if (!items.length) return null;
  return (
    <section aria-label={title} className="mt-12 first:mt-0">
      <h2 className="mb-3.5 text-lg font-semibold tracking-[-.02em]">{title}</h2>
      {items.map((t) => (
        <Task key={t.id} t={t} />
      ))}
    </section>
  );
}

export function TasksView({ upcoming, checked }: { upcoming: TaskItemData[]; checked: TaskItemData[] }) {
  return (
    <>
      <Group title="Ближайшие" items={upcoming} />
      <Group title="Проверенные" items={checked} />
    </>
  );
}
