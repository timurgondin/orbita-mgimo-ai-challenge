"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { setScore } from "@/server/teach/actions";
import type { Gradebook } from "@/server/data/teach-types";
import { CHIP, CHIP_OFF, CHIP_ON } from "./ui";

const fmt = (n: number | null) => (n == null ? "" : String(n).replace(".", ","));

/** Ячейка журнала: число; по клику — поле ввода, Enter или уход фокуса сохраняет, Esc — отмена. */
function Cell({ value, onSave, label }: { value: number | null; onSave: (v: string) => Promise<boolean>; label: string }) {
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState(fmt(value));
  const [pending, start] = useTransition();
  const commit = () => {
    if (draft === fmt(value)) return setEdit(false);
    start(async () => {
      if (await onSave(draft)) setEdit(false);
    });
  };
  return edit ? (
    <input
      autoFocus
      value={draft}
      disabled={pending}
      aria-label={label}
      inputMode="decimal"
      autoComplete="off"
      enterKeyHint="done"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") {
          setDraft(fmt(value));
          setEdit(false);
        }
      }}
      className="h-9 w-14 rounded-[10px] bg-s3 text-center tabular-nums outline-none focus:shadow-[0_0_0_2px_var(--accent)]"
    />
  ) : (
    <button
      type="button"
      aria-label={`${label}: ${value == null ? "нет оценки" : fmt(value)}`}
      onClick={() => {
        setDraft(fmt(value));
        setEdit(true);
      }}
      className={cn("h-9 w-14 rounded-[10px] tabular-nums transition-colors hover:bg-s2", value == null && "text-text-3")}
    >
      {value == null ? "—" : fmt(value)}
    </button>
  );
}

/** Журнал: студенты × элементы формулы. Агрегаты (ДЗ) и итог считаются сами, остальное правится в ячейке. */
export function GradebookView({ books, courses }: { books: Gradebook[]; courses: { slug: string; title: string; color: string }[] }) {
  const [slug, setSlug] = useState(books[0]?.slug);
  const book = books.find((b) => b.slug === slug) ?? books[0];
  const { toast, node } = useToast();
  const router = useRouter();
  if (!book) return <p className="text-[15px] text-text-3">Курсов нет</p>;

  const save = (componentId: string, studentId: string) => async (v: string) => {
    const r = await setScore(book.slug, componentId, studentId, v.trim());
    if (!r.ok) {
      toast(r.error, "error");
      return false;
    }
    router.refresh();
    return true;
  };

  return (
    <>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Курс">
        {courses.map((c) => (
          <button key={c.slug} type="button" onClick={() => setSlug(c.slug)} aria-pressed={book.slug === c.slug} className={cn(CHIP, book.slug === c.slug ? CHIP_ON : CHIP_OFF)}>
            <i className="size-1.5 rounded-full" style={{ background: `var(--c-${c.color})` }} />
            {c.title}
          </button>
        ))}
      </div>

      <div className="mt-8 overflow-x-auto overscroll-x-contain rounded-[24px] bg-s1 px-2 py-2" data-gradebook={book.slug}>
        <table className="w-full min-w-[640px] border-collapse text-[15px]">
          <thead>
            <tr className="text-left text-[13px] text-text-3">
              <th scope="col" className="sticky left-0 z-[1] bg-s1 px-3 py-3 font-normal">
                Студент
              </th>
              {book.columns.map((c) => (
                <th key={c.id} scope="col" className="px-1 py-3 text-center font-normal whitespace-nowrap" title={c.title}>
                  <span className="block text-text-2">{c.short}</span>
                  <span className="block text-[12px]">{c.weight}%</span>
                </th>
              ))}
              <th scope="col" className="px-3 py-3 text-right font-normal whitespace-nowrap">
                <span className="block text-text-2">Итог</span>
                <span className="block text-[12px]">сейчас</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {book.rows.map((r) => (
              <tr key={r.id} className="border-t-[.5px] border-line">
                <th scope="row" className="sticky left-0 z-[1] bg-s1 px-3 py-1.5 text-left font-normal">
                  <span className="flex items-center gap-2.5">
                    <span aria-hidden="true" className="mono grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold" style={{ background: r.gradient }}>
                      {r.initials}
                    </span>
                    <span className="truncate font-medium whitespace-nowrap">{r.name}</span>
                  </span>
                </th>
                {book.columns.map((c) => (
                  <td key={c.id} className="px-1 py-1.5 text-center">
                    {c.aggregate ? (
                      <span className={cn("inline-block w-14 tabular-nums", r.cells[c.id] == null ? "text-text-3" : "text-text-2")} title="Среднее по заданиям">
                        {r.cells[c.id] == null ? "—" : fmt(r.cells[c.id])}
                      </span>
                    ) : (
                      <Cell value={r.cells[c.id]} label={`${r.name}, ${c.title}`} onSave={save(c.id, r.id)} />
                    )}
                  </td>
                ))}
                <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{r.total == null ? "—" : r.total.toFixed(1).replace(".", ",")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {node}
    </>
  );
}
