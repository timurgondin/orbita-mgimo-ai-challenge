"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface SegmentItem<T extends string> {
  id: T;
  label: React.ReactNode;
  ariaLabel?: string;
}

/** Сегмент-контрол с переезжающей подложкой. tabs — вкладки раздела, toggle — переключатель вида (иконки). */
export function Segmented<T extends string>({
  items,
  value,
  onChange,
  variant = "tabs",
  label,
  className,
}: {
  items: SegmentItem<T>[];
  value: T;
  onChange: (id: T) => void;
  variant?: "tabs" | "toggle";
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const first = useRef(true);
  const tabs = variant === "tabs";

  const place = useCallback((animate: boolean) => {
    const p = pill.current;
    const active = ref.current?.querySelector<HTMLElement>('[data-on="true"]');
    if (!p || !active) return;
    p.style.transition = animate ? "" : "none";
    p.style.left = `${active.offsetLeft}px`;
    p.style.width = `${active.offsetWidth}px`;
  }, []);

  useLayoutEffect(() => {
    place(!first.current);
    first.current = false;
  }, [value, place]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => place(false));
    ro.observe(el);
    document.fonts?.ready.then(() => place(false));
    return () => ro.disconnect();
  }, [place]);

  const onKey = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = items[(i + d + items.length) % items.length];
    onChange(next.id);
    ref.current?.querySelectorAll<HTMLElement>("button")[(i + d + items.length) % items.length]?.focus();
  };

  return (
    <div
      ref={ref}
      role={tabs ? "tablist" : "group"}
      aria-label={label}
      className={cn("relative flex bg-s1", tabs ? "rounded-[14px] p-1" : "rounded-[11px] p-[3px]", className)}
    >
      <span
        ref={pill}
        aria-hidden="true"
        className={cn(
          "absolute left-0 w-0 bg-s3 transition-[left,width] duration-[450ms] ease-spring",
          tabs ? "top-1 bottom-1 rounded-[10px] shadow-[0_1px_2px_rgba(0,0,0,.3)]" : "top-[3px] bottom-[3px] rounded-lg",
        )}
      />
      {items.map((it, i) => {
        const on = it.id === value;
        return (
          <button
            key={it.id}
            type="button"
            role={tabs ? "tab" : undefined}
            aria-selected={tabs ? on : undefined}
            aria-pressed={tabs ? undefined : on}
            aria-label={it.ariaLabel}
            title={it.ariaLabel}
            data-on={on}
            tabIndex={tabs && !on ? -1 : 0}
            onClick={() => onChange(it.id)}
            onKeyDown={tabs ? (e) => onKey(e, i) : undefined}
            className={cn(
              "relative z-[1] transition-colors duration-200",
              tabs ? "h-9 rounded-[10px] px-4 text-sm font-medium whitespace-nowrap max-sm:flex-1 max-sm:px-2" : "grid h-[30px] w-[34px] place-items-center rounded-lg",
              on ? "text-text" : "text-text-3 hover:text-text-2",
            )}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
