"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { StudentCardModal } from "@/components/profile/student-card";
import { Modal } from "@/components/time/modal";
import { useToast } from "@/components/ui/toast";
import { MAX_PINNED, type TileId } from "@/lib/tiles";
import { cn } from "@/lib/utils";
import { setPinnedTiles } from "@/server/today/actions";
import type { StudentCardView, TeacherView } from "@/server/data/types";
import { TileIcon, type TileIconName } from "./tile-icons";

// Знаки Solar (bold duotone) в цвете раздела; цвета — токены курсов, статусов и акцента.
// href — ссылка; card / teachers — плитка открывает окно
type Tile = { id: TileId; label: string; icon: TileIconName; color: string } & (
  | { href: string }
  | { action: "card" | "teachers" }
);
const TILES: Tile[] = [
  { id: "courses", label: "Мои курсы", icon: "courses", color: "var(--c-econ)", href: "/study" },
  { id: "grades", label: "Оценки", icon: "grades", color: "var(--st-green)", href: "/study?tab=perf" },
  { id: "rating", label: "Рейтинг", icon: "rating", color: "var(--c-hist)", href: "/study/rating" },
  { id: "documents", label: "Справки", icon: "documents", color: "var(--st-violet)", href: "/office" },
  { id: "card", label: "Орбита ID", icon: "card", color: "var(--accent)", action: "card" },
  { id: "teachers", label: "Преподаватели", icon: "teachers", color: "var(--c-world)", action: "teachers" },
  { id: "library", label: "Библиотека", icon: "library", color: "var(--c-micro)", href: "/library" },
  { id: "clubs", label: "Клубы", icon: "clubs", color: "var(--c-eng)", href: "/clubs" },
  { id: "print", label: "Печать", icon: "print", color: "var(--c-law)", href: "/print" },
];

const TILE = "group flex min-w-0 flex-col items-center gap-3 text-center text-[15px] font-medium tracking-[-.01em]";
const SMALL = "group relative flex min-w-0 flex-col items-center gap-2 rounded-2xl text-center text-[13.5px] font-medium tracking-[-.01em]";
const FACE =
  "grid aspect-square w-full place-items-center rounded-3xl bg-s1 transition-colors duration-200 group-hover:bg-s2";
const FACE_SMALL = "grid aspect-square w-full place-items-center rounded-[20px] bg-s1 transition-[background,box-shadow] duration-200 group-hover:bg-s2";
const ICON =
  "h-auto w-[46%] transition-transform duration-[450ms] ease-spring group-hover:-translate-y-0.5 group-hover:scale-[1.07] group-active:scale-[.97]";

function TeacherRow({ t }: { t: TeacherView }) {
  const inner = (
    <>
      <span className="mono grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold" style={{ background: t.gradient }}>
        {t.initials}
      </span>
      <span className="min-w-0 flex-1">
        <b className="block truncate font-medium">{t.name}</b>
        {t.courses.map((c) => (
          <span key={c.title} className="flex items-center gap-2 text-sm text-text-3">
            <i className="size-1.5 shrink-0 rounded-full" style={{ background: `var(--c-${c.color})` }} />
            <span className="truncate">
              {c.title}, {c.role.toLowerCase()}
            </span>
          </span>
        ))}
      </span>
      {t.cons && (
        <span className="text-right whitespace-nowrap">
          <span className="block text-sm text-text-2">{t.cons.when}</span>
          <span className="block text-[13px] text-text-3">консультация</span>
        </span>
      )}
    </>
  );
  return (
    <Link href={`/people/${t.slug}`} data-teacher={t.name} className="-mx-3 flex items-center gap-3.5 rounded-[14px] px-3 py-3 transition-colors duration-150 hover:bg-hover">
      {inner}
    </Link>
  );
}

type Dlg = "more" | "teachers" | "card" | null;

/**
 * Быстрый доступ: до пяти закреплённых плиток и «Ещё» — окно со всеми сервисами.
 * В окне «Настроить»: выбрать, что закрепить на главной (сохраняется на сервере, User.tiles).
 */
