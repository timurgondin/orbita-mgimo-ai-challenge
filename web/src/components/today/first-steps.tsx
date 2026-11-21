"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronRight } from "lucide-react";
import { ContactsForm, DataReview, PhotoPicker } from "@/components/onboarding/tasks";
import { Modal } from "@/components/time/modal";
import { ProgressBar } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";
import type { FirstStep, FirstStepsView } from "@/server/data/first-steps";
import type { StudentCardView } from "@/server/data/types";
import { cn } from "@/lib/utils";

type Dlg = "data" | "photo" | "contacts" | null;
const TITLES: Record<Exclude<Dlg, null>, string> = {
  data: "Проверь свои данные",
  photo: "Фото для Орбита ID",
  contacts: "Телефон и Telegram",
};

/** «Первые шаги» первокурсника: задачи первой недели, отмечаются сами по данным. Данные, фото и контакты — прямо здесь, в окне. */
export function FirstSteps({ view, card }: { view: FirstStepsView; card: StudentCardView }) {
  const { steps } = view;
  const [open, setOpen] = useState<Dlg>(null);
  const [photo, setPhoto] = useState(card.photo);
  const router = useRouter();
  const { toast, node } = useToast();
  const done = steps.filter((s) => s.done).length;

  const finish = (msg: string) => {
    setOpen(null);
    toast(msg);
    router.refresh();
  };

  const row = (s: FirstStep) => {
    const inner = (
      <>
        <span
          className={cn(
            "grid size-[22px] shrink-0 place-items-center rounded-full transition-colors",
            s.done ? "bg-(--accent) text-bg" : "shadow-[inset_0_0_0_1.5px_var(--text-3)]",
          )}
        >
          {s.done && <Check size={14} strokeWidth={2.8} />}
        </span>
        <span className={cn("min-w-0 flex-1 text-[15px]", s.done && "text-text-3")}>{s.title}</span>
        {!s.done && <ChevronRight size={16} strokeWidth={1.6} className="shrink-0 text-text-3" />}
      </>
    );
    const cls = "-mx-3 flex min-h-[52px] w-[calc(100%+24px)] items-center gap-3.5 rounded-[14px] px-3 py-2.5 text-left transition-colors hover:bg-hover";
    return s.id === "data" || s.id === "photo" || s.id === "contacts" ? (
      <button type="button" onClick={() => setOpen(s.id as Exclude<Dlg, null>)} className={cls}>
        {inner}
      </button>
    ) : (
      <Link href={s.href} className={cls}>
        {inner}
      </Link>
    );
  };

  return (
    <section className="mt-14" data-first-steps>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold tracking-[-.02em]">Первые шаги</h2>
        <span className="text-sm text-text-3 tabular-nums">
          {done} из {steps.length}
        </span>
      </div>
      <ProgressBar value={(done / steps.length) * 100} label="Первые шаги" className="h-1" fill="var(--accent)" />
      <ul className="rows mt-2">
        {steps.map((s) => (
          <li key={s.id} data-step={s.id} data-done={s.done ? "" : undefined}>
            {row(s)}
          </li>
        ))}
      </ul>

      <Modal open={open !== null} onClose={() => setOpen(null)} accent="var(--accent)" cover={false} width={440} title={open ? TITLES[open] : ""}>
        {open && (
          <div className="flex flex-col" data-first-step-dialog={open}>
            <h2 className="pr-10 text-[22px] font-semibold tracking-[-.02em]">{TITLES[open]}</h2>
            {open === "data" && <DataReview rows={view.rows} layout="modal" onDone={finish} />}
            {open === "contacts" && <ContactsForm phone={view.phone} telegram={view.telegram} layout="modal" onDone={finish} />}
            {open === "photo" && (
              <PhotoPicker
                initials={card.initials}
                background={card.avatar}
                photo={photo}
                layout="modal"
                onPhoto={(url) => {
                  setPhoto(url);
                  router.refresh();
                }}
                onDone={() => finish("Фото сохранено")}
              />
            )}
          </div>
        )}
      </Modal>
      {node}
    </section>
  );
}
