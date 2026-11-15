"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Rows3, Rss, Target } from "lucide-react";
import { BELLS } from "@/lib/bells";
import { DEMO_DATE, DEMO_MINUTES, toMinutes } from "@/lib/demo-clock";
import { cn } from "@/lib/utils";
import { Segmented } from "@/components/ui/segmented";
import type { TimeConsultation, TimeLesson } from "@/server/data/types";
import { ACCENT, DOW, DOWL, cap, cc, dayMonth, dayNumber, relDay, slotStatus, weekDates, weekTitle } from "./helpers";

export type Item = { type: "lesson"; pair: number; lesson: TimeLesson } | { type: "cons"; pair: number; cons: TimeConsultation };
export type View = "list" | "week";

const WEEK_MIN = -3;
const WEEK_MAX = 3;

function Time({ pair }: { pair: number }) {
  const [s, e] = BELLS[pair];
  return (
    <span className="text-sm leading-[1.3] text-text-2 max-sm:text-[13px]">
      {s}
      <small className="block text-text-3">{e}</small>
    </span>
  );
}

function Slot({ item, date, onOpen }: { item: Item; date: string; onOpen: (item: Item) => void }) {
  const cons = item.type === "cons";
  const t = cons ? item.cons : item.lesson;
  const st = slotStatus(date, t.start, t.end);
  const style = cons ? ACCENT : cc(item.lesson.color);
  const mine = cons && st.state === "future";
  const l = cons ? null : item.lesson;
  const meta = cons
    ? `${item.cons.place} · ${item.cons.teacher} · ${item.cons.count} из ${item.cons.capacity}`
    : null;
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      style={style}
      data-pair={item.pair}
      data-state={st.state}
      className={cn(
        "slot group -mx-4 grid w-[calc(100%+32px)] cursor-pointer grid-cols-[44px_96px_minmax(0,1fr)_auto] items-center gap-3.5 rounded-[18px] px-4 py-3.5 text-left transition-colors duration-150 hover:bg-hover max-sm:grid-cols-[28px_46px_minmax(0,1fr)] max-sm:gap-x-2.5 max-sm:gap-y-1",
        st.state === "live" && "bg-s1",
      )}
    >
      <span className={cn("text-center text-2xl font-medium tracking-[-.03em] max-sm:text-xl", st.state === "live" ? "text-text" : "text-text-3", st.state === "past" && "opacity-50")}>{item.pair}</span>
      <span className={cn(st.state === "past" && "opacity-50")}>
        <Time pair={item.pair} />
      </span>
      <div className={cn("min-w-0", st.state === "past" && "opacity-50")}>
        <div
          className={cn(
            "flex items-center gap-[9px] text-base font-semibold tracking-[-.015em]",
            cons && "text-[color-mix(in_srgb,var(--accent)_40%,var(--text))]",
          )}
        >
          {l?.isTest ? <Target size={15} strokeWidth={1.6} className="shrink-0 text-(--cc)" /> : <i className="size-2 shrink-0 rounded-full bg-(--cc)" />}
          <span className="min-w-0">{cons ? `Консультация · ${item.cons.courseTitle}` : l!.title}</span>
        </div>
        <div className="mt-0.5 pl-[17px] text-sm text-text-3">
          {cons ? (
            meta
          ) : (
            <>
              {l!.kindLabel}
              {l!.topic ? ` · ${l!.topic}` : ""} ·{" "}
              {l!.roomFrom ? (
                <>
                  <s>{l!.roomFrom}</s> <span className="font-medium text-urgent">→ {l!.room}</span>
                </>
              ) : (
                `ауд. ${l!.room}`
              )}{" "}
              · {l!.teacher}
            </>
          )}
        </div>
      </div>
      <span
        className={cn(
          "text-[13.5px] whitespace-nowrap text-text-3 max-sm:col-start-3 max-sm:text-left max-sm:pl-[17px] sm:text-right",
          st.tone === "live" && "text-text",
          st.tone === "hot" && "text-urgent",
          mine && "text-(--st-green)",
        )}
      >
        {mine ? "Вы записаны" : st.text}
      </span>
      {st.state === "live" && (
        <span className="col-[3/-1] mt-0.5 h-[3px] overflow-hidden rounded-[3px] bg-s3">
          <i className="block h-full rounded-[3px] bg-text" style={{ width: `${st.progress}%` }} />
        </span>
      )}
    </button>
  );
}

function EmptySlot({ pair }: { pair: number }) {
  return (
    <div className="-mx-4 grid grid-cols-[44px_96px_minmax(0,1fr)_auto] items-center gap-3.5 px-4 py-2.5 max-sm:grid-cols-[28px_46px_minmax(0,1fr)] max-sm:gap-x-2.5">
      <span className="text-center text-2xl font-medium tracking-[-.03em] text-text-3 max-sm:text-xl">{pair}</span>
      <Time pair={pair} />
      <span className="text-sm text-text-3">Нет пары</span>
    </div>
  );
}