export function QuickTiles({ card, teachers, pinned }: { card: StudentCardView | null; teachers: TeacherView[]; pinned: TileId[] }) {
  const [dlg, setDlg] = useState<Dlg>(null);
  // список преподавателей рисуем с первого открытия: на «Сегодня» он не нужен, пока окно не открыли
  const [opened, setOpened] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<TileId[]>(pinned);
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast, node } = useToast();
  const close = useCallback(() => {
    setDlg(null);
    setEditing(false);
  }, []);

  const shown = pinned.map((id) => TILES.find((t) => t.id === id)!).filter(Boolean);

  const activate = (tile: Tile) => {
    if ("href" in tile) return;
    if (tile.action === "teachers") setOpened(true);
    setEditing(false);
    setDlg(tile.action === "card" && !card ? null : tile.action);
  };

  const tileEl = (tile: Tile, small: boolean) => {
    const inner = (
      <>
        <span className={small ? FACE_SMALL : FACE} style={{ color: tile.color }}>
          <TileIcon name={tile.icon} className={ICON} />
        </span>
        <span className="max-w-full truncate">{tile.label}</span>
      </>
    );
    const cls = small ? SMALL : TILE;
    if (small && editing) {
      const n = draft.indexOf(tile.id);
      const full = n < 0 && draft.length >= MAX_PINNED;
      return (
        <button
          key={tile.id}
          type="button"
          aria-pressed={n >= 0}
          disabled={full}
          data-pin={tile.id}
          onClick={() => setDraft((d) => (n >= 0 ? (d.length > 1 ? d.filter((x) => x !== tile.id) : d) : [...d, tile.id]))}
          className={cn(cls, "disabled:opacity-35", n >= 0 && "[&>span:first-child]:shadow-[inset_0_0_0_2px_var(--accent)]")}
        >
          {inner}
          <span
            className={cn(
              "absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full text-[12px] font-semibold tabular-nums",
              n >= 0 ? "bg-accent text-white" : "shadow-[inset_0_0_0_1.5px_var(--line)]",
            )}
          >
            {n >= 0 ? n + 1 : ""}
          </span>
        </button>
      );
    }
    if ("href" in tile)
      return (
        <Link key={tile.id} href={tile.href} className={cls} data-tile={tile.id} onClick={() => setDlg(null)}>
          {inner}
        </Link>
      );
    if (tile.action === "card" && !card)
      return (
        <Link key={tile.id} href="/profile" className={cls} data-tile={tile.id}>
          {inner}
        </Link>
      );
    return (
      <button key={tile.id} type="button" className={cls} data-tile={tile.id} onClick={() => activate(tile)}>
        {inner}
      </button>
    );
  };

  const save = () =>
    start(async () => {
      const r = await setPinnedTiles(draft);
      toast(r.ok ? r.message : r.error, r.ok ? "ok" : "error");
      if (r.ok) {
        setEditing(false);
        router.refresh();
      }
    });

  return (
    <nav aria-label="Быстрый доступ" className="mt-14 grid grid-cols-6 gap-4 max-[900px]:grid-cols-3">
      {shown.map((t) => tileEl(t, false))}
      <button type="button" className={TILE} data-tile="more" onClick={() => setDlg("more")}>
        <span className={FACE} style={{ color: "var(--text-2)" }}>
          <TileIcon name="more" className={ICON} />
        </span>
        Ещё
      </button>

      <Modal open={dlg === "more"} onClose={close} accent="var(--accent)" cover={false} title="Все сервисы" width={560}>
        <div className="mb-5 flex items-center justify-between gap-4 pr-10">
          <h2 className="text-[22px] font-semibold tracking-[-.025em]">{editing ? "На главной" : "Все сервисы"}</h2>
          {editing ? (
            <button type="button" disabled={pending} onClick={save} data-pin-save className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-text px-4 text-sm font-medium text-bg disabled:opacity-40">
              <Check size={15} strokeWidth={2} />
              Готово
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraft(pinned);
                setEditing(true);
              }}
              data-pin-edit
              className="h-9 rounded-xl bg-s3 px-4 text-sm font-medium text-text-2 hover:text-text"
            >
              Настроить
            </button>
          )}
        </div>
        {editing && (
          <p className="-mt-3 mb-4 text-sm text-text-3" data-pin-count>
            Закреплено {draft.length} из {MAX_PINNED}
          </p>
        )}
        <div className="grid grid-cols-4 gap-3 max-sm:grid-cols-3">{TILES.map((t) => tileEl(t, true))}</div>
      </Modal>

      <Modal open={dlg === "teachers"} onClose={close} accent="var(--c-world)" cover={false} title="Преподаватели" width={480}>
        <h2 className="mb-2 text-[22px] font-semibold tracking-[-.025em]">Преподаватели</h2>
        <div className="rows [--row-inset:12px]">
          {opened && teachers.map((t) => <TeacherRow key={t.name} t={t} />)}
        </div>
        {!teachers.length && <p className="text-[15px] text-text-3">Курсов пока нет</p>}
      </Modal>
      {card && <StudentCardModal card={card} open={dlg === "card"} onClose={close} />}
      {node}
    </nav>
  );
}
