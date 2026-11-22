"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, FileText } from "lucide-react";
import { Modal } from "@/components/time/modal";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { reviewWork } from "@/server/teach/actions";
import type { ReviewItem } from "@/server/data/teach-types";
import { ReviewRow } from "./review-row";
import { BTN, BTN_SOFT, CHIP, CHIP_OFF, CHIP_ON, FIELD, H2 } from "./ui";

const QUICK = [5, 6, 7, 8, 9, 10];

function ReviewForm({ w, onDone, toast }: { w: ReviewItem; onDone: () => void; toast: (t: string, tone?: "ok" | "error") => void }) {
  const [score, setScore] = useState(w.score != null ? String(w.score).replace(".", ",") : "");
  const [text, setText] = useState(w.feedback ?? "");
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (mode: "grade" | "return") =>
    start(async () => {
      const r = await reviewWork(w.id, mode, score, text);
      if (!r.ok) return toast(r.error, "error");
      toast(r.message);
      onDone();
      router.refresh();
    });

  return (
    <>
      <div className="text-[13px] text-text-3">{w.course}</div>
      <div className="mt-1 text-[26px] leading-[1.15] font-semibold tracking-[-.03em]">{w.task}</div>
      <div className="mt-4 flex items-center gap-3">
        <span aria-hidden="true" className="mono grid size-10 shrink-0 place-items-center rounded-full text-[14px] font-semibold" style={{ background: w.gradient }}>
          {w.initials}
        </span>
        <span className="min-w-0 flex-1">
          <Link href={`/people/${w.login}`} className="block font-medium hover:underline">
            {w.student}
          </Link>
          <small className={cn("text-[13px]", w.late ? "text-urgent" : "text-text-3")}>
            {w.group}, сдано {w.sent}
            {w.late && ", после срока"}
          </small>
        </span>
      </div>
      {w.file && (
        <div className="mt-4 flex items-center gap-3 rounded-[16px] bg-s1 px-3.5 py-3">
          <span className="grid size-9 place-items-center rounded-[11px] bg-s3 text-text-2">
            <FileText size={17} strokeWidth={1.6} />
          </span>
          <span className="min-w-0 flex-1">
            <b className="block truncate text-[15px] font-medium">{w.file.name}</b>
            <small className="text-[13px] text-text-3">{w.file.size}</small>
          </span>
          <button type="button" onClick={() => toast("Файл открыт")} aria-label="Открыть файл" className="grid size-9 place-items-center rounded-full text-text-2 hover:bg-hover hover:text-text">
            <Download size={17} strokeWidth={1.6} />
          </button>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <label htmlFor="rv-score" className="text-sm text-text-2">
          Оценка
        </label>
        <div className="flex items-baseline gap-1">
          <input
            id="rv-score"
            value={score}
            onChange={(e) => setScore(e.target.value)}
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="done"
            placeholder="—"
            className="w-14 rounded-[11px] bg-s1 py-1.5 text-center text-[22px] font-semibold tabular-nums outline-none focus:shadow-[0_0_0_2px_var(--accent)]"
          />
          <span className="text-[15px] text-text-3">/10</span>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-6 gap-1.5" role="group" aria-label="Быстрая оценка">
        {QUICK.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setScore(String(n))}
            aria-pressed={score === String(n)}
            className={cn("h-10 rounded-[12px] text-[15px] font-medium tabular-nums transition-[background,color,transform] active:scale-[.95]", score === String(n) ? "bg-text text-bg" : "bg-s1 text-text-2 hover:bg-s3")}
          >
            {n}
          </button>
        ))}
      </div>
      <label htmlFor="rv-text" className="mt-5 block text-sm text-text-2">
        Комментарий
      </label>
      <textarea id="rv-text" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} className={cn(FIELD, "mt-1.5 min-h-[96px] resize-none")} />
      <div className="mt-5 flex items-center justify-end gap-2 max-sm:flex-col-reverse max-sm:items-stretch">
        <button type="button" disabled={pending} onClick={() => run("return")} className={BTN_SOFT}>
          На доработку
        </button>
        <button type="button" disabled={pending} onClick={() => run("grade")} className={BTN} data-review-grade>
          {w.status === "graded" ? "Изменить оценку" : "Поставить оценку"}
        </button>
      </div>
    </>
  );
}

/** Проверка: фильтр по курсу, «Ждут проверки» (старые сверху) и «Проверены недавно». Работа — в окне по центру. */
export function ReviewView({ courses, waiting, checked }: { courses: { slug: string; title: string; color: string }[]; waiting: ReviewItem[]; checked: ReviewItem[] }) {
  const params = useSearchParams();
  const [course, setCourse] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const { toast, node } = useToast();
  const all = [...waiting, ...checked];
  const shown = all.find((w) => w.id === openId);
  const show = useCallback((id: string) => {
    setOpenId(id);
    setOpen(true);
  }, []);

  // ?work=<id> — сразу открыть работу (так ведёт «Сегодня»); адрес чистим
  const wanted = params.get("work");
  useEffect(() => {
    if (!wanted) return;
    if (all.some((w) => w.id === wanted)) requestAnimationFrame(() => show(wanted));
    window.history.replaceState(null, "", "/study?tab=review");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted]);

  const filter = (list: ReviewItem[]) => (course ? list.filter((w) => w.slug === course) : list);
  const w1 = filter(waiting);
  const c1 = filter(checked);

  return (
    <>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Курс">
        <button type="button" onClick={() => setCourse(null)} aria-pressed={!course} className={cn(CHIP, !course ? CHIP_ON : CHIP_OFF)}>
          Все курсы
        </button>
        {courses.map((c) => (
          <button key={c.slug} type="button" onClick={() => setCourse(c.slug)} aria-pressed={course === c.slug} className={cn(CHIP, course === c.slug ? CHIP_ON : CHIP_OFF)}>
            <i className="size-1.5 rounded-full" style={{ background: `var(--c-${c.color})` }} />
            {c.title}
          </button>
        ))}
      </div>

      <section className="mt-9 max-w-[760px]" aria-label="Ждут проверки">
        <h2 className={cn(H2, "mb-2")}>
          Ждут проверки <span className="text-text-3 tabular-nums">{w1.length}</span>
        </h2>
        {w1.length ? (
          <div className="rows">
            {w1.map((w) => (
              <ReviewRow key={w.id} w={w} onOpen={() => show(w.id)} />
            ))}
          </div>
        ) : (
          <p className="py-3 text-[15px] text-text-3">Всё проверено</p>
        )}
      </section>

      {c1.length > 0 && (
        <section className="mt-12 max-w-[760px]" aria-label="Проверены недавно">
          <h2 className={cn(H2, "mb-2")}>Проверены недавно</h2>
          <div className="rows">
            {c1.map((w) => (
              <ReviewRow key={w.id} w={w} onOpen={() => show(w.id)} />
            ))}
          </div>
        </section>
      )}

      <Modal open={open} onClose={() => setOpen(false)} accent={shown ? `var(--c-${shown.color})` : "var(--accent)"} title={shown?.task ?? "Работа"} width={520}>
        {shown && <ReviewForm key={shown.id} w={shown} toast={toast} onDone={() => setOpen(false)} />}
      </Modal>
      {node}
    </>
  );
}
