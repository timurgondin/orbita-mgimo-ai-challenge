import { cn } from "@/lib/utils";
import type { BookCard } from "@/server/data/types";

/** Обложка: цвет курса и точечный узор, название — набором. Настоящих обложек нет: книги вымышленные. */
export function Cover({ b, className }: { b: Pick<BookCard, "title" | "author" | "color">; className?: string }) {
  return (
    <span
      aria-hidden="true"
      style={{ "--cc": `var(--c-${b.color})` } as React.CSSProperties}
      className={cn(
        "book-cover relative flex aspect-[2/3] shrink-0 flex-col justify-between overflow-hidden rounded-[6px_10px_10px_6px] p-[calc(var(--fs,11px)*.9)] text-left shadow-[0_8px_20px_-10px_rgba(0,0,0,.6)]",
        className,
      )}
    >
      <b className="relative line-clamp-4 text-[length:var(--fs,11px)] leading-[1.15] font-semibold tracking-[-.01em] text-white">{b.title}</b>
      <small className="relative line-clamp-2 text-[length:calc(var(--fs,11px)*.8)] leading-tight text-white/70">{b.author}</small>
    </span>
  );
}
