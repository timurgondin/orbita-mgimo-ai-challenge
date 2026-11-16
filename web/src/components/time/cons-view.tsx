"use client";

import { Check, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TimeConsultation } from "@/server/data/types";
import { DOWL, cap, cc, dayMonth, relDay } from "./helpers";

const STACK = ["#D6C3AE,#8F7A68", "#C9D3E6,#7F8BA6", "#D9C2E4,#9878A8", "#C9E6DD,#7FA699"];

export const isFull = (c: TimeConsultation) => c.count >= c.capacity && !c.going;

export function Cta({ c, className }: { c: TimeConsultation; className?: string }) {
  const base = "inline-flex h-[38px] items-center gap-1.5 rounded-xl px-4 text-sm font-semibold whitespace-nowrap transition-[background,transform] duration-150";
  if (c.going) return <span className={cn(base, "bg-[color-mix(in_srgb,var(--st-green)_14%,transparent)] text-(--st-green)", className)}><Check size={15} strokeWidth={1.8} />Вы идёте</span>;
  if (isFull(c)) return <span className={cn(base, "text-text-3 shadow-[inset_0_0_0_1px_var(--line)]", className)}>Мест нет</span>;
  return <span className={cn(base, "bg-s2 group-hover:bg-s3", className)}>Записаться</span>;
}

export function ConsView({
  consultations,
  filter,
  onFilter,
  onOpen,
}: {
  consultations: TimeConsultation[];
  filter: string;
  onFilter: (courseId: string) => void;
  onOpen: (id: string) => void;
}) {
  const upcoming = consultations.filter((c) => !c.past);
  const courses = [...new Map(upcoming.map((c) => [c.courseId, c])).values()];
  const active = filter === "all" || courses.some((c) => c.courseId === filter) ? filter : "all";
  const list = upcoming
    .filter((c) => active === "all" || c.courseId === active)
    .sort((a, b) => a.date.localeCompare(b.date) || a.pair - b.pair);
  const days = [...new Set(list.map((c) => c.date))];

  const chip = "inline-flex h-[34px] items-center gap-2 rounded-full px-3.5 text-sm font-medium transition-colors duration-150";
  return (
    <>
      <div className="mb-[26px] flex flex-wrap gap-1.5" role="group" aria-label="Фильтр по курсу">
        <button type="button" aria-pressed={active === "all"} onClick={() => onFilter("all")} className={cn(chip, active === "all" ? "bg-text text-bg" : "bg-s1 text-text-2 hover:text-text")}>
          Все курсы
        </button>
        {courses.map((c) => (
          <button
            key={c.courseId}
            type="button"
            aria-pressed={active === c.courseId}
            onClick={() => onFilter(c.courseId)}
            style={cc(c.color)}
            className={cn(chip, active === c.courseId ? "bg-text text-bg" : "bg-s1 text-text-2 hover:text-text")}
          >
            <i className="size-2 rounded-full bg-(--cc)" />
            {c.courseTitle}
          </button>
        ))}
      </div>

      {days.length === 0 && <div className="py-[18px] text-text-3">Консультаций нет</div>}
      {days.map((date) => {
        const rel = relDay(date);
        const dow = cap(DOWL[(new Date(`${date}T12:00:00+03:00`).getUTCDay() + 6) % 7]);
        return (
          <section key={date} className="mb-[30px]" aria-label={dow}>
            <h3 className="mb-2 text-lg font-semibold tracking-[-.02em]">
              {rel ?? dow}
              <span className="ml-1.5 text-[15px] font-normal text-text-3">
                {rel ? `${dow.toLowerCase()}, ` : ""}
                {dayMonth(date)}
              </span>
            </h3>
            <div className="rows">
              {list
                .filter((c) => c.date === date)
                .map((c) => (
                  <div
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpen(c.id)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" && e.key !== " ") return;
                      e.preventDefault();
                      onOpen(c.id);
                    }}
                    style={cc(c.color)}
                    data-id={c.id}
                    className="group -mx-4 grid cursor-pointer grid-cols-[96px_minmax(0,1fr)_auto_auto] items-center gap-[18px] rounded-[18px] px-4 py-3.5 transition-colors duration-150 hover:bg-hover max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:gap-x-3 max-sm:gap-y-3"
                  >
                    <div>
                      <b className="block text-[17px] font-semibold tracking-[-.02em]">{c.start}</b>
                      <small className="text-[13.5px] text-text-3">до {c.end}<span className="sm:hidden"> · {c.count} из {c.capacity}</span></small>
                    </div>
                    <div className="flex min-w-0 items-center gap-3 max-sm:order-3 max-sm:col-span-2">
                      <span className="grid size-10 shrink-0 place-items-center rounded-full text-[13px] font-semibold text-[#1d1d20]" style={{ background: c.teacherGradient }}>
                        {c.teacherInitials}
                      </span>
                      <div className="min-w-0">
                        <b className="block text-[15.5px] font-semibold">{c.teacher}</b>
                        <small className="flex items-center gap-1.5 text-sm text-text-3">
                          <i className="size-[7px] shrink-0 rounded-full bg-(--cc)" />
                          <span className="truncate">{c.courseTitle}</span>
                          <span aria-hidden>·</span>
                          {c.online ? (
                            <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><Video size={14} strokeWidth={1.6} />Онлайн</span>
                          ) : (
                            <span className="whitespace-nowrap">{c.place}</span>
                          )}
                        </small>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 text-[13.5px] whitespace-nowrap text-text-3 max-sm:hidden">
                      <span className="flex">
                        {STACK.slice(0, Math.min(3, c.count)).map((g, i) => (
                          <span key={i} className="-ml-[7px] size-6 rounded-full shadow-[0_0_0_2px_var(--bg)] first:ml-0" style={{ background: `linear-gradient(140deg,${g})` }} />
                        ))}
                      </span>
                      {c.count} из {c.capacity}
                    </div>
                    <Cta c={c} className="max-sm:justify-self-end" />
                  </div>
                ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
