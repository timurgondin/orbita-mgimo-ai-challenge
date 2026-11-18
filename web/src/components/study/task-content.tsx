"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, CalendarClock, Check, ChevronRight, FileText, MapPin, Target, Upload, X } from "lucide-react";
import type { Toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { TaskDetail } from "@/server/data/types";
import { attachFile, removeFile, submitWork, withdrawWork } from "@/server/study/actions";
import { StatusTag } from "./status-tag";

/** Текст: абзацы через пустую строку, строки с «- » — пункты списка. */
export function Description({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-2.5 text-[15px] leading-relaxed text-text-2">
      {text.split(/\n\s*\n/).map((block, i) => {
        const lines = block.split("\n");
        return lines.every((l) => l.startsWith("- ")) ? (
          <ul key={i} className="flex flex-col gap-1">
            {lines.map((l) => (
              <li key={l} className="flex gap-2.5 before:mt-[11px] before:size-1 before:shrink-0 before:rounded-full before:bg-text-3 before:content-['']">
                {l.slice(2)}
              </li>
            ))}
          </ul>
        ) : (
          <p key={i}>{block}</p>
        );
      })}
    </div>
  );
}

export const IconBox = ({ children }: { children: React.ReactNode }) => (
  <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-s3 text-text-2">{children}</span>
);

export function InfoRow({ icon, title, sub, href }: { icon: React.ReactNode; title: React.ReactNode; sub?: React.ReactNode; href?: string }) {
  const inner = (
    <>
      {icon}
      <span className="min-w-0 flex-1">
        <b className="block font-medium">{title}</b>
        {sub && <small className="text-[13px] text-text-3">{sub}</small>}
      </span>
      {href && <ChevronRight size={16} strokeWidth={1.6} className="text-text-3" />}
    </>
  );
  const cls = "flex items-center gap-3.5 border-t-[.5px] border-line py-3 first:border-t-0";
  return href ? (
    <Link href={href} className={cn(cls, "-mx-2 rounded-xl px-2 transition-colors duration-150 hover:bg-hover")}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

/** Трекер этапов «как у посылки» (как у заявок в «Офисе»). */
function Steps({ steps }: { steps: NonNullable<TaskDetail["steps"]> }) {
  return (
    <div className="grid grid-cols-4" aria-label="Этапы">
      {steps.map((s) => (
        <span key={s.label} className="flex flex-col gap-2">
          <span className="mr-1 block h-1 overflow-hidden rounded bg-s3">
            <i className={cn("block h-full rounded bg-text", s.state === "fin" ? "w-full" : s.state === "cur" ? "step-cur" : "w-0")} />
          </span>
          <b className={cn("text-[13px] font-medium", s.state === "todo" ? "text-text-3" : "text-text")}>{s.label}</b>
          <small className="-mt-1.5 min-h-4 text-xs text-text-3">{s.when}</small>
        </span>
      ))}
    </div>
  );
}

const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt,.jpg,.jpeg,.png,.r,.py,.ipynb";

function FileChip({ name, size, children }: { name: string; size: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-s2 px-3.5 py-3">
      <FileText size={20} strokeWidth={1.5} className="shrink-0 text-text-2" />
      <span className="min-w-0 flex-1">
        <b className="block truncate text-[15px] font-medium">{name}</b>
        <small className="text-[13px] text-text-3">{size}</small>
      </span>
      {children}
    </div>
  );
}

/**
 * Сдача работы в два шага: прикрепить файл (черновик) → «Отправить на проверку». Пока не начали проверять — «Отозвать».
 * В прототипе файл не уходит на сервер: сохраняются только имя и размер.
 */
function Submit({ t, toast }: { t: TaskDetail; toast: Toast }) {
  const [drag, setDrag] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  const run = (action: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>) =>
    start(async () => {
      const r = await action();
      toast(r.ok ? r.message : r.error, r.ok ? "ok" : "error");
      if (r.ok) router.refresh();
    });
  const pick = (f?: File | null) => {
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) return toast("Файл больше 20 МБ", "error");
    run(() => attachFile(t.id, { name: f.name, size: f.size }));
  };

  if (t.file) {
    const draft = t.canSubmit;
    return (
      <div className="flex flex-col gap-2.5" data-upload>
        <FileChip name={t.file.name} size={draft ? `${t.file.size}, ещё не отправлен` : t.submittedAt ? `${t.file.size}, отправлен ${t.submittedAt}` : t.file.size}>
          {draft && (
            <button type="button" aria-label="Убрать файл" disabled={pending} onClick={() => run(() => removeFile(t.id))} className="grid size-8 place-items-center rounded-[9px] text-text-3 hover:bg-s3 hover:text-text">
              <X size={16} strokeWidth={1.6} />
            </button>
          )}
          {t.canWithdraw && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => withdrawWork(t.id))}
              className="h-8 rounded-[9px] bg-s3 px-3 text-[13px] font-medium transition-colors hover:bg-hover disabled:opacity-50"
            >
              Отозвать
            </button>
          )}
        </FileChip>
        {draft && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => submitWork(t.id))}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[13px] bg-text text-[15px] font-semibold text-bg transition-[opacity,transform] duration-150 hover:opacity-90 active:scale-[.98] disabled:opacity-60"
          >
            {pending ? "Отправляю…" : "Отправить на проверку"}
          </button>
        )}
      </div>
    );
  }
  if (!t.canAttach) return null;

  return (
    <label
      data-upload
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        pick(e.dataTransfer.files[0]);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border border-dashed px-4 py-6 text-center transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent",
        drag ? "border-accent bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]" : "border-line bg-s2/40 hover:bg-s2",
        pending && "pointer-events-none opacity-60",
      )}
    >
      <Upload size={20} strokeWidth={1.6} className="text-text-2" />
      <b className="text-[15px] font-medium">{pending ? "Прикрепляю…" : "Выбрать файл или перетащить сюда"}</b>
      <small className="text-[13px] text-text-3">PDF, документ, таблица или архив, до 20 МБ</small>
      <input type="file" accept={ACCEPT} className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
    </label>
  );
}

