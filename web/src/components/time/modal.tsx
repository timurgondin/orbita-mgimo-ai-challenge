"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Модалка по центру на размытом фоне. Содержимое остаётся в DOM на время закрытия, чтобы не мигало. */
export function Modal({
  open,
  onClose,
  accent,
  cover = true,
  width = 480,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** CSS-цвет обложки */
  accent: string;
  cover?: boolean;
  /** Ширина панели, px */
  width?: number;
  title: string;
  children: React.ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      if (e.key !== "Tab" || !panel.current) return;
      const f = [...panel.current.querySelectorAll<HTMLElement>("button:not([disabled]),textarea,select,a[href]")];
      if (!f.length) return;
      const [a, z] = [f[0], f[f.length - 1]];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className={cn(
          "fixed inset-0 z-40 bg-[rgba(10,10,12,.45)] backdrop-blur-[10px] backdrop-saturate-[1.2] transition-opacity duration-300 ease-soft",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-hidden={!open}
        inert={!open}
        style={{ "--cc": accent, "--mw": `${width}px` } as React.CSSProperties}
        className={cn(
          "fixed top-1/2 left-1/2 z-41 flex max-h-[min(740px,calc(100dvh-48px))] w-[min(var(--mw),calc(100vw-32px))] flex-col overflow-hidden rounded-[28px] bg-s2 shadow-[0_0_0_.5px_var(--line),0_40px_100px_-24px_rgba(0,0,0,.85)] transition-[opacity,transform] duration-[220ms,450ms] ease-[var(--ease),var(--spring)]",
          open ? "-translate-x-1/2 -translate-y-1/2 scale-100 opacity-100" : "pointer-events-none -translate-x-1/2 -translate-y-[48%] scale-[.96] opacity-0",
        )}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute top-3.5 right-3.5 z-[2] grid size-8 place-items-center rounded-full bg-black/25 text-text hover:bg-black/40"
        >
          <X size={16} strokeWidth={1.6} />
        </button>
        {cover && <div className="modal-cover" />}
        <div className={cn("flex-1 overflow-auto px-6 pb-6", cover ? "pt-5" : "pt-6")}>{children}</div>
      </div>
    </>
  );
}
