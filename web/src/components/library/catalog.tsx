"use client";

import { useDeferredValue, useState } from "react";
import Link from "next/link";
import { BookOpen, Check, Clock3, Package, Search, Library as Station } from "lucide-react";
import { Modal } from "@/components/time/modal";
import { plural } from "@/lib/phrases";
import { cn } from "@/lib/utils";
import { orderBook } from "@/server/library/actions";
import type { CatalogBook, PointOption } from "@/server/data/types";
import { Cover } from "./cover";

const H2 = "text-lg font-semibold tracking-[-.02em]";
const chip = (on: boolean) =>
  cn("h-9 shrink-0 rounded-xl px-3.5 text-sm font-medium whitespace-nowrap transition-colors duration-150", on ? "bg-text text-bg" : "bg-s1 text-text-2 hover:bg-s2 hover:text-text");
export const BTN =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-medium transition-[transform,opacity,background] duration-150 active:scale-[.97] disabled:opacity-40";

/** Что с книгой: одна строка под карточкой и в окне. */
function Availability({ b, className }: { b: CatalogBook; className?: string }) {
  const cls = cn("flex items-center gap-1.5 text-[12.5px]", className);
  if (b.mine === "loan")
    return (
      <span className={cn(cls, "text-text-2")}>
        <Check size={13} strokeWidth={2} />У вас
      </span>
    );
  if (b.mine === "order")
    return (
      <span className={cn(cls, "text-accent")}>
        <Package size={13} strokeWidth={1.9} />
        Заказана
      </span>
    );
  if (b.print && b.available > 0)
    return (
      <span className={cn(cls, "text-text-2")}>
        <i className="size-1.5 rounded-full bg-(--st-green)" />
        Можно заказать
      </span>
    );
  if (b.print)
    return (
      <span className={cn(cls, "text-text-3")}>
        <Clock3 size={13} strokeWidth={1.8} />
        {b.back ?? "Все на руках"}
      </span>
    );
  return (
    <span className={cn(cls, "text-text-2")}>
      <BookOpen size={13} strokeWidth={1.8} />
      Электронная
    </span>
  );
}

function BookTile({ b, onOpen, course }: { b: CatalogBook; onOpen: () => void; course?: boolean }) {
  return (
    <button type="button" onClick={onOpen} data-book={b.slug} className="group grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-2.5 text-left">
      <Cover b={b} className="w-full max-w-full transition-transform duration-300 ease-spring [--fs:12px] group-hover:-translate-y-1 group-active:scale-[.97] max-sm:[--fs:10px]" />
      <span className="min-w-0">
        <b className="line-clamp-2 text-sm leading-snug font-medium">{b.title}</b>
        {course && b.course ? (
          <small className="mt-0.5 flex items-center gap-1.5 truncate text-[12.5px] text-text-3">
            <i className="size-1.5 shrink-0 rounded-full" style={{ background: `var(--c-${b.course.color})` }} />
            <span className="truncate">{b.course.title}</span>
          </small>
        ) : (
          <small className="mt-0.5 block truncate text-[12.5px] text-text-3">{b.author}</small>
        )}
      </span>
      <Availability b={b} />
    </button>
  );
}

/**
 * Каталог: полка «К твоим курсам» одной строкой, затем весь фонд — поиск по названию и автору и разделы чипами.
 * Книга открывается в окне: о книге, читать онлайн, заказать в постамат или на станцию выдачи.
 */
