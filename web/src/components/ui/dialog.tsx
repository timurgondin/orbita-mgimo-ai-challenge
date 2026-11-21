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
  sheet,
  children,
}: {
  /** Телефон: "full" — шторка сразу во весь рост (длинные списки, чат); иначе — по содержимому */
  sheet?: "full";
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
      d.style.translate = "";
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

  // Телефон: шторку смахивают вниз — с любого места, если содержимое прокручено к началу (как в iOS)
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const phone = matchMedia("(max-width: 639.98px)");
    let x0 = 0, y0 = 0, lastY = 0, lastT = 0, v = 0;
    let state: "idle" | "maybe" | "drag" = "idle";
    const atTop = (t: EventTarget | null) => {
      for (let el = t as HTMLElement | null; el && el !== d; el = el.parentElement) {
        if (el.scrollTop > 0) return false;
      }
      return true;
    };
    const start = (e: TouchEvent) => {
      state = "idle";
      if (!phone.matches || e.touches.length !== 1) return;
      if ((e.target as Element).closest("input, textarea, select, [contenteditable]")) return;
      if (!atTop(e.target)) return;
      state = "maybe";
      x0 = e.touches[0].clientX;
      y0 = lastY = e.touches[0].clientY;
      lastT = e.timeStamp;
      v = 0;
    };
    const move = (e: TouchEvent) => {
      if (state === "idle") return;
      const t = e.touches[0];
      const dy = t.clientY - y0;
      if (state === "maybe") {
        // вверх или вбок — обычная прокрутка
        if (dy <= 0 || Math.abs(t.clientX - x0) > dy) {
          state = "idle";
          return;
        }
        state = "drag";
        d.setAttribute("data-dragging", "");
      }
      e.preventDefault();
      v = (t.clientY - lastY) / Math.max(1, e.timeStamp - lastT);
      lastY = t.clientY;
      lastT = e.timeStamp;
      d.style.translate = `0 ${Math.max(0, dy)}px`;
    };
    const end = () => {
      if (state !== "drag") return (state = "idle");
      state = "idle";
      const dy = lastY - y0;
      d.removeAttribute("data-dragging");
      if (dy > Math.min(140, d.offsetHeight * 0.3) || (dy > 24 && v > 0.45)) {
        // уезжает вниз с того места, где отпустили; сброс — при следующем открытии
        d.style.translate = "0 100%";
        closeRef.current();
      } else d.style.translate = "";
    };
    d.addEventListener("touchstart", start, { passive: true });
    d.addEventListener("touchmove", move, { passive: false });
    d.addEventListener("touchend", end);
    d.addEventListener("touchcancel", end);
    return () => {
      d.removeEventListener("touchstart", start);
      d.removeEventListener("touchmove", move);
      d.removeEventListener("touchend", end);
      d.removeEventListener("touchcancel", end);
    };
  }, []);

  return (
    <dialog
      ref={ref}
      data-sheet={sheet}
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
