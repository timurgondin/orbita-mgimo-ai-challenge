import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ReviewItem } from "@/server/data/teach-types";

const STATUS: Record<string, { label: string; color: string }> = {
  submitted: { label: "Новая", color: "var(--st-blue)" },
  reviewing: { label: "Проверяется", color: "var(--st-violet)" },
  graded: { label: "", color: "var(--st-green)" },
  returned: { label: "На доработке", color: "var(--st-orange)" },
};

function Body({ w }: { w: ReviewItem }) {
  const s = STATUS[w.status];
  return (
    <>
      <span aria-hidden="true" className="mono grid size-9 shrink-0 place-items-center rounded-full text-[13px] font-semibold" style={{ background: w.gradient }}>
        {w.initials}
      </span>
      <span className="min-w-0 flex-1">
        <b className="block truncate font-medium">{w.student}</b>
        <small className="mt-px flex items-center gap-2 text-sm text-text-3">
          <i className="size-1.5 shrink-0 rounded-full" style={{ background: `var(--c-${w.color})` }} />
          <span className="truncate">{w.task}</span>
        </small>
      </span>
      <span className="text-right whitespace-nowrap">
        {w.status === "graded" ? (
          <b className="block text-[15px] font-medium tabular-nums">{String(w.score).replace(".", ",")}<small className="ml-0.5 text-[13px] font-normal text-text-3">/10</small></b>
        ) : (
          <span className="block text-sm" style={{ color: s?.color }}>
            {s?.label}
          </span>
        )}
        <small className={cn("mt-px block text-[13px]", w.late ? "text-urgent" : "text-text-3")}>{w.late ? "с опозданием" : w.sent}</small>
      </span>
    </>
  );
}

const ROW = "flex w-full items-center gap-3.5 rounded-[14px] px-3 py-[11px] text-left transition-colors duration-150 hover:bg-hover";

/** Строка работы: аватар студента, имя, задание с точкой цвета курса; справа — статус или оценка и когда сдано. */
export function ReviewRow({ w, href, onOpen }: { w: ReviewItem; href?: string; onOpen?: () => void }) {
  return href ? (
    <Link href={href} data-review-row={w.id} className={cn(ROW, "-mx-3 w-[calc(100%+24px)]")}>
      <Body w={w} />
    </Link>
  ) : (
    <button type="button" onClick={onOpen} data-review-row={w.id} className={cn(ROW, "-mx-3 w-[calc(100%+24px)]")}>
      <Body w={w} />
    </button>
  );
}
