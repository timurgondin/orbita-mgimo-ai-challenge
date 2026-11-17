"use client";

import { useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarRange, GraduationCap, Stamp, Sun, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAssistant } from "@/components/assistant/assistant";
import { Orb } from "./orb";

interface Tab {
  href: string;
  label: string;
  icon: LucideIcon;
}

const LEFT_TABS: Tab[] = [
  { href: "/", label: "Сегодня", icon: Sun },
  { href: "/study", label: "Учёба", icon: GraduationCap },
];
const RIGHT_TABS: Tab[] = [
  { href: "/time", label: "Время", icon: CalendarRange },
  { href: "/office", label: "Офис", icon: Stamp },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function Dock() {
  const pathname = usePathname();
  const dockRef = useRef<HTMLElement>(null);
  const indRef = useRef<HTMLSpanElement>(null);
  const assistant = useAssistant();

  const place = useCallback((animate: boolean) => {
    const ind = indRef.current;
    const active = dockRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!ind) return;
    ind.style.transition = animate ? "" : "none";
    ind.style.left = `${active?.offsetLeft ?? 0}px`;
    ind.style.width = `${active?.offsetWidth ?? 0}px`;
  }, []);

  // Смена страницы — индикатор плавно переезжает
  useEffect(() => {
    place(true);
  }, [pathname, place]);

  // Первая отрисовка, загрузка шрифта, смена ширины (иконки на мобильных) — без анимации
  useEffect(() => {
    place(false);
    const dock = dockRef.current;
    if (!dock) return;
    const ro = new ResizeObserver(() => place(false));
    ro.observe(dock);
    document.fonts?.ready.then(() => place(false));
    return () => ro.disconnect();
  }, [place]);

  const renderTab = ({ href, label, icon: Icon }: Tab) => {
    const active = isActive(pathname, href);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        aria-label={label}
        className={cn(
          "relative z-[1] flex h-[38px] items-center gap-[7px] rounded-full px-4 text-[13.5px] font-medium tracking-[-.01em] transition-colors duration-200 max-sm:px-3",
          active ? "text-text" : "text-text-3 hover:text-text-2",
        )}
      >
        <Icon size={15} strokeWidth={1.6} />
        <span className="max-sm:sr-only">{label}</span>
      </Link>
    );
  };

  return (
    <nav
      ref={dockRef}
      aria-label="Основная навигация"
      className="relative flex h-12 items-center rounded-full bg-dock-bg p-[5px] shadow-[0_0_0_.5px_var(--dock-ring),inset_0_.5px_0_var(--dock-hi),var(--shadow)] backdrop-blur-[28px] backdrop-saturate-[1.7]"
    >
      <span
        ref={indRef}
        aria-hidden="true"
        className="absolute top-[5px] bottom-[5px] left-0 w-0 rounded-full bg-dock-ind shadow-[inset_0_.5px_0_var(--dock-hi)] transition-[left,width] duration-500 ease-spring"
      />
      {LEFT_TABS.map(renderTab)}
      <button
        type="button"
        onClick={assistant.open}
        aria-haspopup="dialog"
        aria-label="Спросить Орбиту (Ctrl K)"
        title="Спросить Орбиту (Ctrl K)"
        className="group relative z-[1] grid h-[38px] w-[68px] place-items-center rounded-full after:absolute after:top-[calc(100%+16px)] after:text-[11px] after:whitespace-nowrap after:text-text-3 after:opacity-0 after:transition-opacity after:duration-200 after:content-['Ctrl_K'] hover:after:opacity-100 focus-visible:after:opacity-100 max-sm:w-[60px]"
      >
        <span className="absolute top-1/2 left-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-bg shadow-[0_0_0_.5px_var(--dock-ring),var(--orb-ring-shadow)]">
          <Orb size={44} className="group-hover:scale-[1.08]" />
        </span>
      </button>
      {RIGHT_TABS.map(renderTab)}
    </nav>
  );
}