function DayBlock({ date, items, onOpen }: { date: string; items: Item[]; onOpen: (item: Item) => void }) {
  const rel = relDay(date);
  const dow = new Date(`${date}T12:00:00+03:00`).getUTCDay();
  const name = cap(DOWL[(dow + 6) % 7]);
  const first = items[0]?.pair;
  const last = items[items.length - 1]?.pair;
  const rows: React.ReactNode[] = [];
  if (items.length) {
    for (let p = first; p <= last; p++) {
      const it = items.find((x) => x.pair === p);
      rows.push(
        it ? (
          <Slot key={`${it.type}-${p}-${it.type === "cons" ? it.cons.id : it.lesson.id}`} item={it} date={date} onOpen={onOpen} />
        ) : (
          <EmptySlot key={`e-${p}`} pair={p} />
        ),
      );
    }
  }
  return (
    <section aria-label={name} className="mb-9">
      <div className="mb-1.5 flex items-baseline gap-2.5">
        <h2 className="text-xl font-semibold tracking-[-.02em]">{rel ?? name}</h2>
        <span className="text-[15px] text-text-3">
          {rel ? `${name.toLowerCase()}, ` : ""}
          {dayMonth(date)}
        </span>
      </div>
      {items.length ? <div className="[&>*:not(:first-child)]:shadow-[0_-.5px_0_var(--line)] [&>*:hover]:shadow-none [&>*:hover+*]:shadow-none [&>[data-state=live]]:shadow-none [&>[data-state=live]+*]:shadow-none">{rows}</div> : <div className="py-[18px] text-text-3">Пар нет</div>}
    </section>
  );
}

