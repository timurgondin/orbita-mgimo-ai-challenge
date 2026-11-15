"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export type Toast = (text: string, tone?: "ok" | "error") => void;

/** Тост внизу по центру: `const { toast, node } = useToast()`, `node` — в разметку. */
export function useToast() {
  const [state, setState] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toast: Toast = useCallback((text, tone = "ok") => {
    setState({ text, tone });
    setOn(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOn(false), 2400);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const node = (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-none fixed bottom-7 left-1/2 z-50 flex items-center gap-2 rounded-[14px] bg-text px-[18px] py-3 text-sm font-medium whitespace-nowrap text-bg transition-[opacity,transform] duration-[250ms,400ms] ease-[var(--ease),var(--spring)] max-sm:bottom-24",
        on ? "-translate-x-1/2 translate-y-0 opacity-100" : "-translate-x-1/2 translate-y-5 opacity-0",
      )}
    >
      {state?.tone === "error" ? <CircleAlert size={16} strokeWidth={1.8} /> : <CircleCheck size={16} strokeWidth={1.8} />}
      {state?.text}
    </div>
  );
  return { toast, node };
}
