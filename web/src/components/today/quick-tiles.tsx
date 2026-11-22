"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Plus, X } from "lucide-react";
import { StudentCardModal } from "@/components/profile/student-card";
import { Modal } from "@/components/time/modal";
import { useToast } from "@/components/ui/toast";
import { MAX_PINNED, type TileId } from "@/lib/tiles";
import { cn } from "@/lib/utils";
import { setTileOrder } from "@/server/today/actions";
import type { StudentCardView } from "@/server/data/types";
import { TileIcon, type TileIconName } from "./tile-icons";

// Знаки Solar (bold duotone) в цвете раздела; цвета — токены курсов, статусов и акцента.
// href — ссылка; card — плитка открывает окно
type Tile = { id: TileId; label: string; icon: TileIconName; color: string } & (
  | { href: string }
  | { action: "card" }
);
const TILES: Tile[] = [
  { id: "courses", label: "Мои курсы", icon: "courses", color: "var(--c-econ)", href: "/study" },
  { id: "grades", label: "Оценки", icon: "grades", color: "var(--st-green)", href: "/study?tab=perf" },
  { id: "rating", label: "Рейтинг", icon: "rating", color: "var(--c-hist)", href: "/study/rating" },
  { id: "documents", label: "Справки", icon: "documents", color: "var(--st-violet)", href: "/office" },
  { id: "card", label: "Орбита ID", icon: "card", color: "var(--accent)", action: "card" },
  { id: "library", label: "Библиотека", icon: "library", color: "var(--c-micro)", href: "/library" },
  { id: "clubs", label: "Клубы", icon: "clubs", color: "var(--c-eng)", href: "/clubs" },
  { id: "print", label: "Печать", icon: "print", color: "var(--c-law)", href: "/print" },
  { id: "coffee", label: "Random Coffee", icon: "coffee", color: "var(--c-hist)", href: "/coffee" },
  { id: "people", label: "Люди", icon: "people", color: "var(--c-py)", href: "/people" },
  { id: "rooms", label: "Аудитории", icon: "rooms", color: "var(--c-world)", href: "/rooms" },
  { id: "food", label: "Еда", icon: "food", color: "var(--c-econ)", href: "/food" },
  { id: "redbutton", label: "Красная кнопка", icon: "redbutton", color: "var(--st-red)", href: "/redbutton" },
];

const TILE = "group flex min-w-0 flex-col items-center gap-3 text-center text-[15px] font-medium tracking-[-.01em]";
const SMALL = "group relative flex min-w-0 flex-col items-center gap-2 rounded-2xl text-center text-[13.5px] font-medium tracking-[-.01em]";
const FACE =
  "grid aspect-square w-full place-items-center rounded-3xl bg-s1 transition-colors duration-200 group-hover:bg-s2";
const FACE_SMALL = "grid aspect-square w-full place-items-center rounded-[20px] bg-s1 transition-[background,box-shadow] duration-200 group-hover:bg-s2";
const ICON =
  "h-auto w-[46%] transition-transform duration-[450ms] ease-spring group-hover:-translate-y-0.5 group-hover:scale-[1.07] group-active:scale-[.97]";

type Dlg = "more" | "card" | null;

const byId = (id: TileId) => TILES.find((t) => t.id === id)!;
const moveTo = (list: TileId[], id: TileId, to: number) => {
  const next = list.filter((x) => x !== id);
  next.splice(to, 0, id);
  return next;
};
const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const ROUND = "grid size-9 shrink-0 place-items-center rounded-full bg-s3 text-text-2 transition-colors hover:text-text";

/**
 * Быстрый доступ: пять первых плиток из порядка студента и «Ещё» — окно со всеми сервисами.
 * «Настроить»: плитки перетаскиваются (мышь, палец — pointer events, работает и в Safari на iPhone) или стрелками с клавиатуры;
 * первые пять — на главной. Порядок хранится на сервере (User.tiles).
 */
