"use client";

import { X } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Модалка по центру на размытом фоне (нативный <dialog>, см. ui/dialog). Содержимое остаётся в DOM на время закрытия, чтобы не мигало. */
export function Modal({
  open,
  onClose,
  accent,
  cover = true,
  width = 480,
  title,
  closeButton = true,
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
  /** false — своя кнопка закрытия в шапке содержимого (чтобы стояла в одну линию с заголовком и действиями) */
  closeButton?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      label={title}
      style={{ "--cc": accent, "--mw": `${width}px` } as React.CSSProperties}
      className="max-h-[min(740px,calc(100dvh-48px))] w-[min(var(--mw),calc(100vw-32px))] flex-col overflow-hidden rounded-[28px] open:flex"
    >
      {closeButton && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute top-3.5 right-3.5 z-[2] grid size-8 place-items-center rounded-full bg-black/25 text-text hover:bg-black/40"
        >
          <X size={16} strokeWidth={1.6} />
        </button>
      )}
      {/* телефон: обложка уезжает вместе с содержимым (прокручивается вся шторка), на компьютере — стоит на месте */}
      <div data-cover={cover || undefined} className="modal-scroll flex min-h-0 flex-1 flex-col max-sm:overflow-auto max-sm:overscroll-contain">
        {cover && <div className="modal-cover" />}
        <div className={cn("flex-1 overflow-auto bg-s2 px-6 pb-6 max-sm:flex-none max-sm:overflow-visible", cover ? "pt-5" : "pt-6")}>{children}</div>
      </div>
    </Dialog>
  );
}
