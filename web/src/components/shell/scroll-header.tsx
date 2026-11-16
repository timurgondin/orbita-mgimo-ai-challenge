"use client";

import { useEffect, useRef } from "react";

/**
 * Шапка: когда прилипла к верху (страницу прокрутили), получает полупрозрачный фон, размытие и тонкую линию снизу.
 * Состояние — CSS-запрос @container topbar scroll-state(stuck: top) (.topbar в globals.css), без слушателя прокрутки.
 * Где scroll-state нет — запасной путь: атрибут data-stuck по прокрутке.
 */
export function ScrollHeader({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || CSS.supports("container-type", "scroll-state")) return;
    const onScroll = () => el.toggleAttribute("data-stuck", window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header ref={ref} className="topbar sticky top-0 z-30">
      <div className="topbar-bar grid h-[68px] grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-7">{children}</div>
    </header>
  );
}
