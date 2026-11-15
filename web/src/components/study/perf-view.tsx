import Link from "next/link";
import type { StudyData } from "@/server/data/types";
import { cn } from "@/lib/utils";

export function PerfView({ perf }: { perf: StudyData["perf"] }) {
  const stats = [
    { value: perf.average, label: "средний балл" },
    perf.rank != null && perf.size != null ? { value: String(perf.rank), label: `место на курсе из ${perf.size}` } : null,
    perf.credits != null ? { value: String(perf.credits), suffix: ` / ${perf.creditsPlan}`, label: "кредитов в семестре" } : null,
  ].filter((s) => s != null);

  return (
    <>
      <section aria-label="Итоги" className="flex flex-wrap gap-x-14 gap-y-6 max-sm:gap-x-8">
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

      <section aria-label="По дисциплинам" className="mt-12">
        <h2 className="mb-3.5 text-lg font-semibold tracking-[-.02em]">По дисциплинам</h2>
        {perf.rows.map((r) => (
          <Link
            key={r.id}
            href="#"
            style={{ "--cc": `var(--c-${r.color})` } as React.CSSProperties}
            className="-mx-3.5 grid grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)_64px_92px] items-center gap-5 rounded-2xl p-3.5 transition-colors duration-150 hover:bg-hover max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:gap-x-3 max-sm:gap-y-2.5"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 font-medium">
                <i className="size-2 shrink-0 rounded-full bg-(--cc)" />
                <span className="truncate">{r.title}</span>
              </div>
              <div className="ml-[18px] text-[13px] text-text-3">{r.sub}</div>
            </div>
            <div className="relative h-1.5 rounded-md bg-s2 max-sm:order-last max-sm:col-span-2">
              <span className="absolute inset-y-0 left-0 rounded-md bg-(--cc)" style={{ width: `${r.fill}%` }} />
            </div>
            <span
              className={cn(
                "text-right text-lg font-semibold tracking-[-.02em] max-sm:hidden",
                r.valueMuted && "text-[15px] font-medium text-text-2",
              )}
            >
              {r.value}
            </span>
            <span className="text-right text-[13px] text-text-3 max-sm:row-start-1 max-sm:col-start-2">
              <span className={cn("hidden max-sm:inline-block max-sm:mr-2 max-sm:text-base max-sm:font-semibold max-sm:text-text", r.valueMuted && "max-sm:text-[14px] max-sm:font-medium max-sm:text-text-2")}>
                {r.value}
              </span>
              {r.valueMuted ? r.forecast : r.forecast && <>прогноз <b className="font-medium text-text-2">{r.forecast}</b></>}
            </span>
          </Link>
        ))}
      </section>

      {perf.exams.length > 0 && (
        <section aria-label="Сессия" className="mt-12">
          <h2 className="mb-3.5 text-lg font-semibold tracking-[-.02em]">Сессия</h2>
          {perf.exams.map((e) => (
            <div key={e.id} className="-mx-3.5 flex items-center gap-4 rounded-2xl px-3.5 py-3 hover:bg-hover">
              <div className="w-[52px] shrink-0 text-center">
                <b className="block text-[22px] leading-none font-medium tracking-[-.02em]">{e.day}</b>
                <small className="text-xs text-text-3">{e.month}</small>
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{e.title}</div>
                <div className="text-sm text-text-3">{e.sub}</div>
              </div>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
