import Link from "next/link";
import { StudentCardButton } from "@/components/profile/student-card";
import type { StudentCardView } from "@/server/data/types";
import {
  CertificatesIllustration,
  CoursesIllustration,
  GradesIllustration,
  LibraryIllustration,
  StudentCardIllustration,
  TeachersIllustration,
} from "./illustrations";

const TILES = [
  { label: "Мои курсы", Illustration: CoursesIllustration },
  { label: "Оценки", Illustration: GradesIllustration },
  { label: "Справки", Illustration: CertificatesIllustration },
  { label: "Студбилет", Illustration: StudentCardIllustration },
  { label: "Преподаватели", Illustration: TeachersIllustration },
  { label: "Библиотека", Illustration: LibraryIllustration },
];

const TILE = "group flex flex-col items-center gap-3 text-[15px] font-medium tracking-[-.01em]";
const FACE =
  "grid aspect-square w-full place-items-center overflow-hidden rounded-3xl bg-s1 transition-colors duration-200 group-hover:bg-s2 [&_.ill]:h-auto [&_.ill]:w-[64%] [&_.ill]:transition-transform [&_.ill]:duration-[450ms] [&_.ill]:ease-spring group-hover:[&_.ill]:-translate-y-0.5 group-hover:[&_.ill]:scale-[1.06] group-active:[&_.ill]:scale-[.97]";

export function QuickTiles({ card }: { card: StudentCardView | null }) {
  return (
    <nav
      aria-label="Быстрый доступ"
      className="mt-14 grid grid-cols-6 gap-4 max-[900px]:grid-cols-3"
    >
      {TILES.map(({ label, Illustration }) => {
        const inner = (
          <>
            <span className={FACE}>
              <Illustration />
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
