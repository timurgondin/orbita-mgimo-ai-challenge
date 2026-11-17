import Link from "next/link";
import { SectionHeader } from "./section-header";
import type { SoonItem } from "@/server/data/types";
import { cn } from "@/lib/utils";

function Item({ d }: { d: SoonItem }) {
  return (
    <Link
      href={`/study?tab=tasks&task=${d.taskId}`}
      className="-mx-3 flex items-center gap-3.5 rounded-[14px] px-3 py-[11px] transition-colors duration-150 hover:bg-hover"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{d.title}</div>
        <div className="mt-px flex items-center gap-2 text-sm text-text-3">
          <i className="size-1.5 shrink-0 rounded-full" style={{ background: `var(--c-${d.color})` }} />
          <span className="truncate">{d.course}</span>
        </div>
      </div>
      <div className="text-right whitespace-nowrap">
        <div className={cn("text-sm", d.today ? "text-urgent" : "text-text-2")}>{d.due}</div>
        <div className="mt-px text-[13px] text-text-3">{d.note}</div>
      </div>
    </Link>
  );
}

export function SoonList({ items }: { items: SoonItem[] }) {
  return (
    <section aria-label="Скоро">
      <SectionHeader title="Скоро" linkLabel="Все задания" href="/study?tab=tasks" />
      {items.map((d) => (
        <Item key={d.id} d={d} />
      ))}
    </section>
  );
}