export function QuickTiles({ card, order }: { card: StudentCardView | null; order: TileId[] }) {
  const [dlg, setDlg] = useState<Dlg>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<TileId[]>(order);
  const [dragId, setDragId] = useState<TileId | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast, node } = useToast();

  const grid = useRef<HTMLDivElement>(null);
  const draftRef = useRef(draft);
  const drag = useRef<{ id: TileId; x0: number; y0: number; gx: number; gy: number; active: boolean } | null>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const before = useRef<Map<TileId, DOMRect> | null>(null);
  const keepFocus = useRef<TileId | null>(null);
  const swallowClick = useRef(false);

  const close = useCallback(() => {
    setDlg(null);
    setEditing(false);
  }, []);

  const shown = order.slice(0, MAX_PINNED).map(byId);
  const list = editing ? draft : order;

  const tileEl = (id: TileId) => grid.current?.querySelector<HTMLElement>(`[data-pin="${id}"]`) ?? null;

  /** Место плитки в сетке без учёта анимаций и сдвигов (offset* не видят transform) — для попадания и для «под пальцем». */
  const slot = (el: HTMLElement) => {
    const g = grid.current!.getBoundingClientRect();
    return { left: g.left + el.offsetLeft, top: g.top + el.offsetTop, right: g.left + el.offsetLeft + el.offsetWidth, bottom: g.top + el.offsetTop + el.offsetHeight };
  };

  /** Перетаскиваемая плитка — под пальцем: сдвиг от её места в сетке до точки захвата. */
  const follow = useCallback(() => {
    const d = drag.current;
    const el = d?.active ? tileEl(d.id) : null;
    if (!d || !el) return;
    const r = slot(el);
    el.style.transform = `translate(${pointer.current.x - d.gx - r.left}px, ${pointer.current.y - d.gy - r.top}px) scale(1.06)`;
  }, []);

  useLayoutEffect(() => {
    const prev = before.current;
    before.current = null;
    if (prev && !reduced()) {
      for (const [id, r] of prev) {
        if (id === drag.current?.id && drag.current.active) continue;
        const el = tileEl(id);
        if (!el) continue;
        const n = el.getBoundingClientRect();
        const dx = r.left - n.left;
        const dy = r.top - n.top;
        if (dx || dy) el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 260, easing: "cubic-bezier(.22,1,.36,1)" });
      }
    }
    follow();
    if (keepFocus.current) {
      tileEl(keepFocus.current)?.focus();
      keepFocus.current = null;
    }
  }, [draft, follow]);

  const commit = useCallback((next: TileId[]) => {
    draftRef.current = next;
    setDraft(next);
  }, []);

  /** Переставить плитку; перед этим запомнить, где стояли все, — после перестановки они плавно доедут (FLIP). */
  const reorder = useCallback(
    (id: TileId, to: number) => {
      const cur = draftRef.current;
      const at = Math.max(0, Math.min(cur.length - 1, to));
      if (cur.indexOf(id) === at) return;
      const m = new Map<TileId, DOMRect>();
      grid.current?.querySelectorAll<HTMLElement>("[data-pin]").forEach((el) => m.set(el.dataset.pin as TileId, el.getBoundingClientRect()));
      before.current = m;
      commit(moveTo(cur, id, at));
    },
    [commit],
  );

  // слушатели на окне: при перестановке React переносит узел плитки, и захват указателя (setPointerCapture) потерялся бы
  useEffect(() => {
    if (!editing) return;
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      pointer.current = { x: e.clientX, y: e.clientY };
      if (!d.active) {
        if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 6) return;
        d.active = true;
        setDragId(d.id);
      }
      e.preventDefault();
      follow();
      for (const el of grid.current?.querySelectorAll<HTMLElement>("[data-pin]") ?? []) {
        const id = el.dataset.pin as TileId;
        if (id === d.id) continue;
        const r = slot(el);
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
          reorder(d.id, draftRef.current.indexOf(id));
          break;
        }
      }
    };
    const up = () => {
      const d = drag.current;
      drag.current = null;
      if (!d?.active) return;
      // клик после отпускания не должен сработать как «+»; сбрасываем флаг сразу после него
      swallowClick.current = true;
      setTimeout(() => (swallowClick.current = false), 0);
      const el = tileEl(d.id);
      if (el) {
        const from = el.style.transform;
        el.style.transform = "";
        if (!reduced()) el.animate([{ transform: from }, { transform: "none" }], { duration: 280, easing: "cubic-bezier(.34,1.35,.5,1)" });
      }
      setDragId(null);
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [editing, follow, reorder]);

  const activate = (tile: Tile) => {
    if ("href" in tile) return;
    setEditing(false);
    setDlg(tile.action === "card" && !card ? null : tile.action);
  };

  const face = (tile: Tile, small: boolean) => (
    <span className={small ? FACE_SMALL : FACE} style={{ color: tile.color }}>
      <TileIcon name={tile.icon} className={ICON} />
    </span>
  );

  /** Плитка на главной или в окне «Ещё» (обычный режим): ссылка или кнопка окна. */
  const linkEl = (tile: Tile, small: boolean) => {
    const cls = small ? SMALL : TILE;
    const inner = (
      <>
        {face(tile, small)}
        <span className="max-w-full truncate">{tile.label}</span>
      </>
    );
    const attrs = small ? { "data-pin": tile.id } : {};
    if ("href" in tile)
      return (
        <Link key={tile.id} href={tile.href} className={cls} data-tile={tile.id} {...attrs} onClick={() => setDlg(null)}>
          {inner}
        </Link>
      );
    if (tile.action === "card" && !card)
      return (
        <Link key={tile.id} href="/profile" className={cls} data-tile={tile.id} {...attrs}>
          {inner}
        </Link>
      );
    return (
      <button key={tile.id} type="button" className={cls} data-tile={tile.id} {...attrs} onClick={() => activate(tile)}>
        {inner}
      </button>
    );
  };

  /** Плитка в режиме «Настроить»: тянуть, стрелки двигают, «+» у остальных — поставить на главную последней. */
  const editEl = (tile: Tile, i: number) => {
    const pinned = i < MAX_PINNED;
    const lifted = dragId === tile.id;
    return (
      <button
        key={tile.id}
        type="button"
        data-pin={tile.id}
        aria-label={`${tile.label}: ${pinned ? `на главной, ${i + 1}-я` : "в «Ещё»"}. Стрелки меняют порядок`}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          const r = e.currentTarget.getBoundingClientRect();
          drag.current = { id: tile.id, x0: e.clientX, y0: e.clientY, gx: e.clientX - r.left, gy: e.clientY - r.top, active: false };
        }}
        onClick={() => {
          if (swallowClick.current) {
            swallowClick.current = false;
            return;
          }
          if (!pinned) reorder(tile.id, MAX_PINNED - 1);
        }}
        onKeyDown={(e) => {
          const d = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key];
          if (!d) return;
          e.preventDefault();
          keepFocus.current = tile.id;
          reorder(tile.id, i + d);
        }}
        className={cn(SMALL, "touch-none", lifted ? "z-10 cursor-grabbing [&>span:first-child]:shadow-[0_18px_40px_-12px_rgba(0,0,0,.7)]" : "cursor-grab")}
      >
        {face(tile, true)}
        <span className="max-w-full truncate">{tile.label}</span>
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-1.5 right-1.5 grid size-[22px] place-items-center rounded-full text-[11.5px] font-semibold tabular-nums transition-colors",
            pinned ? "bg-accent text-white" : "bg-s3 text-text-2 group-hover:text-text",
          )}
        >
          {pinned ? i + 1 : <Plus size={13} strokeWidth={2.2} />}
        </span>
      </button>
    );
  };

  const save = () => {
    if (draft.join() === order.join()) return setEditing(false);
    start(async () => {
      const r = await setTileOrder(draft);
      toast(r.ok ? r.message : r.error, r.ok ? "ok" : "error");
      if (r.ok) {
        setEditing(false);
        router.refresh();
      }
    });
  };

  const LABEL = "col-span-full text-[13px] font-medium text-text-3";

  return (
    <nav aria-label="Быстрый доступ" className="mt-14 grid grid-cols-6 gap-4 max-[900px]:grid-cols-3">
      {shown.map((t) => linkEl(t, false))}
      <button type="button" className={TILE} data-tile="more" onClick={() => setDlg("more")}>
        <span className={FACE} style={{ color: "var(--text-2)" }}>
          <TileIcon name="more" className={ICON} />
        </span>
        Ещё
      </button>

      <Modal open={dlg === "more"} onClose={close} accent="var(--accent)" cover={false} closeButton={false} title="Все сервисы" width={640}>
        <div className="mb-6 flex items-center gap-2">
          <h2 className="mr-auto text-[22px] font-semibold tracking-[-.025em]">Все сервисы</h2>
          {editing ? (
            <button type="button" disabled={pending} onClick={save} data-pin-save className="inline-flex h-9 items-center gap-1.5 rounded-full bg-text px-4 text-sm font-medium text-bg transition-transform active:scale-[.97] disabled:opacity-40">
              <Check size={15} strokeWidth={2} />
              Готово
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                commit(order);
                setEditing(true);
              }}
              data-pin-edit
              className="h-9 rounded-full bg-s3 px-4 text-sm font-medium text-text-2 transition-colors hover:text-text"
            >
              Настроить
            </button>
          )}
          <button type="button" onClick={close} aria-label="Закрыть" className={ROUND}>
            <X size={16} strokeWidth={1.8} />
          </button>
        </div>
        <div ref={grid} className={cn("relative grid grid-cols-5 gap-x-3 gap-y-4 max-sm:grid-cols-3", editing && "select-none")} data-pin-grid>
          <div className={cn(LABEL, "flex justify-between gap-3")}>
            На главной
            {editing && <span className="font-normal">Перетащите, чтобы поменять</span>}
          </div>
          {list.slice(0, MAX_PINNED).map((id, i) => (editing ? editEl(byId(id), i) : linkEl(byId(id), true)))}
          <div className={cn(LABEL, "mt-3 border-t border-line pt-5")}>Ещё</div>
          {list.slice(MAX_PINNED).map((id, i) => (editing ? editEl(byId(id), i + MAX_PINNED) : linkEl(byId(id), true)))}
        </div>
      </Modal>

      {card && <StudentCardModal card={card} open={dlg === "card"} onClose={close} />}
      {node}
    </nav>
  );
}
