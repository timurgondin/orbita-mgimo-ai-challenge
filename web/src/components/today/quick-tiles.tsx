"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { StudentCardButton } from "@/components/profile/student-card";
import { Modal } from "@/components/time/modal";
import type { StudentCardView, TeacherView } from "@/server/data/types";
import { TileIcon, type TileIconName } from "./tile-icons";

// Знаки Solar (bold duotone) в цвете раздела; цвета — токены курсов, статусов и акцента.
// href — ссылка; card / teachers — плитка открывает окно
type Tile = { label: string; icon: TileIconName; color: string } & (
  | { href: string }
  | { action: "card" | "teachers" }
);
const TILES: Tile[] = [
  { label: "Мои курсы", icon: "courses", color: "var(--c-econ)", href: "/study" },
  { label: "Оценки", icon: "grades", color: "var(--st-green)", href: "/study?tab=perf" },
  { label: "Рейтинг", icon: "rating", color: "var(--c-hist)", href: "/study/rating" },
  { label: "Справки", icon: "documents", color: "var(--st-violet)", href: "/office" },
  { label: "Орбита ID", icon: "card", color: "var(--accent)", action: "card" },
  { label: "Преподаватели", icon: "teachers", color: "var(--c-world)", action: "teachers" },
  { label: "Библиотека", icon: "library", color: "var(--c-micro)", href: "/library" },
  { label: "Клубы", icon: "clubs", color: "var(--c-eng)", href: "/clubs" },
  { label: "Печать", icon: "print", color: "var(--c-law)", href: "/print" },
];

const TILE = "group flex min-w-0 flex-col items-center gap-2.5 text-center text-[14px] font-medium tracking-[-.01em] max-[1100px]:text-[13px] max-[900px]:text-[15px]";
const FACE =
  "grid aspect-square w-full place-items-center rounded-3xl bg-s1 transition-colors duration-200 group-hover:bg-s2";
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

export function QuickTiles({ card, teachers }: { card: StudentCardView | null; teachers: TeacherView[] }) {
  const [open, setOpen] = useState(false);
  // список рисуем с первого открытия: на «Сегодня» он не нужен, пока окно не открыли
  const [opened, setOpened] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <nav aria-label="Быстрый доступ" className="mt-14 grid grid-cols-9 gap-3.5 max-[1100px]:gap-3 max-[900px]:grid-cols-3">
      {TILES.map((tile) => {
        const inner = (
          <>
            <span className={FACE} style={{ color: tile.color }}>
              <TileIcon name={tile.icon} className={ICON} />
            </span>
            {tile.label}
          </>
        );
        if ("href" in tile) {
          return (
            <Link key={tile.label} href={tile.href} className={TILE}>
              {inner}
            </Link>
          );
        }
        if (tile.action === "card") {
          return card ? (
            <StudentCardButton key={tile.label} card={card} className={TILE}>
              {inner}
            </StudentCardButton>
          ) : (
            <Link key={tile.label} href="/profile" className={TILE}>
              {inner}
            </Link>
          );
        }
        return (
          <button
            key={tile.label}
            type="button"
            className={TILE}
            onClick={() => {
              setOpened(true);
              setOpen(true);
            }}
          >
            {inner}
          </button>
        );
      })}

      <Modal open={open} onClose={close} accent="var(--c-world)" cover={false} title="Преподаватели" width={480}>
        <h2 className="mb-2 text-[22px] font-semibold tracking-[-.025em]">Преподаватели</h2>
        <div className="rows [--row-inset:12px]">
          {opened && teachers.map((t) => <TeacherRow key={t.name} t={t} />)}
        </div>
        {!teachers.length && <p className="text-[15px] text-text-3">Курсов пока нет</p>}
      </Modal>
    </nav>
  );
}
