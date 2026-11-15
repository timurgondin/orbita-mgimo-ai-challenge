"use client";

import { useState, useTransition } from "react";
import { Minus, Paperclip, Plus } from "lucide-react";
import { MAX_COPIES, MAX_COMMENT, PAPER, type RequestType } from "@/lib/office-catalog";
import { createRequest } from "@/server/office/actions";
import type { Toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { ghostBtn, whiteBtn } from "./icons";

function Chips({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (v: string) => void }) {
  return (
    <div className="mt-5">
      <div className="mb-2 text-sm text-text-2">{label}</div>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={value === o}
            onClick={() => onChange(o)}
            className={cn(
              "h-[38px] rounded-[12px] px-3.5 text-sm font-medium transition-[background,color,transform] duration-150 active:scale-[.96]",
              value === o ? "bg-text text-bg" : "bg-s1 text-text-2 hover:text-text",
            )}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

export function FormContent({ type, toast, onClose }: { type: RequestType; toast: Toast; onClose: () => void }) {
  const cert = type.kind === "cert";
  const [purpose, setPurpose] = useState(type.defaults.purpose ?? "");
  const [lang, setLang] = useState(type.defaults.lang ?? "");
  const [format, setFormat] = useState(type.defaults.format ?? "");
  const [copies, setCopies] = useState(1);
  const [subject, setSubject] = useState(type.defaults.subject ?? "");
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const paper = format === PAPER;

  const submit = () =>
    start(async () => {
      const params = cert ? { purpose, lang, format, copies: paper ? copies : 1 } : { subject, comment };
      const r = await createRequest(type.id, params);
      if (r.ok) setSent(r.number ?? "");
      else toast(r.error, "error");
    });

  if (sent !== null) {
    return (
      <div className="flex flex-col items-center px-0 pt-7 pb-2 text-center">
        <span className="ck-pop grid size-[72px] place-items-center rounded-full bg-[color-mix(in_srgb,var(--st-green)_16%,transparent)]">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--st-green)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="size-[34px]">
            <path className="ck-path" d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
        <h3 className="mt-[18px] text-2xl font-semibold tracking-[-.03em]">Заявка отправлена</h3>
        <p className="mt-1 text-[15px] text-text-2">
          {type.title} · {sent}
        </p>
        <button type="button" onClick={onClose} className={cn(ghostBtn, "mt-[22px]")}>
          Готово
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="text-sm text-text-2">{cert ? "Справка" : "Заявление"}</div>
      <div className="mt-1 pr-10 text-[26px] leading-[1.15] font-semibold tracking-[-.03em]">{type.title}</div>
      {cert ? (
        <>
          <Chips label="Куда" value={purpose} options={type.purposes!} onChange={setPurpose} />
          <Chips label="Язык" value={lang} options={type.langs!} onChange={setLang} />
          <Chips label="Формат" value={format} options={type.formats!} onChange={setFormat} />
          {paper && (
            <div className="mt-5">
              <div className="mb-2 text-sm text-text-2">Экземпляров</div>
              <div className="inline-flex items-center gap-1 rounded-[12px] bg-s1 p-1">
                <button type="button" aria-label="Меньше" onClick={() => setCopies((c) => Math.max(1, c - 1))} className="grid h-[30px] w-8 place-items-center rounded-[9px] text-text-2 hover:bg-s3 hover:text-text">
                  <Minus size={16} strokeWidth={1.6} />
                </button>
                <b className="min-w-7 text-center font-semibold">{copies}</b>
                <button type="button" aria-label="Больше" onClick={() => setCopies((c) => Math.min(MAX_COPIES, c + 1))} className="grid h-[30px] w-8 place-items-center rounded-[9px] text-text-2 hover:bg-s3 hover:text-text">
                  <Plus size={16} strokeWidth={1.6} />
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <Chips label={type.subjectLabel ?? ""} value={subject} options={type.subjects!} onChange={setSubject} />
          <div className="mt-5">
            <label htmlFor="req-comment" className="mb-2 block text-sm text-text-2">
              Комментарий
            </label>
            <textarea
              id="req-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={MAX_COMMENT}
              placeholder="Причина"
              className="min-h-[76px] w-full resize-none rounded-[14px] bg-s1 px-3.5 py-3 text-[15px] text-text outline-none placeholder:text-text-3 focus:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_60%,transparent),0_0_0_4px_color-mix(in_srgb,var(--accent)_14%,transparent)]"
            />
          </div>
          <div className="mt-5">
            <div className="mb-2 text-sm text-text-2">Файлы</div>
            <button type="button" onClick={() => toast("Вложения появятся позже", "error")} className={ghostBtn}>
              <Paperclip size={15} strokeWidth={1.6} />
              Прикрепить
            </button>
          </div>
        </>
      )}
      <div className="mt-[26px] flex items-center justify-between gap-3 border-t-[.5px] border-line pt-5">
        <div className="text-sm text-text-3">
          <b className="block text-[15px] font-semibold text-text">{type.eta}</b>
          {cert ? (paper ? "Получение в окне 3" : "Придёт сюда и на почту") : "Решение придёт уведомлением"}
        </div>
        <button type="button" disabled={pending} onClick={submit} className={whiteBtn}>
          Отправить
        </button>
      </div>
    </>
  );
}