export function Catalog({ books, courseBooks, shelves, onOpen }: { books: CatalogBook[]; courseBooks: CatalogBook[]; shelves: string[]; onOpen: (b: CatalogBook) => void }) {
  const [shelf, setShelf] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const query = useDeferredValue(q.trim().toLocaleLowerCase("ru"));
  const list = books.filter(
    (b) => (!shelf || b.shelf === shelf) && (!query || b.title.toLocaleLowerCase("ru").includes(query) || b.author.toLocaleLowerCase("ru").includes(query)),
  );

  return (
    <>
      {courseBooks.length > 0 && (
        <section aria-labelledby="for-courses">
          <h2 id="for-courses" className={cn(H2, "mb-4")}>
            К твоим курсам
          </h2>
          <div className="-mx-5 flex gap-5 overflow-x-auto px-5 pb-2 [scrollbar-width:none] max-sm:gap-4" data-course-shelf>
            {courseBooks.map((b) => (
              <div key={b.id} className="w-[132px] shrink-0 max-sm:w-[112px]">
                <BookTile b={b} course onOpen={() => onOpen(b)} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="fund" className={courseBooks.length ? "mt-14" : ""}>
        <div className="mb-4 flex items-center justify-between gap-4 max-sm:flex-col max-sm:items-stretch">
          <h2 id="fund" className={H2}>
            Весь фонд <span className="font-normal text-text-3 tabular-nums">{books.length}</span>
          </h2>
          <label className="relative w-[280px] max-sm:w-full">
            <span className="sr-only">Найти книгу</span>
            <Search size={16} strokeWidth={1.8} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-text-3" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Название или автор"
              autoComplete="off"
              autoCorrect="off"
              enterKeyHint="search"
              spellCheck={false}
              data-catalog-search
              className="h-10 w-full rounded-xl bg-s1 pr-3 pl-10 text-[15px] placeholder:text-text-3 focus:bg-s2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </label>
        </div>
        <div className="-mx-5 mb-7 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none]" role="group" aria-label="Разделы">
          <button type="button" aria-pressed={!shelf} onClick={() => setShelf(null)} className={chip(!shelf)}>
            Все
          </button>
          {shelves.map((s) => (
            <button key={s} type="button" aria-pressed={shelf === s} onClick={() => setShelf(shelf === s ? null : s)} className={chip(shelf === s)} data-shelf={s}>
              {s}
            </button>
          ))}
        </div>
        {list.length ? (
          <div className="grid grid-cols-8 gap-x-4 gap-y-7 max-[1100px]:grid-cols-6 max-[860px]:grid-cols-4 max-sm:grid-cols-3 max-sm:gap-x-3.5" data-catalog>
            {list.map((b) => (
              <BookTile key={b.id} b={b} onOpen={() => onOpen(b)} />
            ))}
          </div>
        ) : (
          <p className="text-[15px] text-text-3">Ничего не нашлось</p>
        )}
      </section>
    </>
  );
}

/** Окно книги: о книге, электронная версия, заказ печатной с выбором пункта выдачи. */
export function BookModal({
  b,
  open,
  onClose,
  points,
  pending,
  onOrder,
  onMine,
}: {
  b: CatalogBook | null;
  open: boolean;
  onClose: () => void;
  points: PointOption[];
  pending: boolean;
  onOrder: (fn: () => ReturnType<typeof orderBook>) => void;
  /** перейти во вкладку «Мои книги» */
  onMine: () => void;
}) {
  const [point, setPoint] = useState(points[0]?.id ?? "");
  const canOrder = !!b && b.print && !b.mine && b.available > 0;
  return (
    <Modal open={open} onClose={onClose} accent={b ? `var(--c-${b.color})` : "var(--accent)"} cover={false} title={b?.title ?? "Книга"} width={560}>
      {b && (
        <div data-book-modal={b.slug}>
          <div className="flex gap-5 pr-8 max-sm:gap-4">
            <Cover b={b} className="w-[112px] [--fs:12px] max-sm:w-[92px] max-sm:[--fs:10px]" />
            <div className="min-w-0 pt-1">
              <h2 className="text-[21px] leading-[1.2] font-semibold tracking-[-.025em] max-sm:text-lg">{b.title}</h2>
              <p className="mt-1 text-[15px] text-text-2">{b.author}</p>
              <p className="mt-2.5 text-[13.5px] text-text-3">
                {b.publisher}, {b.year}, {b.pages} {plural(b.pages, "страница", "страницы", "страниц")}
              </p>
              {b.course && (
                <p className="mt-1.5 flex items-center gap-2 text-[13.5px] text-text-2">
                  <i className="size-1.5 rounded-full" style={{ background: `var(--c-${b.course.color})` }} />
                  {b.course.title}
                </p>
              )}
            </div>
          </div>
          {b.about && <p className="mt-5 text-[15px] leading-relaxed text-text-2">{b.about}</p>}

          {b.ebook && (
            <Link href={`/library/read/${b.slug}`} data-read className={cn(BTN, "mt-5 w-full bg-s3 hover:bg-hover")}>
              <BookOpen size={17} strokeWidth={1.7} />
              {b.reading ? "Продолжить чтение" : "Читать онлайн"}
            </Link>
          )}

          {b.print && (
            <div className="mt-6 border-t border-line pt-5">
              {b.mine ? (
                <div className="flex items-center justify-between gap-4">
                  <Availability b={b} className="text-[15px]" />
                  <button type="button" onClick={onMine} className="text-sm text-text-2 hover:text-text">
                    Мои книги ›
                  </button>
                </div>
              ) : b.available > 0 ? (
                <>
                  <div className="mb-3 flex items-baseline justify-between gap-4">
                    <h3 className="text-[15px] font-semibold">Где забрать</h3>
                    <span className="text-[13px] text-text-3 tabular-nums">
                      Свободно {b.available} из {b.copies}
                    </span>
                  </div>
                  <fieldset className="flex flex-col gap-1.5" data-points>
                    <legend className="sr-only">Пункт выдачи</legend>
                    {points.map((p) => (
                      <label
                        key={p.id}
                        className="flex cursor-pointer items-center gap-3.5 rounded-2xl bg-s2 px-4 py-3 transition-[background,box-shadow] duration-150 hover:bg-s3 has-[:checked]:shadow-[inset_0_0_0_1.5px_var(--accent)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent"
                      >
                        <input type="radio" name="point" value={p.id} checked={point === p.id} onChange={() => setPoint(p.id)} className="sr-only" data-point={p.id} />
                        {p.kind === "locker" ? <Package size={19} strokeWidth={1.6} className="shrink-0 text-text-2" /> : <Station size={19} strokeWidth={1.6} className="shrink-0 text-text-2" />}
                        <span className="min-w-0 flex-1">
                          <b className="block text-[15px] font-medium">{p.name}</b>
                          <small className="block truncate text-[13px] text-text-3">{p.place}</small>
                        </span>
                        <span className="text-right text-[13px] whitespace-nowrap text-text-2">{p.eta}</span>
                      </label>
                    ))}
                  </fieldset>
                  <button type="button" disabled={pending || !canOrder} onClick={() => onOrder(() => orderBook(b.id, point))} data-order className={cn(BTN, "mt-4 w-full bg-text text-bg")}>
                    Заказать
                  </button>
                </>
              ) : (
                <p className="flex items-center gap-2 text-[15px] text-text-2">
                  <Clock3 size={16} strokeWidth={1.7} className="text-text-3" />
                  Все {b.copies} {plural(b.copies, "экземпляр", "экземпляра", "экземпляров")} на руках{b.back ? `, ${b.back.toLowerCase()}` : ""}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
