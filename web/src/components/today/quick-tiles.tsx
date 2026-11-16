import Link from "next/link";
import { StudentCardButton } from "@/components/profile/student-card";
import type { StudentCardView } from "@/server/data/types";
import { TileIcon, type TileIconName } from "./tile-icons";

// Знаки Solar (bold duotone) в цвете раздела; цвета — токены курсов, статусов и акцента
const TILES: { label: string; icon: TileIconName; color: string }[] = [
  { label: "Мои курсы", icon: "courses", color: "var(--c-econ)" },
  { label: "Оценки", icon: "grades", color: "var(--st-green)" },
  { label: "Справки", icon: "documents", color: "var(--st-violet)" },
  { label: "Студбилет", icon: "card", color: "var(--accent)" },
  { label: "Преподаватели", icon: "teachers", color: "var(--c-world)" },
  { label: "Библиотека", icon: "library", color: "var(--c-micro)" },
];

const TILE = "group flex flex-col items-center gap-3 text-[15px] font-medium tracking-[-.01em]";
const FACE =
  "grid aspect-square w-full place-items-center rounded-3xl bg-s1 transition-colors duration-200 group-hover:bg-s2";
const ICON =
  "h-auto w-[46%] transition-transform duration-[450ms] ease-spring group-hover:-translate-y-0.5 group-hover:scale-[1.07] group-active:scale-[.97]";

export function QuickTiles({ card }: { card: StudentCardView | null }) {
  return (
    <nav aria-label="Быстрый доступ" className="mt-14 grid grid-cols-6 gap-4 max-[900px]:grid-cols-3">
      {TILES.map(({ label, icon, color }) => {
        const inner = (
          <>
            <span className={FACE} style={{ color }}>
              <TileIcon name={icon} className={ICON} />
            </span>
            {label}
          </>
        );
        return label === "Студбилет" && card ? (
          <StudentCardButton key={label} card={card} className={TILE}>
            {inner}
          </StudentCardButton>
        ) : (
          <Link key={label} href="#" className={TILE}>
            {inner}
          </Link>
        );
      })}
    </nav>
  );
}
