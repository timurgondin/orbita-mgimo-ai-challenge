import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";

export const metadata: Metadata = { title: "О проекте — Орбита" };

// Сторонние материалы и лицензии (полный список — docs/licenses.md). Атрибуция CC BY 4.0 для Solar — здесь.
const GROUPS: { title: string; items: { name: string; author?: string; license: string; href: string }[] }[] = [
  {
    title: "Шрифты",
    items: [
      { name: "Onest", license: "SIL Open Font License 1.1", href: "https://fonts.google.com/specimen/Onest" },
      { name: "Source Serif 4", author: "Adobe", license: "SIL Open Font License 1.1", href: "https://fonts.google.com/specimen/Source+Serif+4" },
    ],
  },
  {
    title: "Иконки",
    items: [
      { name: "Solar", author: "480 Design", license: "CC BY 4.0", href: "https://www.figma.com/community/file/1166831539721848736" },
      { name: "Lucide", license: "ISC", href: "https://lucide.dev" },
      { name: "Thinking Orbs", author: "Jakub Antalik", license: "MIT", href: "https://libraries.dev/orbs" },
    ],
  },
  {
    title: "Библиотеки",
    items: [
      { name: "Next.js, React", license: "MIT", href: "https://nextjs.org" },
      { name: "Prisma", license: "Apache 2.0", href: "https://www.prisma.io" },
      { name: "pdf-lib, qrcode, Argon2", license: "MIT", href: "https://pdf-lib.js.org" },
    ],
  },
];

export default function AboutPage() {
  return (
    <div className="max-w-[640px]">
      <h1 className="text-[34px] leading-[1.15] font-medium tracking-[-.03em] max-sm:text-[28px]">О проекте</h1>
      <p className="mt-3 text-[15px] text-text-2">
        Концепт для конкурса MGIMO×AI Challenge. Университет Будущего, люди и данные вымышлены.
      </p>

      {GROUPS.map((g) => (
        <section key={g.title} className="mt-10">
          <h2 className="mb-1.5 text-lg font-semibold tracking-[-.02em]">{g.title}</h2>
          <div className="rows [--row-inset:14px]">
            {g.items.map((it) => (
              <a
                key={it.name}
                href={it.href}
                target="_blank"
                rel="noreferrer"
                className="group -mx-3.5 flex min-h-[54px] items-center gap-4 rounded-[14px] px-3.5 py-2.5 transition-colors duration-150 hover:bg-hover"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{it.name}</span>
                  {it.author && <span className="block text-sm text-text-3">{it.author}</span>}
                </span>
                <span className="text-sm whitespace-nowrap text-text-3">{it.license}</span>
                <ArrowUpRight size={16} strokeWidth={1.6} className="text-text-3 transition-colors group-hover:text-text" />
              </a>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
