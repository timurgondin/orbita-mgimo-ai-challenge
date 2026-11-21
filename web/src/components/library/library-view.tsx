"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronRight, Clock3, MapPin, Package, QrCode, RotateCcw, RotateCw, Undo2 } from "lucide-react";
import { StudentCardModal } from "@/components/profile/student-card";
import { Modal } from "@/components/time/modal";
import { ProgressBar } from "@/components/ui/progress";
import { Segmented } from "@/components/ui/segmented";
import { useToast, type Toast } from "@/components/ui/toast";
import { plural } from "@/lib/phrases";
import { cn } from "@/lib/utils";
import { cancelOrder, pickupOrder, renewLoan } from "@/server/library/actions";
import type { CatalogBook, HistoryItem, LibraryData, LoanView, OrderView, StudentCardView } from "@/server/data/types";
import { BookModal, BTN, Catalog } from "./catalog";
import { Cover } from "./cover";

export { Cover } from "./cover";

const H2 = "mb-3 text-lg font-semibold tracking-[-.02em]";
const ACT = "inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-s2 px-3 text-[13px] font-medium whitespace-nowrap transition-colors hover:bg-s3 disabled:opacity-45";

type Result = { ok: true; message: string } | { ok: false; error: string };

function useRun(toast: Toast) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<Result>, then?: (r: Result) => void) =>
    start(async () => {
      const r = await fn();
      toast(r.ok ? r.message : r.error, r.ok ? "ok" : "error");
      if (r.ok) router.refresh();
      then?.(r);
    });
  return { pending, run };
}

// ---------- Заказы: трекер «как у посылки» ----------

function Tracker({ o }: { o: OrderView }) {
  return (
    <span className="grid" style={{ gridTemplateColumns: `repeat(${o.steps.length}, minmax(0, 1fr))` }}>
      {o.steps.map((s) => {
        const ready = o.status === "ready" && s.state === "cur";
        return (
          <span key={s.label} className="flex min-w-0 flex-col gap-2 pr-1.5">
            <span className="block h-1 overflow-hidden rounded bg-s3">
              <i className={cn("block h-full rounded bg-text", ready ? "w-full bg-(--st-green)" : s.state === "fin" ? "w-full" : s.state === "cur" ? "step-cur" : "w-0")} />
            </span>
            <b className={cn("truncate text-[13px] font-medium max-sm:text-[12px]", ready ? "text-(--st-green)" : s.state === "todo" ? "text-text-3" : "text-text")}>{s.label}</b>
            <small className="-mt-1.5 truncate text-xs text-text-3">{s.when || " "}</small>
          </span>
        );
      })}
    </span>
  );
}

function OrderCard({ o, onPickup, toast }: { o: OrderView; onPickup: () => void; toast: Toast }) {
  const { pending, run } = useRun(toast);
  const ready = o.status === "ready";
  return (
    <article data-order-card={o.book.slug} data-status={o.status} className="flex flex-col rounded-[24px] bg-s1 px-6 py-[22px] max-sm:px-5">
      <div className="flex items-center gap-4">
        <Cover b={o.book} className="h-[66px] w-11 [--fs:5px]" />
        <span className="min-w-0">
          <b className="block truncate text-[17px] font-semibold tracking-[-.02em]">{o.book.title}</b>
          <span className="block truncate text-sm text-text-3">{o.book.author}</span>
        </span>
      </div>
      <div className="mt-6">
        <Tracker o={o} />
      </div>
      <div className="mt-5 flex items-end justify-between gap-4 max-sm:flex-col max-sm:items-stretch">
        <span className="min-w-0 text-sm">
          <span className={cn("flex items-center gap-2", ready ? "font-medium text-(--st-green)" : "text-text-2")}>
            {ready ? <Package size={15} strokeWidth={1.8} /> : <Clock3 size={15} strokeWidth={1.6} className="text-text-3" />}
            {o.line}
          </span>
          <span className="mt-1 flex items-center gap-2 text-text-3">
            <MapPin size={15} strokeWidth={1.6} className="shrink-0" />
            <span className="truncate">
              {o.point.name}, {o.point.place.charAt(0).toLowerCase() + o.point.place.slice(1)}
            </span>
          </span>
        </span>
        {ready ? (
          <button type="button" onClick={onPickup} data-pickup className={cn(BTN, "h-10 shrink-0 bg-text px-4 text-sm text-bg")}>
            <QrCode size={16} strokeWidth={1.8} />
            Открыть ячейку
          </button>
        ) : (
          o.canCancel && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => cancelOrder(o.id))}
              data-order-cancel
              className="h-10 shrink-0 rounded-xl px-3 text-sm text-text-3 transition-colors hover:bg-hover hover:text-text"
            >
              Отменить
            </button>
          )
        )}
      </div>
    </article>
  );
}

