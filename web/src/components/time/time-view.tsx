"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CircleAlert, CircleCheck } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { DEMO_DATE, addDays } from "@/lib/demo-clock";
import { cn } from "@/lib/utils";
import type { TimeData } from "@/server/data/types";
import { ConsView } from "./cons-view";
import { dowIndex } from "./helpers";
import { ConsContent, LessonContent, SyncContent, type Toast } from "./modal-content";
import { Modal } from "./modal";
import { ScheduleView, type Item, type View } from "./schedule-view";

type Tab = "sched" | "cons";
type ModalState = { type: "lesson" | "cons"; id: string } | { type: "sync" } | null;

const TABS = [
  { id: "sched", label: "Расписание" },
  { id: "cons", label: "Консультации" },
] as const;

const WEEK_MIN = -3;
const WEEK_MAX = 3;

const buildUrl = (tab: Tab, view: View, w: number) => {
  const q = new URLSearchParams();
  if (tab === "cons") q.set("tab", "cons");
  if (view === "week") q.set("view", "week");
  if (w !== 0) q.set("w", String(w));
  const s = q.toString();
  return s ? `/time?${s}` : "/time";
};

/** Вкладка, вид и неделя живут в адресе (?tab=cons, ?view=week, ?w=1); переключение — на клиенте. */
export function TimeView({ data }: { data: TimeData }) {
  const params = useSearchParams();
  const tab: Tab = params.get("tab") === "cons" ? "cons" : "sched";
  const view: View = params.get("view") === "week" ? "week" : "list";
  const rawW = Number(params.get("w") ?? 0);
  const week = Number.isInteger(rawW) ? Math.min(WEEK_MAX, Math.max(WEEK_MIN, rawW)) : 0;
  const monday = addDays(data.baseMonday, week * 7);

  const [picked, setPicked] = useState<{ w: number; d: number } | null>(null);
  const todayIdx = dowIndex(data.baseMonday, DEMO_DATE);
  const sel = picked && picked.w === week ? picked.d : week === 0 ? Math.min(Math.max(todayIdx, 0), 5) : 0;

  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState<ModalState>(null);
  const [toastState, setToastState] = useState<{ text: string; tone: "ok" | "error"; n: number } | null>(null);
  const [toastOn, setToastOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const go = (t: Tab, v: View, w: number) => window.history.pushState(null, "", buildUrl(t, v, w));

  const toast: Toast = useCallback((text, tone = "ok") => {
    setToastState((p) => ({ text, tone, n: (p?.n ?? 0) + 1 }));
    setToastOn(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToastOn(false), 2400);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const openModal = (m: NonNullable<ModalState>) => {
    setShown(m);
    setOpen(true);
  };
  const close = useCallback(() => setOpen(false), []);

  const items: Item[] = useMemo(
    () => [
      ...data.lessons.map((lesson) => ({ type: "lesson" as const, pair: lesson.pair, lesson })),
      ...data.consultations.filter((c) => c.going).map((cons) => ({ type: "cons" as const, pair: cons.pair, cons })),
    ],
    [data],
  );

  const lesson = shown?.type === "lesson" ? data.lessons.find((l) => l.id === shown.id) : undefined;
  const cons = shown?.type === "cons" ? data.consultations.find((c) => c.id === shown.id) : undefined;

  const accent = lesson ? `var(--c-${lesson.color})` : "var(--accent)";
  const title = lesson ? lesson.title : cons ? `Консультация · ${cons.courseTitle}` : "Синхронизация календаря";

  return (
    <>
      <div className="flex items-end justify-between gap-6 max-sm:flex-col max-sm:items-stretch max-sm:gap-5">
        <h1 className="text-[34px] leading-[1.15] font-medium tracking-[-.03em] max-sm:text-[28px]">Время</h1>
        <Segmented
          variant="tabs"
          label="Разделы времени"
          value={tab}
          onChange={(t) => go(t, view, week)}
          items={TABS.map((t) => ({ id: t.id, label: t.label }))}
        />
      </div>

      <div key={tab} className="view-in mt-8">
        {tab === "sched" ? (
          <ScheduleView
            monday={monday}
            week={week}
            sel={sel}
            view={view}
            items={items}
            onWeek={(d) => {
              const w = Math.min(WEEK_MAX, Math.max(WEEK_MIN, week + d));
              setPicked(null);
              go(tab, view, w);
            }}
            onSelect={(d) => {
              setPicked({ w: week, d });
              if (view !== "list") go(tab, "list", week);
            }}
            onView={(v) => go(tab, v, week)}
            onOpen={(it) => openModal({ type: it.type === "cons" ? "cons" : "lesson", id: it.type === "cons" ? it.cons.id : it.lesson.id })}
            onSync={() => openModal({ type: "sync" })}
          />
        ) : (
          <ConsView consultations={data.consultations} filter={filter} onFilter={setFilter} onOpen={(id) => openModal({ type: "cons", id })} />
        )}
      </div>

      <Modal open={open} onClose={close} accent={accent} cover={shown?.type !== "sync"} title={title}>
        {lesson && <LessonContent lesson={lesson} />}
        {cons && <ConsContent key={cons.id} cons={cons} toast={toast} onDone={close} />}
        {shown?.type === "sync" && <SyncContent link={data.syncLink} toast={toast} />}
      </Modal>

      <div
        role="status"
        aria-live="polite"
        className={cn(
          "pointer-events-none fixed bottom-7 left-1/2 z-50 flex items-center gap-2 rounded-[14px] bg-text px-[18px] py-3 text-sm font-medium whitespace-nowrap text-bg transition-[opacity,transform] duration-[250ms,400ms] ease-[var(--ease),var(--spring)] max-sm:bottom-24",
          toastOn ? "-translate-x-1/2 translate-y-0 opacity-100" : "-translate-x-1/2 translate-y-5 opacity-0",
        )}
      >
        {toastState?.tone === "error" ? <CircleAlert size={16} strokeWidth={1.8} /> : <CircleCheck size={16} strokeWidth={1.8} />}
        {toastState?.text}
      </div>
    </>
  );
}
