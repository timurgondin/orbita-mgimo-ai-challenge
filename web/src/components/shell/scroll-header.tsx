"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Шапка: после прокрутки >4px получает полупрозрачный фон, размытие и тонкую линию снизу. */
export function ScrollHeader({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 grid h-[68px] grid-cols-[1fr_auto_1fr] items-center px-4 transition-[background,box-shadow] duration-[250ms] sm:px-7",
        scrolled &&
          "bg-[color-mix(in_srgb,var(--bg)_80%,transparent)] shadow-[0_.5px_0_var(--line)] backdrop-blur-[20px] backdrop-saturate-[1.5]",
      )}
    >
      {children}
    </header>
  );
}
