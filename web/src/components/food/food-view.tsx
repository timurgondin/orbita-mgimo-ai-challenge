"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Activity, BadgePercent, Clock3, Coffee, Flame, Leaf, MapPin } from "lucide-react";
import { Modal } from "@/components/time/modal";
import { cn } from "@/lib/utils";
import type { Dish, VenueView } from "@/server/data/food-types";

const rub = (n: number) => `${n} ₽`;
/** «08:30» → «8:30» */
const t = (hhmm: string) => hhmm.replace(/^0/, "");
const CROWD = { low: "Свободно", mid: "Средне", high: "Многолюдно" } as const;
const CROWD_COLOR = { low: "var(--st-green)", mid: "var(--st-yellow)", high: "var(--st-orange)" } as const;

function Status({ v, className }: { v: VenueView; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} data-open={v.isOpen || undefined}>
      <i className="size-1.5 shrink-0 rounded-full" style={{ background: v.isOpen ? "var(--st-green)" : "var(--text-3)" }} />
      {v.isOpen ? `Открыто до ${t(v.close)}` : `Откроется в ${t(v.open)}`}
    </span>
  );
}

function Crowd({ v }: { v: VenueView }) {
  if (!v.crowd) return null;
  const level = { low: 1, mid: 2, high: 3 }[v.crowd];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap" data-crowd={v.crowd}>
      <span className="flex h-3 items-end gap-[2px]" aria-hidden>
        {[1, 2, 3].map((i) => (
          <i key={i} className="w-[3px] rounded-full" style={{ height: `${4 + i * 2.5}px`, background: i <= level ? CROWD_COLOR[v.crowd!] : "var(--s3)" }} />
        ))}
      </span>
      {CROWD[v.crowd]}
    </span>
  );
}

