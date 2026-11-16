"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";

export type Toast = (text: string, tone?: "ok" | "error") => void;

/**
 * Тост внизу по центру: `const { toast, node } = useToast()`, `node` — в разметку.
 * popover="manual": живёт в верхнем слое, поэтому виден и поверх открытой модалки. Анимация — .toast в globals.css.
 */
export function useToast() {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // озвучка: ariaNotify, где есть; иначе — живой регион
  useEffect(() => {
    if (!("ariaNotify" in document)) ref.current?.setAttribute("role", "status");
  }, []);

  const toast: Toast = useCallback((text, tone = "ok") => {
    setState({ text, tone });
    const el = ref.current;
    if (el) {
      // показать заново — так тост встаёт поверх окон, открытых после него
      if (el.matches(":popover-open")) el.hidePopover();
      el.showPopover();
    }
    (document as Document & { ariaNotify?: (s: string) => void }).ariaNotify?.(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => ref.current?.hidePopover(), 2400);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const node = (
    <div
      ref={ref}
      popover="manual"
      className="toast pointer-events-none items-center gap-2 rounded-[14px] bg-text px-[18px] py-3 text-sm font-medium whitespace-nowrap text-bg open:flex max-sm:bottom-24"
    >
      {state?.tone === "error" ? <CircleAlert size={16} strokeWidth={1.8} /> : <CircleCheck size={16} strokeWidth={1.8} />}
      {state?.text}
    </div>
  );
  return { toast, node };
}
