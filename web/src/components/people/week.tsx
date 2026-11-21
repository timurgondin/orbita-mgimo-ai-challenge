"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { DEMO_DATE } from "@/lib/demo-clock";
import { cn } from "@/lib/utils";
import type { WeekDay, WeekNav } from "@/server/data/types";

const H2 = "mb-3 text-lg font-semibold tracking-[-.02em]";

/** «Семинар, МБ-24-1», «Лекция, поток МБ-24»; без группы — только вид занятия. */
const kindLine = (kind: string, group: string) => (group ? `${kind}, ${/^[А-ЯЁ][а-яё]/.test(group) ? group.charAt(0).toLowerCase() + group.slice(1) : group}` : kind);

/**
 * Расписание человека на неделю: полоса дней Пн–Сб (по умолчанию сегодня, точка — в этот день есть пары)
 * и пары выбранного дня строками, как в «Времени». Монохромно: цвет курса — только точкой у названия
 * (у преподавателя — только у пар, которые идут и у тебя).
 */
const ARROW = "grid size-8 place-items-center rounded-full text-text-2 transition-colors duration-150 hover:bg-hover hover:text-text";

/** ‹ Эта неделя › — неделя в адресе (?week=), без прокрутки страницы наверх. */
function WeekSwitch({ nav }: { nav: WeekNav }) {
  const path = usePathname();
  const href = (monday: string) => `${path}?week=${monday}`;
  return (
    <div className="flex items-center gap-1" data-week-nav>
      {nav.prev ? (
        <Link href={href(nav.prev)} scroll={false} replace aria-label="Предыдущая неделя" className={ARROW} data-week-prev>
          <ChevronLeft size={17} strokeWidth={1.8} />
        </Link>
      ) : (
        <span className={cn(ARROW, "opacity-30 hover:bg-transparent")} aria-hidden="true">
          <ChevronLeft size={17} strokeWidth={1.8} />
        </span>
      )}
      <span className="min-w-[132px] text-center text-sm font-medium text-text-2" title={nav.range} data-week-label>
        {nav.label}
      </span>
      {nav.next ? (
        <Link href={href(nav.next)} scroll={false} replace aria-label="Следующая неделя" className={ARROW} data-week-next>
          <ChevronRight size={17} strokeWidth={1.8} />
        </Link>
      ) : (
        <span className={cn(ARROW, "opacity-30 hover:bg-transparent")} aria-hidden="true">
          <ChevronRight size={17} strokeWidth={1.8} />
        </span>
      )}
    </div>
  );
}

export function Week({ week, nav, title = "Неделя" }: { week: WeekDay[]; nav: WeekNav; title?: string }) {
  // сегодня, если оно на этой неделе; иначе первый день с парами
  const first = week.find((d) => d.date === DEMO_DATE) ?? week.find((d) => d.items.length) ?? week[0];
  const [day, setDay] = useState(first?.date);
  const shown = week.find((d) => d.date === day);

  return (
    <section aria-labelledby="week">
      <div className="mb-3 flex max-w-[440px] items-center justify-between gap-3">
        <h2 id="week" className={cn(H2, "mb-0")}>
          {title}
        </h2>
        <WeekSwitch nav={nav} />
      </div>
      <div role="group" aria-label="День недели" className="mb-3 grid max-w-[440px] grid-cols-6 gap-1" data-week-days>
        {week.map((d) => {
          const on = d.date === day;
          return (
            <button
              key={d.date}
              type="button"
              aria-pressed={on}
              aria-label={`${d.dow}, ${d.day}${d.items.length ? "" : ", пар нет"}`}
              onClick={() => setDay(d.date)}
              data-week-day={d.date}
              className={cn(
                "flex h-[60px] flex-col items-center justify-center gap-0.5 rounded-[14px] transition-[background,color,transform] duration-150 active:scale-[.97]",
                on ? "bg-text text-bg" : "text-text-2 hover:bg-hover",
              )}
            >
              <span className={cn("text-[12px]", on ? "text-bg/70" : d.date === DEMO_DATE ? "text-accent" : "text-text-3")}>{d.dow}</span>
              <b className="text-[17px] leading-none font-semibold tabular-nums">{d.day}</b>
              <i className={cn("size-1 rounded-full", d.items.length ? (on ? "bg-bg/60" : "bg-text-3") : "bg-transparent")} aria-hidden="true" />
            </button>
          );
        })}
      </div>

      {shown && shown.items.length > 0 ? (
        <div className="rows [--row-inset:0px]" data-week-list>
          {shown.items.map((e) => (
            <div key={e.id} data-week-item className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-x-4 py-3 max-sm:grid-cols-[52px_minmax(0,1fr)] max-sm:gap-x-3">
              <span className="text-[15px] font-medium tabular-nums">
                {e.start}
                <small className="block text-[13px] font-normal text-text-3">{e.end}</small>
              </span>
              <span className="min-w-0">
                <b className="flex items-center gap-2 font-medium">
                  <i
                    aria-hidden="true"
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ background: e.mine && e.color ? `var(--c-${e.color})` : "var(--text-3)" }}
                  />
                  <span className="truncate">{e.title}</span>
                </b>
                <small className="block truncate pl-3.5 text-[13.5px] text-text-3">
                  {kindLine(e.kind, e.group)}
                  <span className="hidden max-sm:inline">, ауд. {e.room}</span>
                </small>
              </span>
              <span className="flex items-center gap-1.5 text-sm whitespace-nowrap text-text-2 max-sm:hidden">
                <MapPin size={14} strokeWidth={1.6} className="text-text-3" />
                {e.room}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-3 text-[15px] text-text-3">Пар нет</p>
      )}
    </section>
  );
}
