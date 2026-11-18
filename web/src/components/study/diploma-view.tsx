import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { creditsLabel } from "@/lib/phrases";
import { cn } from "@/lib/utils";
import type { DiplomaData, DiplomaRow } from "@/server/data/types";

const H2 = "mb-2 flex items-baseline gap-2.5 text-lg font-semibold tracking-[-.02em]";

function Row({ r, extra }: { r: DiplomaRow; extra?: string }) {
  const inner = (
    <>
      <span className="min-w-0">
        <span className="flex items-center gap-2.5 font-medium">
          <i className="size-2 shrink-0 rounded-full" style={{ background: r.color ? `var(--c-${r.color})` : "var(--text-3)" }} />
          <span className="truncate">{r.title}</span>
        </span>
        <span className="mt-px ml-[18px] block text-[13px] text-text-3">
          {r.when}, {creditsLabel(r.credits)}
          {extra && `, ${extra}`}
          {r.parts && `, ${r.parts.includes(" и ") ? "оценки" : "оценка"} ${r.parts}`}
        </span>
      </span>
      <span className="text-right">
        <b className="block text-lg leading-tight font-semibold tracking-[-.02em] tabular-nums">{r.grade}</b>
        <small className="block text-[13px] whitespace-nowrap text-text-3">{r.word}</small>
      </span>
    </>
  );
  const cls = "-mx-3.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-[14px] px-3.5 py-3";
  return r.href ? (
    <Link href={r.href} data-diploma-row className={cn(cls, "transition-colors duration-150 hover:bg-hover")}>
      {inner}
    </Link>
  ) : (
    <div data-diploma-row className={cls}>
      {inner}
    </div>
  );
}

function Group({ title, rows, extra }: { title: string; rows: DiplomaRow[]; extra?: (r: DiplomaRow) => string | undefined }) {
  if (!rows.length) return null;
  return (
    <section aria-label={title}>
      <h2 className={H2}>
        {title}
        <span className="text-[15px] font-normal text-text-3 tabular-nums">{rows.length}</span>
      </h2>
      <div className="rows [--row-inset:14px]">
        {rows.map((r) => (
          <Row key={r.title} r={r} extra={extra?.(r)} />
        ))}
      </div>
    </section>
  );
}

/** «Диплом»: что уже в приложении к диплому, что закончится в эту сессию, что идёт несколько семестров, что впереди. */
export function DiplomaView({ d }: { d: DiplomaData }) {
  const stats = [
    { value: String(d.stats.inDiploma), suffix: ` / ${d.stats.total}`, label: "дисциплин уже в дипломе" },
    d.stats.average && { value: d.stats.average, label: "средний балл в дипломе" },
    d.stats.excellentShare != null && { value: `${d.stats.excellentShare}%`, label: "оценок «отлично»" },
  ].filter((s) => !!s);

  return (
    <>
      <Link href="/study?tab=perf" className="-ml-1 inline-flex items-center gap-0.5 text-[15px] text-text-2 transition-colors duration-150 hover:text-text">
        <ChevronLeft size={17} strokeWidth={1.6} />
        Учёба
      </Link>
      <h1 className="mt-1 text-[34px] leading-[1.15] font-medium tracking-[-.03em] max-sm:text-[28px]">Диплом</h1>

      {d.stats.inDiploma === 0 && !d.ongoing.length ? (
        <p className="mt-6 text-[15px] text-text-3">После первой сессии здесь появятся первые оценки, которые пойдут в диплом</p>
      ) : (
        <>
          <section aria-label="Итоги" className="mt-9 flex flex-wrap gap-x-14 gap-y-6 max-sm:gap-x-8">
            {stats.map((s) => (
              <div key={s.label}>
                <b className="block text-[40px] leading-none font-medium tracking-[-.035em] max-sm:text-[32px]">
                  {s.value}
                  {"suffix" in s && <small className="text-xl text-text-3">{s.suffix}</small>}
                </b>
                <span className="text-sm text-text-3">{s.label}</span>
              </div>
            ))}
          </section>

          {d.honors && (
            <section
              aria-label="Диплом с отличием"
              data-honors={d.honors.ok ? "yes" : "no"}
              style={{ "--c": d.honors.ok ? "var(--st-green)" : "var(--st-orange)" } as React.CSSProperties}
              className="mt-9 flex items-start gap-3.5 rounded-3xl bg-s1 px-5 py-4"
            >
              <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-(--c)" />
              <span>
                <b className="block text-[17px] font-semibold tracking-[-.01em]">Диплом с отличием</b>
                <span className="mt-0.5 block text-sm text-text-2">{d.honors.text}</span>
              </span>
            </section>
          )}
        </>
      )}

      <div className="mt-12 grid grid-cols-[minmax(0,1fr)] gap-12 min-[1000px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] min-[1000px]:gap-14">
        <div className="flex flex-col gap-12">
          <Group title="Уже в дипломе" rows={d.done} />
        </div>
        <div className="flex flex-col gap-12">
          <Group title="Закончатся в эту сессию" rows={d.closing} />
          <Group title="Идут несколько семестров" rows={d.ongoing} extra={(r) => d.ongoing.find((o) => o.title === r.title)?.progress} />
        </div>
      </div>

      {d.planned.length > 0 && (
        <section aria-labelledby="planned" className="mt-14">
          <h2 id="planned" className={H2}>
            Впереди по учебному плану
          </h2>
          <div className="mt-3 grid grid-cols-3 gap-4 max-[1000px]:grid-cols-2 max-sm:grid-cols-1">
            {d.planned.map((s) => (
              <div key={s.semester} data-planned={s.semester} className="rounded-3xl bg-s1 px-5 py-4">
                <b className="block text-[15px] font-semibold">{s.label}</b>
                <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                  {s.items.map((i) => (
                    <li key={i.title} className="flex items-baseline justify-between gap-3">
                      <span className="text-text-2">{i.title}</span>
                      <span className="shrink-0 text-[13px] text-text-3 tabular-nums">{i.credits}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
