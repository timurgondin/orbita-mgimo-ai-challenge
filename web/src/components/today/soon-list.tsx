import Link from "next/link";
import { SectionHeader } from "./section-header";
import { DEMO_DATE, formatShortWeekday } from "@/lib/demo-clock";
import { deadlines, type Deadline } from "@/lib/mock/deadlines";
import { cn } from "@/lib/utils";

function formatDue(due: string) {
  const [date, time] = due.split("T");
  const today = date === DEMO_DATE;
  return { today, label: `${today ? "Сегодня" : formatShortWeekday(date)}, ${time}` };
}

function Item({ d }: { d: Deadline }) {
  const { today, label } = formatDue(d.due);
  return (
    <Link
      href="#"
      className="-mx-3 flex items-center gap-3.5 rounded-[14px] px-3 py-[11px] transition-colors duration-150 hover:bg-hover"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{d.title}</div>
        <div className="mt-px truncate text-sm text-text-3">{d.subtitle}</div>
      </div>
      <span className={cn("text-sm whitespace-nowrap", today ? "text-urgent" : "text-text-2")}>
        {label}
      </span>
    </Link>
  );
}

export function SoonList() {
  return (
    <section aria-label="Скоро">
      <SectionHeader title="Скоро" linkLabel="Все задания" />
      {deadlines.map((d) => (
        <Item key={d.id} d={d} />
      ))}
    </section>
  );
}
