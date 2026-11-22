"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Lock } from "lucide-react";
import { Modal } from "@/components/time/modal";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { updatePrivacy } from "@/server/profile/actions";

export interface PrivacyState {
  login: string;
  email: string;
  phone: string | null;
  telegram: string | null;
  showPhone: boolean;
  showTelegram: boolean;
}

const ROW = "-mx-3 flex min-h-[60px] items-center gap-3.5 rounded-[14px] px-3 py-2.5";

export function Switch({ on, label, onClick, disabled }: { on: boolean; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn("relative h-[26px] w-11 shrink-0 rounded-full transition-colors duration-200", on ? "bg-accent" : "bg-s3")}
    >
      <span className={cn("absolute top-[3px] left-[3px] size-5 rounded-full bg-white transition-transform duration-300 ease-spring", on && "translate-x-[18px]")} />
    </button>
  );
}

/** Окно «Приватность»: кто видит контакты в поиске людей. Почта — всегда, телефон и Telegram — переключателями. */
function PrivacyModal({ open, onClose, p, withCardLink }: { open: boolean; onClose: () => void; p: PrivacyState; withCardLink: boolean }) {
  const router = useRouter();
  const [state, setState] = useState({ showPhone: p.showPhone, showTelegram: p.showTelegram });
  const [, start] = useTransition();
  const { toast, node } = useToast();

  const flip = (field: "showPhone" | "showTelegram") => {
    const next = !state[field];
    setState((s) => ({ ...s, [field]: next }));
    start(async () => {
      const r = await updatePrivacy(field, next);
      if (!r.ok) {
        setState((s) => ({ ...s, [field]: !next }));
        return toast("Не получилось сохранить", "error");
      }
      router.refresh();
    });
  };

  const rows: { field: "showPhone" | "showTelegram"; label: string; value: string | null }[] = [
    { field: "showPhone", label: "Телефон", value: p.phone },
    { field: "showTelegram", label: "Telegram", value: p.telegram },
  ];

  return (
    <Modal open={open} onClose={onClose} accent="var(--accent)" cover={false} title="Приватность" width={460}>
      <h2 className="mb-3 text-[22px] font-semibold tracking-[-.025em]">Приватность</h2>
      <div className="rows [--row-inset:12px]" data-privacy-modal>
        <div className={ROW}>
          <span className="min-w-0 flex-1">
            <small className="block text-[13px] text-text-3">Почта</small>
            <b className="block truncate font-medium">{p.email}</b>
          </span>
          <span className="inline-flex items-center gap-1.5 text-[13px] text-text-3">
            <Lock size={13} strokeWidth={1.8} />
            Видят все
          </span>
        </div>
        {rows.map((r) => (
          <label key={r.field} className={cn(ROW, "cursor-pointer hover:bg-hover")} data-privacy={r.field}>
            <span className="min-w-0 flex-1">
              <small className="block text-[13px] text-text-3">{r.label}</small>
              <b className={cn("block truncate font-medium", !r.value && "font-normal text-text-3")}>{r.value ?? "Не указан"}</b>
            </span>
            <span className="text-[13px] text-text-3" aria-hidden="true">
              {state[r.field] ? "Видят все" : "Только мне"}
            </span>
            <Switch on={state[r.field]} label={`${r.label}: показывать в поиске людей`} onClick={() => flip(r.field)} />
          </label>
        ))}
      </div>
      {withCardLink && (
        <Link
          href={`/people/${p.login}`}
          data-my-card
          onClick={onClose}
          className="mt-5 flex h-11 items-center justify-center gap-1.5 rounded-xl bg-s3 text-sm font-semibold transition-[opacity,transform] duration-150 hover:opacity-90 active:scale-[.97]"
        >
          Как меня видят другие
          <ChevronRight size={16} strokeWidth={1.8} />
        </Link>
      )}
      {node}
    </Modal>
  );
}

/** Кнопка, открывающая окно приватности (профиль и своя карточка в поиске людей). */
export function PrivacyButton({ p, withCardLink = false, className, children }: { p: PrivacyState; withCardLink?: boolean; className?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} data-privacy-open>
        {children}
      </button>
      <PrivacyModal open={open} onClose={() => setOpen(false)} p={p} withCardLink={withCardLink} />
    </>
  );
}
