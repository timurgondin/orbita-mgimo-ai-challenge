"use client";

import { useEffect, useRef } from "react";

/**
 * Шапка: когда страницу прокрутили, получает полупрозрачный фон, размытие и тонкую линию снизу (.topbar[data-stuck] в globals.css).
 * Состояние — по IntersectionObserver на нулевой метке в самом верху страницы: без слушателя прокрутки и одинаково во всех браузерах.
 * Раньше был CSS scroll-state(stuck): у части пользователей шапка «моргала» — состояние дёргалось при отскоке прокрутки
 * (трекпад, iOS) и при перерисовке страницы под размытием. Метка не уходит из вида при отскоке, поэтому состояние не дребезжит.
 */
export function ScrollHeader({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const mark = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    const m = mark.current;
    if (!el || !m) return;
    const io = new IntersectionObserver(([e]) => el.toggleAttribute("data-stuck", !e.isIntersecting));
    io.observe(m);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <span ref={mark} aria-hidden="true" className="pointer-events-none absolute top-0 left-0 h-2 w-px" />
      <header ref={ref} className="topbar sticky top-0 z-30">
        <div className="topbar-bar grid h-[68px] grid-cols-[1fr_auto_1fr] items-center px-4 max-sm:flex max-sm:justify-between max-sm:h-[calc(60px+env(safe-area-inset-top))] max-sm:pt-[env(safe-area-inset-top)] max-sm:pr-3 sm:px-7">{children}</div>
      </header>
    </>
  );
}
