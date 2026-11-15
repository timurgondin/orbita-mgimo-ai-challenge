import Link from "next/link";
import { SectionHeader } from "./section-header";
import type { SoonItem } from "@/server/data/types";
import { cn } from "@/lib/utils";

function Item({ d }: { d: SoonItem }) {
  return (
    <Link
      href="#"
      className="-mx-3 flex items-center gap-3.5 rounded-[14px] px-3 py-[11px] transition-colors duration-150 hover:bg-hover"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{d.title}</div>
        <div className="mt-px truncate text-sm text-text-3">{d.subtitle}</div>
      </div>
      <span className={cn("text-sm whitespace-nowrap", d.today ? "text-urgent" : "text-text-2")}>
        {d.due}
      </span>
    </Link>
  );
}

export function SoonList({ items }: { items: SoonItem[] }) {
  return (
    <section aria-label="Скоро">
      <SectionHeader title="Скоро" linkLabel="Все задания" />
      {items.map((d) => (
        <Item key={d.id} d={d} />
      ))}
    </section>
  );
}
