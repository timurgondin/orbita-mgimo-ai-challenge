"use client";

import { useCallback, useState } from "react";
import { BadgeCheck } from "lucide-react";
import { Modal } from "@/components/time/modal";
import type { StudentCardView } from "@/server/data/types";
import { OrbitaQr } from "./orbita-qr";

/** Окно студенческого: QR на публичную проверку и минимум данных. */
export function StudentCardModal({ card, open, onClose }: { card: StudentCardView; open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} accent="var(--accent)" cover={false} width={380} title="Студенческий билет">
      <div className="flex flex-col items-center pt-6 pb-1 text-center" data-student-card>
        <OrbitaQr initial={card} active={open} className="p-3.5 [&_svg]:size-[208px] max-sm:[&_svg]:size-[184px]" />
        <b className="mt-5 block text-[22px] font-semibold tracking-[-.03em]">{card.name}</b>
        <span className="mt-0.5 text-[15px] text-text-2">{card.meta}</span>
        <span className="mt-4 text-sm text-text-3 tabular-nums">Студенческий № {card.number}</span>
        <span className="mt-1.5 inline-flex items-center gap-1.5 text-[13.5px] text-(--st-green)">
          <BadgeCheck size={15} strokeWidth={1.8} />
          Действителен до {card.validUntil}
        </span>
      </div>
    </Modal>
  );
}

/** Кнопка (или плитка), открывающая окно студенческого. */
export function StudentCardButton({
  card,
  className,
  children,
}: {
  card: StudentCardView;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} data-open-card>
        {children}
      </button>
      <StudentCardModal card={card} open={open} onClose={close} />
    </>
  );
}
