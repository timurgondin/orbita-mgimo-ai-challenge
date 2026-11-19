"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProgressBar } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { saveReading } from "@/server/library/actions";
import type { ReaderData } from "@/server/data/types";

const NAV = "inline-flex h-10 items-center gap-1.5 rounded-xl bg-s1 px-4 text-sm font-medium transition-[background,transform] duration-150 hover:bg-s2 active:scale-[.97]";

/** Читалка: лист бумаги, главы слева, ← → листают. Страница запоминается на сервере. */
export function Reader({ d }: { d: ReaderData }) {
  const router = useRouter();
  const href = (p: number) => `/library/read/${d.book.slug}?p=${p}`;

  useEffect(() => {
    saveReading(d.book.id, d.page).catch(() => {});
  }, [d.book.id, d.page]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, [contenteditable]")) return;
      if (e.key === "ArrowRight" && d.page < d.pages) router.push(href(d.page + 1), { scroll: false });
      if (e.key === "ArrowLeft" && d.page > 1) router.push(href(d.page - 1), { scroll: false });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const current = [...d.toc].reverse().find((t) => t.page <= d.page);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-12 min-[1000px]:grid-cols-[220px_minmax(0,1fr)]">
      <aside aria-label="Оглавление" className="sticky top-[92px] self-start max-[1000px]:hidden">
        <Link href="/library" className="-ml-1 inline-flex items-center gap-0.5 text-[15px] text-text-2 transition-colors duration-150 hover:text-text">
          <ChevronLeft size={17} strokeWidth={1.6} />
          Библиотека
        </Link>
        <nav className="mt-4 flex flex-col gap-0.5">
          {d.toc.map((t) => (
            <Link
              key={t.page}
              href={href(t.page)}
              aria-current={t === current ? "true" : undefined}
              className={cn("rounded-xl px-3 py-2 text-[14px] transition-colors duration-150", t === current ? "bg-s1 font-medium text-text" : "text-text-2 hover:bg-hover hover:text-text")}
            >
              {t.title}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="min-w-0">
        <Link href="/library" className="-ml-1 mb-4 inline-flex items-center gap-0.5 text-[15px] text-text-2 hover:text-text min-[1000px]:hidden">
          <ChevronLeft size={17} strokeWidth={1.6} />
          Библиотека
        </Link>
        <h1 className="text-[28px] leading-[1.2] font-medium tracking-[-.025em] [text-wrap:balance] max-sm:text-[24px]">{d.book.title}</h1>
        <div className="mt-1 text-[15px] text-text-2">
          {d.book.author}, {d.book.publisher}, {d.book.year}
        </div>

        <article data-reader-page={d.page} className="mt-7 max-w-[720px] rounded-[10px] bg-[#FBFBF9] px-12 py-11 text-[17px] leading-[1.7] text-[#1b1b1d] shadow-[0_20px_50px_-20px_rgba(0,0,0,.6)] max-sm:px-6 max-sm:py-7 max-sm:text-[16px]">
          <div className="mb-6 flex justify-between gap-4 text-[12.5px] text-[#888]">
            <span className="truncate">{d.chapter}</span>
            <span className="tabular-nums">{d.page}</span>
          </div>
          {d.chapterStart && <h2 className="mb-5 text-[24px] leading-tight font-semibold tracking-[-.015em]">{d.chapter}</h2>}
          {d.paragraphs.map((p, i) => (
            <p key={i} className="mb-4 [text-indent:1.5em] last:mb-0">
              {p}
            </p>
          ))}
        </article>

        <div className="mt-6 flex max-w-[720px] items-center gap-4">
          {d.page > 1 ? (
            <Link href={href(d.page - 1)} scroll={false} className={NAV} aria-label="Предыдущая страница">
              <ChevronLeft size={16} strokeWidth={1.7} />
            </Link>
          ) : (
            <span className="w-[50px]" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block text-center text-[13px] text-text-3 tabular-nums">
              Страница {d.page} из {d.pages}
            </span>
            <ProgressBar value={Math.round((d.page / d.pages) * 100)} label="Прочитано" fill={`var(--c-${d.book.color})`} className="mt-1.5 h-1" />
          </span>
          {d.page < d.pages ? (
            <Link href={href(d.page + 1)} scroll={false} className={NAV} aria-label="Следующая страница" data-next-page>
              <ChevronRight size={16} strokeWidth={1.7} />
            </Link>
          ) : (
            <span className="w-[50px]" />
          )}
        </div>
      </div>
    </div>
  );
}
