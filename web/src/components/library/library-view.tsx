"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Check, ChevronRight, Clock3, QrCode, RotateCw, ScanLine } from "lucide-react";
import { StudentCardModal } from "@/components/profile/student-card";
import { ProgressBar } from "@/components/ui/progress";
import { useToast, type Toast } from "@/components/ui/toast";
import { plural } from "@/lib/phrases";
import { cn } from "@/lib/utils";
import { cancelHold, holdBook, renewLoan } from "@/server/library/actions";
import type { BookCard, LibraryData, LoanView, StudentCardView } from "@/server/data/types";

const H2 = "mb-3 text-lg font-semibold tracking-[-.02em]";
const ACT = "inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-s2 px-3 text-[13px] font-medium whitespace-nowrap transition-colors hover:bg-s3 disabled:opacity-45";

/** Обложка: цвет курса и точечный узор, название — набором. Настоящих обложек нет: книги вымышленные. */
export function Cover({ b, className }: { b: Pick<BookCard, "title" | "author" | "color">; className?: string }) {
  return (
    <span
      aria-hidden="true"
      style={{ "--cc": `var(--c-${b.color})` } as React.CSSProperties}
      className={cn(
        "book-cover relative flex aspect-[2/3] shrink-0 flex-col justify-between overflow-hidden rounded-[6px_10px_10px_6px] p-[9%] text-left shadow-[0_8px_20px_-10px_rgba(0,0,0,.6)]",
        className,
      )}
    >
      <b className="relative line-clamp-4 text-[length:var(--fs,11px)] leading-[1.15] font-semibold tracking-[-.01em] text-white">{b.title}</b>
      <small className="relative line-clamp-2 text-[length:calc(var(--fs,11px)*.8)] leading-tight text-white/70">{b.author}</small>
    </span>
  );
}

function useRun(toast: Toast) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>) =>
    start(async () => {
      const r = await fn();
      toast(r.ok ? r.message : r.error, r.ok ? "ok" : "error");
      if (r.ok) router.refresh();
    });
  return { pending, run };
}

function LoanRow({ l, toast }: { l: LoanView; toast: Toast }) {
  const { pending, run } = useRun(toast);
  return (
    <div data-loan={l.book.slug} className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-x-4 py-3.5 max-sm:grid-cols-[48px_minmax(0,1fr)]">
      <Cover b={l.book} className="w-14 [--fs:7px] max-sm:w-12" />
      <span className="min-w-0">
        <b className="block truncate font-medium">{l.book.title}</b>
        <small className="block truncate text-[13px] text-text-3">
          {l.book.author}, {l.kindLabel.toLowerCase()}
        </small>
        <span className={cn("mt-1 flex items-center gap-1.5 text-[13px]", l.hot ? "font-medium text-urgent" : "text-text-2")}>
          <Clock3 size={13} strokeWidth={1.8} />
          {l.due}
        </span>
        {l.kind === "short" && (
          <ProgressBar value={l.elapsed} label="Прошло срока" fill={l.hot ? "var(--urgent)" : "var(--text-3)"} className="mt-2 h-1 max-w-[240px]" />
        )}
      </span>
      <span className="flex flex-col items-end gap-1 max-sm:col-start-2 max-sm:mt-2 max-sm:items-start">
        {l.kind === "hold" ? (
          <button type="button" disabled={pending} onClick={() => run(() => cancelHold(l.id))} className={ACT} data-hold-cancel>
            Отменить бронь
          </button>
        ) : l.canRenew ? (
          <button type="button" disabled={pending} onClick={() => run(() => renewLoan(l.id))} className={ACT} data-renew>
            <RotateCw size={13} strokeWidth={1.8} />
            Продлить
          </button>
        ) : null}
        {l.kind !== "hold" && <small className="text-right text-[12px] text-text-3 max-sm:text-left">{l.kind === "short" ? l.renewNote : `Экземпляр ${l.inventory}`}</small>}
      </span>
    </div>
  );
}

function CourseBook({ b, toast }: { b: LibraryData["courses"][number]["books"][number]; toast: Toast }) {
  const { pending, run } = useRun(toast);
  return (
    <div data-course-book={b.slug} className="flex w-[148px] shrink-0 flex-col gap-2 max-sm:w-[128px]">
      <Cover b={b} className="w-full [--fs:13px]" />
      <span className="min-w-0">
        <b className="line-clamp-2 text-sm leading-snug font-medium">{b.title}</b>
        <small className="block truncate text-[12.5px] text-text-3">
          {b.author}, {b.year}
        </small>
      </span>
      <span className="mt-auto flex flex-wrap gap-1.5">
        {b.ebook && (
          <Link href={`/library/read/${b.slug}`} className={ACT} data-read>
            <BookOpen size={13} strokeWidth={1.8} />
            {b.reading ? "Дальше" : "Читать"}
          </Link>
        )}
        {b.print &&
          (b.mine ? (
            <span className="inline-flex h-8 items-center gap-1 text-[13px] text-text-3">
              <Check size={13} strokeWidth={2} />
              {b.mine === "loan" ? "У вас" : "Бронь"}
            </span>
          ) : b.available > 0 ? (
            <button type="button" disabled={pending} onClick={() => run(() => holdBook(b.id))} className={ACT} data-hold title={`Свободно ${b.available} из ${b.copies}`}>
              Забронировать
            </button>
          ) : (
            <span className="inline-flex h-8 items-center text-[13px] text-text-3">Все на руках</span>
          ))}
      </span>
    </div>
  );
}

