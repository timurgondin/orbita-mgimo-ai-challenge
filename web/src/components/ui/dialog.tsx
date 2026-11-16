"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Модальное окно на нативном <dialog> + showModal(): фокус, Esc, inert-фон, возврат фокуса и верхний слой — у браузера.
 * Клик по фону закрывает (closedby="any"; в Safari — запасной обработчик). Анимации — класс .dlg в globals.css.
 */
export function Dialog({
  open,
  onClose,
  label,
  className,
  style,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open) {
      d.removeAttribute("data-closing");
      if (!d.open) d.showModal();
    } else if (d.open) {
      closeTopLayer(d);
    }
  }, [open]);

  // closedby есть не везде (нет в Safari): закрыть, если нажали и отпустили за пределами окна
  useEffect(() => {
    const d = ref.current;
    if (!d || "closedBy" in HTMLDialogElement.prototype) return;
    const outside = (e: PointerEvent) => {
      const r = d.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    let pressedOutside = false;
    const down = (e: PointerEvent) => (pressedOutside = outside(e));
    const up = (e: PointerEvent) => pressedOutside && outside(e) && onClose();
    d.addEventListener("pointerdown", down);
    d.addEventListener("pointerup", up);
    return () => {
      d.removeEventListener("pointerdown", down);
      d.removeEventListener("pointerup", up);
    };
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      {...({ closedby: "any" } as object)}
      // Esc, жест «назад», клик по фону: закрываем через состояние, чтобы сыграла анимация
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // браузер мог закрыть и без cancel (повторный Esc без активации) — синхронизируем состояние
      onClose={() => open && onClose()}
      style={style}
      className={cn("dlg", className)}
    >
      {children}
    </dialog>
  );
}

let displayTransitions: boolean | undefined;
/** Умеет ли браузер анимировать display (Firefox разбирает allow-discrete, но не анимирует). */
function canTransitionDisplay() {
  if (displayTransitions !== undefined) return displayTransitions;
  if (!CSS.supports("transition-behavior", "allow-discrete")) return (displayTransitions = false);
  const probe = document.createElement("div");
  probe.style.cssText = "transition: display 1s allow-discrete !important; display: block;";
  document.body.appendChild(probe);
  void getComputedStyle(probe).display;
  probe.style.display = "none";
  displayTransitions = getComputedStyle(probe).display === "block";
  probe.remove();
  return displayTransitions;
}

/** Закрыть с анимацией. Где нет overlay/display-переходов — сначала доиграть выход по data-closing. */
async function closeTopLayer(d: HTMLDialogElement) {
  if (!(CSS.supports("overlay", "auto") && canTransitionDisplay())) {
    d.setAttribute("data-closing", "");
    // только переходы самого окна и его фона: у содержимого бывают бесконечные анимации
    const own = d.getAnimations({ subtree: true }).filter((a) => (a.effect as KeyframeEffect | null)?.target === d);
    if (own.length) {
      await Promise.race([Promise.allSettled(own.map((a) => a.finished)), new Promise((r) => setTimeout(r, 600))]);
    }
    if (!d.hasAttribute("data-closing")) return; // успели открыть заново
    d.removeAttribute("data-closing");
  }
  d.close();
}