/** Окно постамата: Орбита ID для сканера и «Открыть ячейку» отсюда, как в приложениях постаматов. После — галочка и срок возврата. */
function PickupModal({ o, card, open, onClose, toast }: { o: OrderView | null; card: StudentCardView | null; open: boolean; onClose: () => void; toast: Toast }) {
  const { pending, run } = useRun(toast);
  const [done, setDone] = useState<string | null>(null);
  const close = () => {
    onClose();
    setTimeout(() => setDone(null), 300);
  };
  return (
    <Modal open={open} onClose={close} accent="var(--st-green)" cover={false} title={o?.point.name ?? "Постамат"} width={400}>
      {o && (
        <div className="flex flex-col items-center pt-4 pb-1 text-center" data-pickup-modal>
          {done ? (
            <>
              <svg viewBox="0 0 52 52" className="ck-pop mt-4 size-20 text-(--st-green)" aria-hidden="true">
                <circle cx="26" cy="26" r="25" fill="currentColor" opacity=".16" />
                <path className="ck-path" d="M16 27l7 7 13-15" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <b className="mt-5 text-[22px] font-semibold tracking-[-.03em]">Ячейка {o.cell} открыта</b>
              <span className="mt-1 text-[15px] text-text-2">{done}</span>
              <button type="button" onClick={close} className={cn(BTN, "mt-7 w-full bg-s3")}>
                Готово
              </button>
            </>
          ) : (
            <>
              <span className="text-sm text-text-2">{o.point.name}</span>
              <b className="mt-1 text-[44px] leading-none font-semibold tracking-[-.04em] tabular-nums">Ячейка {o.cell}</b>
              <span className="mt-2 text-sm text-text-3">{o.point.place}</span>
              {card && (
                <div
                  className="mt-6 rounded-[20px] bg-white p-3 [&_svg]:block [&_svg]:size-[168px]"
                  // SVG строит сервер (qrcode) — тот же Орбита ID, что и в профиле
                  dangerouslySetInnerHTML={{ __html: card.qr }}
                />
              )}
              <span className="mt-3 text-[13.5px] text-text-3">Орбита ID для сканера постамата</span>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(
                    () => pickupOrder(o.id),
                    (r) => {
                      if (r.ok) setDone(r.message.replace(/^.*?, в/, "В"));
                    },
                  )
                }
                data-open-cell
                className={cn(BTN, "mt-6 w-full bg-text text-bg")}
              >
                Открыть ячейку
              </button>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

// ---------- На руках, чтение, история ----------

function LoanRow({ l, toast }: { l: LoanView; toast: Toast }) {
  const { pending, run } = useRun(toast);
  return (
    <div data-loan={l.book.slug} className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-x-4 py-3.5 max-sm:grid-cols-[44px_minmax(0,1fr)]">
      <Cover b={l.book} className="h-[72px] w-12 [--fs:6px] max-sm:h-[66px] max-sm:w-11" />
      <span className="min-w-0">
        <b className="block truncate font-medium">{l.book.title}</b>
        <small className="block truncate text-[13px] text-text-3">
          {l.book.author}, {l.kindLabel.toLowerCase()}
        </small>
        <span className={cn("mt-1 flex items-center gap-1.5 text-[13px]", l.hot ? "font-medium text-urgent" : "text-text-2")}>
          <Clock3 size={13} strokeWidth={1.8} />
          {l.due}
        </span>
        {l.kind === "short" && <ProgressBar value={l.elapsed} label="Прошло срока" fill={l.hot ? "var(--urgent)" : "var(--text-3)"} className="mt-2 h-1 max-w-[240px]" />}
      </span>
      <span className="flex flex-col items-end gap-1 max-sm:col-start-2 max-sm:mt-2 max-sm:items-start">
        {l.canRenew && (
          <button type="button" disabled={pending} onClick={() => run(() => renewLoan(l.id))} className={ACT} data-renew>
            <RotateCw size={13} strokeWidth={1.8} />
            Продлить
          </button>
        )}
        <small className="text-right text-[12px] text-text-3 max-sm:text-left">{l.kind === "short" ? l.renewNote : `Экземпляр ${l.inventory}`}</small>
      </span>
    </div>
  );
}

function HistoryRow({ h, onAgain }: { h: HistoryItem; onAgain: (() => void) | null }) {
  return (
    <div data-history={h.book.slug} className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-x-4 py-3">
      <Cover b={h.book} className="h-[60px] w-10 [--fs:5px]" />
      <span className="min-w-0">
        <b className="block truncate font-medium">{h.book.title}</b>
        <small className="block truncate text-[13px] text-text-3">
          {h.span}, {h.kept}
        </small>
      </span>
      <span className="flex items-center gap-2">
        {h.late ? (
          <span className="text-right text-[13px] text-urgent max-sm:max-w-[84px] max-sm:text-[12px] max-sm:leading-tight">{h.late}</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[13px] whitespace-nowrap text-text-3">
            <Check size={13} strokeWidth={2} />
            <span className="max-sm:sr-only">Вовремя</span>
          </span>
        )}
        {onAgain && (
          <button
            type="button"
            onClick={onAgain}
            aria-label={`Взять снова: ${h.book.title}`}
            title="Взять снова"
            data-again
            className="grid size-8 place-items-center rounded-full text-text-3 transition-colors hover:bg-hover hover:text-text"
          >
            <RotateCcw size={15} strokeWidth={1.8} />
          </button>
        )}
      </span>
    </div>
  );
}

function MyBooks({ d, toast, onPickup, onBook }: { d: LibraryData; toast: Toast; onPickup: (o: OrderView) => void; onBook: (b: CatalogBook) => void }) {
  const bySlug = new Map(d.catalog.map((b) => [b.slug, b]));
  const stats = [
    { value: String(d.stats.year), label: `${plural(d.stats.year, "книгу", "книги", "книг")} взяли за год` },
    ...(d.stats.onTime ? [{ value: d.stats.onTime, label: "вернули вовремя" }] : []),
    ...(d.stats.days ? [{ value: String(d.stats.days), label: `${plural(d.stats.days, "день", "дня", "дней")} книга у вас в среднем` }] : []),
    { value: d.stats.pages.toLocaleString("ru-RU"), label: `${plural(d.stats.pages, "страницу", "страницы", "страниц")} прочитали онлайн` },
  ];

  return (
    <>
      {d.orders.length > 0 && (
        <section aria-labelledby="orders" className="mb-14">
          <h2 id="orders" className={H2}>
            Заказы
          </h2>
          <div className="grid grid-cols-2 gap-4 max-[900px]:grid-cols-1">
            {d.orders.map((o) => (
              <OrderCard key={o.id} o={o} toast={toast} onPickup={() => onPickup(o)} />
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-12 min-[1000px]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section aria-labelledby="hands">
          <h2 id="hands" className={H2}>
            На руках
          </h2>
          {d.onHand.length ? (
            <div className="rows [--row-inset:0px]">
              {d.onHand.map((l) => (
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
                Читаю онлайн
              </h2>
              <div className="flex flex-col gap-1">
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

          <section aria-label="Как вернуть книгу" className="flex items-start gap-3.5 rounded-3xl bg-s1 px-5 py-4">
            <Undo2 size={20} strokeWidth={1.6} className="mt-0.5 shrink-0 text-text-2" />
            <span className="min-w-0">
              <b className="block text-[15px] font-semibold">Вернуть можно в любой постамат</b>
              <span className="mt-0.5 block text-sm text-text-2">Или в книжный бокс у входа в каждый корпус. Приложите Орбита ID — книга спишется сразу.</span>
            </span>
          </section>
        </div>
      </div>

      {d.history.length > 0 && (
        <section aria-labelledby="history" className="mt-16">
          <h2 id="history" className={H2}>
            История
          </h2>
          <div className="mt-5 mb-8 grid grid-cols-4 gap-4 max-[900px]:grid-cols-2" data-stats>
            {stats.map((s) => (
              <div key={s.label} className="rounded-[22px] bg-s1 px-5 py-4">
                <b className="block text-[30px] leading-none font-medium tracking-[-.035em] tabular-nums">{s.value}</b>
                <span className="mt-2 block text-[13px] text-text-3">{s.label}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-x-12 gap-y-8 max-[900px]:grid-cols-1">
            {d.history.map((g) => (
              <div key={g.title}>
                <h3 className="mb-1 text-[15px] font-medium text-text-2">{g.title}</h3>
                <div className="rows [--row-inset:0px]">
                  {g.items.map((h) => {
                    const b = bySlug.get(h.book.slug);
                    return <HistoryRow key={h.id} h={h} onAgain={b ? () => onBook(b) : null} />;
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

type Tab = "mine" | "catalog";

/** Библиотека: «Мои книги» (заказы, на руках, онлайн, история) и «Каталог» (полка к курсам, весь фонд, заказ в постамат). Вкладка — в адресе (?tab=catalog). */
export function LibraryView({ d, card }: { d: LibraryData; card: StudentCardView | null }) {
  const tab: Tab = useSearchParams().get("tab") === "catalog" ? "catalog" : "mine";
  const [idOpen, setIdOpen] = useState(false);
  const [book, setBook] = useState<CatalogBook | null>(null);
  const [bookOpen, setBookOpen] = useState(false);
  const [pickup, setPickup] = useState<OrderView | null>(null);
  const [pickupOpen, setPickupOpen] = useState(false);
  const closeId = useCallback(() => setIdOpen(false), []);
  const closeBook = useCallback(() => setBookOpen(false), []);
  const closePickup = useCallback(() => setPickupOpen(false), []);
  const { toast, node } = useToast();
  const { pending, run } = useRun(toast);

  const select = (t: Tab) => window.history.pushState(null, "", t === "catalog" ? "/library?tab=catalog" : "/library");
  const openBook = (b: CatalogBook) => {
    setBook(b);
    setBookOpen(true);
  };
  // в открытом окне — свежие данные книги после заказа (router.refresh)
  const live = book ? (d.catalog.find((b) => b.id === book.id) ?? book) : null;

  return (
    <>
      <div className="flex items-end justify-between gap-6 max-sm:flex-col max-sm:items-stretch max-sm:gap-4">
        <h1 className="text-[34px] leading-[1.15] font-medium tracking-[-.03em] max-sm:text-[28px]">Библиотека</h1>
        <div className="flex items-center gap-2">
          <Segmented
            label="Разделы библиотеки"
            value={tab}
            onChange={select}
            items={[
              { id: "mine", label: "Мои книги" },
              { id: "catalog", label: "Каталог" },
            ]}
            className="max-sm:flex-1"
          />
          {card && (
            <button
              type="button"
              onClick={() => setIdOpen(true)}
              data-orbita-id
              aria-label="Орбита ID"
              title="Орбита ID"
              className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-s1 transition-[background,transform] duration-150 hover:bg-s2 active:scale-[.97]"
            >
              <QrCode size={18} strokeWidth={1.7} />
            </button>
          )}
        </div>
      </div>

      <div className="mt-10" role="tabpanel" aria-label={tab === "catalog" ? "Каталог" : "Мои книги"}>
        {tab === "catalog" ? (
          <Catalog books={d.catalog} courseBooks={d.courseBooks} shelves={d.shelves} onOpen={openBook} />
        ) : (
          <MyBooks
            d={d}
            toast={toast}
            onBook={openBook}
            onPickup={(o) => {
              setPickup(o);
              setPickupOpen(true);
            }}
          />
        )}
      </div>

      <BookModal
        key={live?.id}
        b={live}
        open={bookOpen}
        onClose={closeBook}
        points={d.points}
        pending={pending}
        onOrder={(fn) =>
          run(fn, (r) => {
            if (r.ok) setBookOpen(false);
          })
        }
        onMine={() => {
          setBookOpen(false);
          select("mine");
        }}
      />
      <PickupModal o={pickup} card={card} open={pickupOpen} onClose={closePickup} toast={toast} />
      {card && <StudentCardModal card={card} open={idOpen} onClose={closeId} />}
      {node}
    </>
  );
}