export function LibraryView({ d, card }: { d: LibraryData; card: StudentCardView | null }) {
  const [idOpen, setIdOpen] = useState(false);
  const closeId = useCallback(() => setIdOpen(false), []);
  const { toast, node } = useToast();
  const stats = [
    { value: String(d.stats.onHand), label: `${plural(d.stats.onHand, "книга", "книги", "книг")} на руках` },
    { value: d.stats.pages.toLocaleString("ru-RU"), label: "страниц прочитано онлайн" },
    { value: String(d.stats.year), label: `${plural(d.stats.year, "книгу", "книги", "книг")} взяли за год` },
    ...(d.stats.onTime ? [{ value: d.stats.onTime, label: "сданы вовремя" }] : []),
  ];

  return (
    <>
      <div className="flex items-end justify-between gap-6 max-sm:flex-col max-sm:items-stretch max-sm:gap-4">
        <h1 className="text-[34px] leading-[1.15] font-medium tracking-[-.03em] max-sm:text-[28px]">Библиотека</h1>
        {card && (
          <button
            type="button"
            onClick={() => setIdOpen(true)}
            data-orbita-id
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-s1 px-4 text-sm font-medium transition-[background,transform] duration-150 hover:bg-s2 active:scale-[.97]"
          >
            <QrCode size={16} strokeWidth={1.7} />
            Орбита ID
          </button>
        )}
      </div>

      <section aria-label="Итоги" className="mt-9 flex flex-wrap gap-x-14 gap-y-6 max-sm:gap-x-8">
        {stats.map((s) => (
          <div key={s.label}>
            <b className="block text-[40px] leading-none font-medium tracking-[-.035em] tabular-nums max-sm:text-[32px]">{s.value}</b>
            <span className="text-sm text-text-3">{s.label}</span>
          </div>
        ))}
      </section>

      <div className="mt-12 grid grid-cols-[minmax(0,1fr)] gap-12 min-[1000px]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section aria-labelledby="hands">
          <h2 id="hands" className={H2}>
            На руках
          </h2>
          {d.onHand.length || d.holds.length ? (
            <div className="rows [--row-inset:0px]">
              {[...d.holds, ...d.onHand].map((l) => (
                <LoanRow key={l.id} l={l} toast={toast} />
              ))}
            </div>
          ) : (
            <p className="text-[15px] text-text-3">Книг на руках нет</p>
          )}
        </section>

        <div className="flex flex-col gap-10">
          {d.reading.length > 0 && (
            <section aria-labelledby="reading">
              <h2 id="reading" className={H2}>
                Читаю
              </h2>
              <div className="flex flex-col gap-2">
                {d.reading.map((r) => (
                  <Link
                    key={r.book.id}
                    href={`/library/read/${r.book.slug}`}
                    data-reading={r.book.slug}
                    className="-mx-3 flex items-center gap-3.5 rounded-2xl px-3 py-2.5 transition-colors duration-150 hover:bg-hover"
                  >
                    <Cover b={r.book} className="h-[60px] w-10 [--fs:5px]" />
                    <span className="min-w-0 flex-1">
                      <b className="block truncate font-medium">{r.book.title}</b>
                      <small className="text-[13px] text-text-3">
                        Страница {r.page} из {r.book.pages}, {r.last}
                      </small>
                      <ProgressBar value={r.percent} label="Прочитано" fill={`var(--c-${r.book.color})`} className="mt-1.5 h-1" />
                    </span>
                    <ChevronRight size={16} strokeWidth={1.6} className="shrink-0 text-text-3" />
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section aria-label="Как взять книгу" className="flex items-start gap-3.5 rounded-3xl bg-s1 px-5 py-4">
            <ScanLine size={20} strokeWidth={1.6} className="mt-0.5 shrink-0 text-text-2" />
            <span className="min-w-0">
              <b className="block text-[15px] font-semibold">Книгу выдают по Орбита ID</b>
              <span className="mt-0.5 block text-sm text-text-2">QR студенческого — на абонементе или в станции самообслуживания у входа. Сдать можно в любом корпусе в книжный бокс.</span>
            </span>
          </section>
        </div>
      </div>

      {d.courses.length > 0 && (
        <section aria-labelledby="courses" className="mt-14">
          <h2 id="courses" className={H2}>
            К твоим курсам
          </h2>
          <div className="flex flex-col gap-9">
            {d.courses.map((c) => (
              <div key={c.title}>
                <div className="mb-3 flex items-center gap-2.5 text-[15px] font-medium text-text-2">
                  <i className="size-2 rounded-full" style={{ background: `var(--c-${c.color})` }} />
                  {c.title}
                </div>
                <div className="-mx-5 flex gap-5 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
                  {c.books.map((b) => (
                    <CourseBook key={b.id} b={b} toast={toast} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {d.history.length > 0 && (
        <section aria-labelledby="history" className="mt-14">
          <h2 id="history" className={H2}>
            История
          </h2>
          <div className="rows [--row-inset:0px]">
            {d.history.map((l) => (
              <div key={l.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-3">
                <span className="min-w-0">
                  <b className="block truncate font-medium">{l.book.title}</b>
                  <small className="text-[13px] text-text-3">
                    {l.book.author}, с {l.taken} по {l.returned}
                  </small>
                </span>
                <span className={cn("text-[13px] whitespace-nowrap", l.late ? "text-urgent" : "text-text-3")}>{l.late ? "с опозданием" : "вовремя"}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {card && <StudentCardModal card={card} open={idOpen} onClose={closeId} />}
      {node}
    </>
  );
}