function WeekGrid({ monday, byDate, onOpen }: { monday: string; byDate: Map<string, Item[]>; onOpen: (item: Item) => void }) {
  const HOUR = 58;
  const H0 = 8;
  const dates = weekDates(monday);
  const maxEnd = Math.max(...[...byDate.values()].flat().map((i) => toMinutes(BELLS[i.pair][1])), 19 * 60);
  const H1 = Math.max(20, Math.ceil(maxEnd / 60));
  const hours = H1 - H0;
  const todayIdx = dates.indexOf(DEMO_DATE);
  return (
    <div className="mt-4 overflow-hidden rounded-3xl bg-s1">
      <div
        className="relative grid grid-cols-[var(--hc)_repeat(6,minmax(0,1fr))] [--hc:38px] sm:[--hc:56px]"
        style={{ height: hours * HOUR }}
      >
        <div className="relative">
          {Array.from({ length: hours - 1 }, (_, i) => (
            <span key={i} className="absolute right-1.5 -translate-y-1/2 text-[11.5px] text-text-3 sm:right-2.5" style={{ top: (i + 1) * HOUR }}>
              {H0 + i + 1}:00
            </span>
          ))}
        </div>
        {Array.from({ length: hours - 1 }, (_, i) => (
          <div key={i} className="absolute right-0 left-(--hc) h-[.5px] bg-[rgba(255,255,255,.045)] light:bg-line" style={{ top: (i + 1) * HOUR }} />
        ))}
        {dates.map((date) => (
          <div key={date} className={cn("relative border-l-[.5px] border-line", date === DEMO_DATE && "bg-[color-mix(in_srgb,var(--accent)_3%,transparent)]")}>
            {(byDate.get(date) ?? []).map((it) => {
              const [s, e] = BELLS[it.pair];
              const cons = it.type === "cons";
              const past = slotStatus(date, s, e).state === "past";
              return (
                <button
                  key={`${it.type}-${it.pair}`}
                  type="button"
                  onClick={() => onOpen(it)}
                  style={{
                    ...(cons ? ACCENT : cc(it.lesson.color)),
                    top: ((toMinutes(s) - H0 * 60) / 60) * HOUR,
                    height: ((toMinutes(e) - toMinutes(s)) / 60) * HOUR - 3,
                  }}
                  className={cn(
                    "absolute right-0.5 left-0.5 overflow-hidden rounded-[10px] bg-[color-mix(in_srgb,var(--cc)_16%,var(--s1))] px-1.5 py-[7px] text-left hover:bg-[color-mix(in_srgb,var(--cc)_24%,var(--s1))] sm:right-1 sm:left-1 sm:px-[9px]",
                    past && "opacity-45",
                  )}
                >
                  <div className="text-xs leading-[1.25] font-semibold text-[color-mix(in_srgb,var(--cc)_40%,var(--text))] sm:text-[13px]">
                    {cons ? "Консультация" : it.lesson.isTest ? it.lesson.title : it.lesson.courseTitle}
                  </div>
                  <div className="mt-px truncate text-[11px] text-text-2 sm:text-xs">
                    {it.pair} пара · {cons ? it.cons.place : it.lesson.room}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
        {todayIdx >= 0 && (
          <div
            className="absolute z-[3] h-0.5 bg-accent before:absolute before:-top-[3px] before:-left-1 before:size-2 before:rounded-full before:bg-accent before:content-['']"
            style={{
              top: ((DEMO_MINUTES - H0 * 60) / 60) * HOUR,
              left: `calc(var(--hc) + (100% - var(--hc)) / 6 * ${todayIdx})`,
              width: "calc((100% - var(--hc)) / 6)",
            }}
          />
        )}
      </div>
    </div>
  );
}

export function ScheduleView({
  monday,
  week,
  sel,
  view,
  items,
  onWeek,
  onSelect,
  onView,
  onOpen,
  onSync,
}: {
  monday: string;
  week: number;
  sel: number;
  view: View;
  items: Item[];
  onWeek: (delta: number) => void;
  onSelect: (day: number) => void;
  onView: (v: View) => void;
  onOpen: (item: Item) => void;
  onSync: () => void;
}) {
  const dates = weekDates(monday);
  const byDate = new Map<string, Item[]>();
  for (const it of items) {
    const date = it.type === "cons" ? it.cons.date : it.lesson.date;
    if (!dates.includes(date)) continue;
    byDate.set(date, [...(byDate.get(date) ?? []), it]);
  }
  for (const list of byDate.values()) list.sort((a, b) => a.pair - b.pair);

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onWeek(-1)}
            disabled={week <= WEEK_MIN}
            aria-label="Предыдущая неделя"
            className="grid size-9 place-items-center rounded-[11px] text-text-2 transition-colors hover:bg-s1 hover:text-text disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronLeft size={16} strokeWidth={1.6} />
          </button>
          <b aria-live="polite" className="min-w-[150px] text-center text-[17px] font-semibold tracking-[-.02em] max-sm:min-w-[128px] max-sm:text-base">
            {weekTitle(monday)}
          </b>
          <button
            type="button"
            onClick={() => onWeek(1)}
            disabled={week >= WEEK_MAX}
            aria-label="Следующая неделя"
            className="grid size-9 place-items-center rounded-[11px] text-text-2 transition-colors hover:bg-s1 hover:text-text disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronRight size={16} strokeWidth={1.6} />
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <Segmented
            variant="toggle"
            label="Вид расписания"
            value={view}
            onChange={onView}
            items={[
              { id: "list", ariaLabel: "Список", label: <Rows3 size={16} strokeWidth={1.6} /> },
              { id: "week", ariaLabel: "Неделя", label: <CalendarDays size={16} strokeWidth={1.6} /> },
            ]}
          />
          <button
            type="button"
            onClick={onSync}
            aria-label="Синхронизация календаря"
            title="Синхронизация календаря"
            className="grid size-9 place-items-center rounded-[11px] text-text-2 transition-colors hover:bg-s1 hover:text-text"
          >
            <Rss size={16} strokeWidth={1.6} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-1 rounded-[20px] bg-s1 p-1">
        {dates.map((date, d) => {
          const n = byDate.get(date)?.length ?? 0;
          const past = date < DEMO_DATE;
          const today = date === DEMO_DATE;
          const on = view === "list" && d === sel;
          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelect(d)}
              aria-label={`${cap(DOWL[d])}, ${dayMonth(date)}`}
              aria-pressed={on}
              className={cn(
                "relative flex flex-col items-center gap-0.5 rounded-2xl pt-2.5 pb-3.5 text-text-2 transition-colors duration-200 hover:bg-hover",
                on && "bg-s3 text-text shadow-[0_1px_3px_rgba(0,0,0,.25)] hover:bg-s3",
              )}
            >
              <small className="text-[12.5px] font-medium text-text-3">{DOW[d]}</small>
              <b className={cn("text-xl leading-[1.2] font-medium tracking-[-.02em]", past && "text-text-3", today && "text-accent")}>{dayNumber(date)}</b>
              <span className="absolute bottom-[5px] flex gap-[3px]" aria-hidden="true">
                {Array.from({ length: n }, (_, i) => (
                  <i key={i} className={cn("size-1 rounded-full", on ? "bg-text-2" : "bg-text-3")} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      {view === "list" ? (
        <div className="mt-[30px]">
          {dates.slice(sel, Math.min(6, sel + 3)).map((date) => (
            <DayBlock key={date} date={date} items={byDate.get(date) ?? []} onOpen={onOpen} />
          ))}
        </div>
      ) : (
        <WeekGrid monday={monday} byDate={byDate} onOpen={onOpen} />
      )}
    </>
  );
}