/** Окно задания: срок и сколько осталось, этапы, что сделать, сдача файла, оценка и отзыв. */
export function TaskContent({ t, toast, showCourse = true }: { t: TaskDetail; toast: Toast; showCourse?: boolean }) {
  return (
    <>
      <div className="text-sm text-text-2">{t.kindLabel}</div>
      <div className="mt-1 text-[26px] leading-[1.15] font-semibold tracking-[-.03em]">{t.title}</div>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
        {t.tag && <StatusTag status={t.tag} />}
        {t.left && <span className={cn("text-sm", t.dueHot ? "text-urgent" : "text-text-2")}>Осталось {t.left}</span>}
      </div>

      {t.done && (
        <div className="mt-5 flex items-end gap-3">
          {t.score != null ? (
            <>
              <b className="text-[44px] leading-none font-medium tracking-[-.035em] tabular-nums">{t.score}</b>
              <span className="pb-1 text-[15px] text-text-2">из 10{t.gradedAt && `, проверено ${t.gradedAt}`}</span>
            </>
          ) : (
            <span className="inline-flex items-center gap-2 text-[17px] font-medium">
              <Check size={20} strokeWidth={1.8} />
              Выполнено{t.gradedAt && <span className="text-[15px] font-normal text-text-2">, отмечено {t.gradedAt}</span>}
            </span>
          )}
        </div>
      )}
      {t.feedback && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl bg-s2 px-4 py-3.5">
          <span className="mono mt-px grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold" style={{ background: t.teacher.gradient }}>
            {t.teacher.initials}
          </span>
          <span className="min-w-0">
            <small className="block text-[13px] text-text-3">{t.teacher.name}</small>
            <span className="text-[15px]">{t.feedback}</span>
          </span>
        </div>
      )}

      {t.steps && !t.done && (
        <div className="mt-5">
          <Steps steps={t.steps} />
        </div>
      )}

      {t.description && (
        <section className="mt-6">
          <h3 className="mb-2 text-[15px] font-semibold">{t.done ? "Задание" : "Что сделать"}</h3>
          <Description text={t.description} />
        </section>
      )}

      {t.upload && (t.canAttach || t.file) && (
        <section className="mt-6" aria-label="Сдача работы">
          <h3 className="mb-2 text-[15px] font-semibold">{t.canAttach ? "Сдать работу" : "Отправленный файл"}</h3>
          <Submit t={t} toast={toast} />
        </section>
      )}

      <div className="mt-5">
        {t.dueLong && <InfoRow icon={<IconBox><CalendarClock size={16} strokeWidth={1.6} /></IconBox>} title={t.dueLong} sub={t.kind === "prep" ? "Занятие" : "Срок сдачи"} />}
        <InfoRow
          icon={<IconBox><Target size={16} strokeWidth={1.6} /></IconBox>}
          title={t.counts ?? "Не сдаётся и не оценивается"}
          sub={t.counts ? undefined : "Подготовка к занятию"}
        />
        {t.room && (
          <InfoRow
            icon={<IconBox><MapPin size={16} strokeWidth={1.6} /></IconBox>}
            title={`Аудитория ${t.room}`}
            sub={t.eventId ? "Открыть в расписании" : undefined}
            href={t.eventId ? `/time?open=${t.eventId}` : undefined}
          />
        )}
        {showCourse && (
          <InfoRow icon={<IconBox><BookOpen size={16} strokeWidth={1.6} /></IconBox>} title={t.courseTitle} sub="Страница курса" href={`/study/${t.courseSlug}`} />
        )}
      </div>
    </>
  );
}