function Card({ v, onOpen }: { v: VenueView; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      data-venue={v.slug}
      style={{ "--cc": `var(--c-${v.color})` } as React.CSSProperties}
      className="course-card flex flex-col overflow-hidden rounded-3xl bg-s1 text-left transition-colors duration-200 hover:bg-s2"
    >
      <div className="course-cover !h-[88px]">
        <span className="absolute top-4 left-5 text-xs font-medium text-[color-mix(in_srgb,var(--cc)_60%,var(--text))]">{v.kind}</span>
        {v.coffee && (
          <span className="absolute top-3.5 right-4 inline-flex items-center gap-1 rounded-full bg-black/25 px-2.5 py-1 text-xs font-medium text-white" data-coffee-mark>
            <Coffee size={12} strokeWidth={2} />
            {v.coffee.day}, {v.coffee.time}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col px-5 pt-4 pb-5">
        <b className="text-[17px] font-semibold tracking-[-.02em]">{v.name}</b>
        <span className="mt-0.5 text-sm text-text-2">
          {v.building}, {v.floor}
        </span>
        {v.highlight && (
          <span className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 rounded-2xl bg-s2 px-3.5 py-2.5 text-sm">
            <span className="min-w-0">
              <small className="block text-xs text-text-3">{v.highlight.label}</small>
              <span className="block truncate">{v.highlight.dish.name}</span>
            </span>
            <b className="font-semibold tabular-nums">{rub(v.highlight.dish.price)}</b>
          </span>
        )}
        <span className="mt-auto flex items-center justify-between gap-3 pt-4 text-[13px] text-text-3">
          <Status v={v} />
          <Crowd v={v} />
        </span>
      </div>
    </button>
  );
}

/** Загруженность по получасам: столбцы, «сейчас» — акцентом, прошедшее — бледнее. */
function Load({ v }: { v: VenueView }) {
  const max = Math.max(...v.load.map((l) => l.value), 1);
  return (
    <figure className="mt-3" aria-label="Загруженность по времени">
      <div className="flex h-[72px] items-end gap-[3px]" data-load>
        {v.load.map((l, i) => (
          <span
            key={l.at}
            title={`${t(l.at)}: ${CROWD[l.value < 35 ? "low" : l.value < 65 ? "mid" : "high"].toLowerCase()}`}
            data-now={i === v.nowIndex || undefined}
            className="min-w-0 flex-1 rounded-[3px]"
            style={{
              height: `${Math.max(6, (l.value / max) * 100)}%`,
              background: i === v.nowIndex ? "var(--accent)" : "color-mix(in srgb, var(--text) 22%, transparent)",
              opacity: v.nowIndex >= 0 && i < v.nowIndex ? 0.5 : 1,
            }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex text-[11px] text-text-3 tabular-nums">
        {v.load.map((l, i) => (
          <span key={l.at} className="min-w-0 flex-1 overflow-visible whitespace-nowrap">
            {i % 4 === 0 ? t(l.at) : ""}
          </span>
        ))}
      </div>
    </figure>
  );
}

function DishRow({ d, kbju }: { d: Dish; kbju: boolean }) {
  const sub = d.note ?? d.size;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 py-2.5" data-dish>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>{d.name}</span>
          {d.tags?.includes("veg") && <Leaf size={14} strokeWidth={1.8} className="shrink-0" style={{ color: "var(--st-green)" }} aria-label="Вегетарианское" />}
          {d.tags?.includes("spicy") && <Flame size={14} strokeWidth={1.8} className="shrink-0" style={{ color: "var(--st-red)" }} aria-label="Острое" />}
          {d.tags?.includes("new") && <span className="rounded-md bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] px-1.5 py-px text-[11px] font-medium text-accent">Новинка</span>}
          {d.tags?.includes("season") && <span className="rounded-md bg-[color-mix(in_srgb,var(--st-orange)_16%,transparent)] px-1.5 py-px text-[11px] font-medium" style={{ color: "var(--st-orange)" }}>Сезонное</span>}
        </span>
        {sub && <small className="mt-0.5 block text-[13px] text-text-3">{sub}</small>}
        {kbju && d.kbju && (
          <span className="mt-1.5 flex flex-wrap gap-x-3 text-[12.5px] text-text-2 tabular-nums" data-kbju>
            <b className="font-medium text-text">{d.kbju[0]} ккал</b>
            {(["Б", "Ж", "У"] as const).map((k, i) => (
              <span key={k}>
                <span className="text-text-3">{k}</span> {d.kbju![i + 1]}
              </span>
            ))}
          </span>
        )}
      </span>
      <b className="font-medium tabular-nums">{rub(d.price)}</b>
    </li>
  );
}

function VenueContent({ v, kbju, onKbju }: { v: VenueView; kbju: boolean; onKbju: () => void }) {
  return (
    <>
      <div className="text-sm text-text-2">{v.kind}</div>
      <div className="mt-1 text-[26px] leading-[1.15] font-semibold tracking-[-.03em]">{v.name}</div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-text-2">
        <span className="inline-flex items-center gap-1.5">
          <MapPin size={15} strokeWidth={1.6} className="text-text-3" />
          {v.building}, {v.floor}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock3 size={15} strokeWidth={1.6} className="text-text-3" />
          с {t(v.open)} до {t(v.close)}
        </span>
        {v.perk && (
          <span className="inline-flex items-center gap-1.5">
            <BadgePercent size={15} strokeWidth={1.6} className="text-text-3" />
            {v.perk}
          </span>
        )}
      </div>

      {v.coffee && (
        <Link href="/coffee" data-coffee-link className="mt-5 flex items-center gap-3.5 rounded-2xl bg-s3 px-3.5 py-3 transition-colors duration-150 hover:bg-s1">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-s2 text-(--cc)">
            <Coffee size={18} strokeWidth={1.7} />
          </span>
          <span className="min-w-0 flex-1">
            <b className="block font-medium">Random Coffee</b>
            <small className="text-[13px] text-text-3">
              {v.coffee.day}, {v.coffee.time}
            </small>
          </span>
          {v.coffee.partner && <span className="text-sm text-text-2">{v.coffee.partner}</span>}
        </Link>
      )}

      <section aria-label="Загруженность" className="mt-6">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-semibold">{v.crowd ? `Сейчас ${CROWD[v.crowd].toLowerCase()}` : "Закрыто"}</h3>
          {v.rushAt && <span className="text-[13px] text-text-3" data-rush>Наплыв в {t(v.rushAt)}</span>}
        </div>
        <Load v={v} />
      </section>

      <div className="mt-8 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-[-.02em]">Меню</h2>
        <button
          type="button"
          aria-pressed={kbju}
          onClick={onKbju}
          data-kbju-toggle
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-medium transition-[background,color,transform] duration-150 active:scale-[.97]",
            kbju ? "bg-text text-bg" : "bg-s3 text-text-2 hover:text-text",
          )}
        >
          <Activity size={14} strokeWidth={1.9} />
          КБЖУ
        </button>
      </div>
      {v.menu.map((s, i) => (
        <section key={s.title} aria-label={s.title} className={i ? "mt-6" : "mt-3"}>
          <h3 className="font-semibold">{s.title}</h3>
          <ul className="rows mt-1 [--row-inset:0px]">
            {s.items.map((d) => (
              <DishRow key={d.name} d={d} kbju={kbju} />
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

export function FoodView({ venues, initial }: { venues: VenueView[]; initial: string | null }) {
  const [openSlug, setOpenSlug] = useState<string | null>(initial);
  const [open, setOpen] = useState(initial !== null);
  const [kbju, setKbju] = useState(false);
  const current = venues.find((v) => v.slug === openSlug);
  const close = useCallback(() => {
    setOpen(false);
    window.history.replaceState(null, "", "/food");
  }, []);
  const show = (v: VenueView) => {
    setOpenSlug(v.slug);
    setOpen(true);
    window.history.replaceState(null, "", `/food?place=${v.slug}`);
  };

  return (
    <>
      <h1 className="text-[34px] leading-[1.15] font-medium tracking-[-.03em] max-sm:text-[28px]">Еда</h1>
      <div className="mt-9 grid grid-cols-3 gap-4 max-[1000px]:grid-cols-2 max-[640px]:grid-cols-1">
        {venues.map((v) => (
          <Card key={v.slug} v={v} onOpen={() => show(v)} />
        ))}
      </div>
      <Modal open={open} onClose={close} accent={`var(--c-${current?.color ?? "econ"})`} title={current?.name ?? "Заведение"} width={560} sheet="full">
        {current && <VenueContent v={current} kbju={kbju} onKbju={() => setKbju((x) => !x)} />}
      </Modal>
    </>
  );
}
