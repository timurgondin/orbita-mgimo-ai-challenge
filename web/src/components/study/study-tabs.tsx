"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "courses", label: "Курсы" },
  { id: "tasks", label: "Задания" },
  { id: "perf", label: "Успеваемость" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const isTab = (v: string | null): v is TabId => TABS.some((t) => t.id === v);

/** Вкладки живут в адресе (?tab=…), переключение — на клиенте, без запроса к серверу. */
export function StudyTabs({
  semester,
  views,
}: {
  semester: string;
  views: Record<TabId, React.ReactNode>;
}) {
  const param = useSearchParams().get("tab");
  const tab: TabId = isTab(param) ? param : "courses";
  const segRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const first = useRef(true);

  const place = useCallback((animate: boolean) => {
    const pill = pillRef.current;
    const active = segRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!pill || !active) return;
    pill.style.transition = animate ? "" : "none";
    pill.style.left = `${active.offsetLeft}px`;
    pill.style.width = `${active.offsetWidth}px`;
  }, []);

  useLayoutEffect(() => {
    place(!first.current);
    first.current = false;
  }, [tab, place]);

  useEffect(() => {
    const seg = segRef.current;
    if (!seg) return;
    const ro = new ResizeObserver(() => place(false));
    ro.observe(seg);
    document.fonts?.ready.then(() => place(false));
    return () => ro.disconnect();
  }, [place]);

  const select = (id: TabId) => {
    const url = id === "courses" ? "/study" : `/study?tab=${id}`;
    window.history.pushState(null, "", url);
  };

  const onKey = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = TABS[(i + d + TABS.length) % TABS.length];
    select(next.id);
    segRef.current?.querySelector<HTMLElement>(`#tab-${next.id}`)?.focus();
  };

  return (
    <>
      <div className="flex items-end justify-between gap-6 max-sm:flex-col max-sm:items-stretch max-sm:gap-5">
        <div>
          <div className="text-[15px] text-text-2">{semester}</div>
          <h1 className="mt-1 text-[34px] leading-[1.15] font-medium tracking-[-.03em] max-sm:text-[28px]">Учёба</h1>
        </div>
        <div
          ref={segRef}
          role="tablist"
          aria-label="Разделы учёбы"
          className="relative flex rounded-[14px] bg-s1 p-1"
        >
          <span
            ref={pillRef}
            aria-hidden="true"
            className="absolute top-1 bottom-1 left-0 w-0 rounded-[10px] bg-s3 shadow-[0_1px_2px_rgba(0,0,0,.3)] transition-[left,width] duration-[450ms] ease-spring"
          />
          {TABS.map((t, i) => (
            <button
              key={t.id}
              id={`tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1}
              onClick={() => select(t.id)}
              onKeyDown={(e) => onKey(e, i)}
              className={cn(
                "relative z-[1] h-9 rounded-[10px] px-4 text-sm font-medium transition-colors duration-200 max-sm:flex-1 max-sm:px-2",
                tab === t.id ? "text-text" : "text-text-3 hover:text-text-2",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {TABS.map((t) =>
        tab === t.id ? (
          <div key={t.id} id={`panel-${t.id}`} role="tabpanel" aria-labelledby={`tab-${t.id}`} className="view-in mt-9">
            {views[t.id]}
          </div>
        ) : null,
      )}
    </>
  );
}
