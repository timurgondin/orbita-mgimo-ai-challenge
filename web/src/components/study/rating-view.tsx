"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, Info, Lock, TrendingUp } from "lucide-react";
import { Modal } from "@/components/time/modal";
import { Segmented } from "@/components/ui/segmented";
import { plural } from "@/lib/phrases";
import { cn } from "@/lib/utils";
import type { RatingData, RatingPeriod } from "@/server/data/types";

/** Ширина контейнера: SVG рисуется в настоящих пикселях, текст не масштабируется вместе с графиком. */
function useWidth(fallback: number) {
  const ref = useRef<HTMLElement>(null);
  const [w, setW] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

const H2 = "mb-1 text-lg font-semibold tracking-[-.02em]";

/**
 * Распределение курса по среднему баллу: столбцы однокурсников приглушённые, твой — акцентом.
 * Пороги «топ-10%» и «топ-25%» — тонкие вертикали. Имён и чужих мест нет — только количество в столбце.
 */
function Histogram({ p }: { p: RatingPeriod }) {
  const [hover, setHover] = useState<number | null>(null);
  const [ref, W] = useWidth(720);
  const H = 220;
  const top = 26;
  const bottom = 28;
  const max = Math.max(...p.bins.map((b) => b.count));
  const slot = W / p.bins.length;
  const bw = Math.min(24, slot - 2);
  const x = (gpa: number) => ((gpa - p.bins[0].from) / (p.bins.length * 0.25)) * W;
  const y = (c: number) => top + (H - top - bottom) * (1 - c / max);
  const h = hover != null ? p.bins[hover] : null;
  const ticks = [5, 6, 7, 8, 9, 10];

  return (
    <figure ref={ref} className="relative mt-4" data-histogram>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block overflow-visible" role="img" aria-label={`Распределение среднего балла на курсе, твой балл ${p.gpa}`}>
        <line x1={0} x2={W} y1={H - bottom} y2={H - bottom} stroke="var(--line)" strokeWidth={1} />
        {p.cutoffs
          .filter((c) => c.top === 10 || c.top === 25)
          .map((c) => (
            <g key={c.top}>
              <line x1={x(c.gpa)} x2={x(c.gpa)} y1={top - 14} y2={H - bottom} stroke="var(--text-3)" strokeOpacity={0.5} strokeWidth={1} />
              <text x={x(c.gpa) + (c.top === 10 ? 6 : -6)} y={top - 4} textAnchor={c.top === 10 ? "start" : "end"} fontSize={12} fill="var(--text-3)">
                топ-{c.top}%
              </text>
            </g>
          ))}
        {p.bins.map((b, i) => {
          const cx = i * slot + slot / 2;
          const yy = y(b.count);
          const hh = H - bottom - yy;
          if (!b.count) return null;
          const r = Math.min(4, hh);
          return (
            <path
              key={b.label}
              d={`M${cx - bw / 2},${H - bottom} V${yy + r} Q${cx - bw / 2},${yy} ${cx - bw / 2 + r},${yy} H${cx + bw / 2 - r} Q${cx + bw / 2},${yy} ${cx + bw / 2},${yy + r} V${H - bottom} Z`}
              fill={b.mine ? "var(--accent)" : "color-mix(in srgb, var(--text-3) 38%, transparent)"}
              opacity={hover != null && hover !== i ? 0.55 : 1}
            />
          );
        })}
        {p.bins.map((b, i) =>
          b.mine ? (
            <text key="me" x={i * slot + slot / 2} y={y(b.count) - 8} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="var(--text)">
              ты
            </text>
          ) : null,
        )}
        {ticks.map((t) => (
          <text key={t} x={x(t)} y={H - 8} textAnchor="middle" fontSize={12} fill="var(--text-3)" className="tabular-nums">
            {t}
          </text>
        ))}
        {/* зоны наведения шире столбца */}
        {p.bins.map((b, i) => (
          <rect key={`hit-${b.label}`} x={i * slot} y={top - 10} width={slot} height={H - bottom - top + 10} fill="transparent" onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} />
        ))}
      </svg>
      {h && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-xl bg-s2 px-3 py-2 text-[13px] whitespace-nowrap shadow-[0_0_0_.5px_var(--line),0_12px_30px_-10px_rgba(0,0,0,.5)]"
          style={{ left: `${((hover! + 0.5) / p.bins.length) * 100}%` }}
        >
          <b className="block font-medium tabular-nums">Средний {h.label}</b>
          <span className="text-text-2">
            {h.count} {plural(h.count, "студент", "студента", "студентов")}
            {h.mine && ", и ты среди них"}
          </span>
        </div>
      )}
      <table className="sr-only">
        <caption>Распределение среднего балла</caption>
        <tbody>
          {p.bins.map((b) => (
            <tr key={b.label}>
              <th>{b.label}</th>
              <td>{b.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Место по семестрам: линия, первое место наверху. Подписаны первая и последняя точки, остальное — по наведению. */
function History({ points, size }: { points: RatingPeriod[]; size: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const [ref, W] = useWidth(520);
  if (points.length < 2) return null;
  const H = 180;
  const pad = 28;
  const worst = Math.max(...points.map((p) => p.rank));
  const best = Math.min(...points.map((p) => p.rank));
  const lo = Math.max(1, best - 6);
  const hi = Math.min(size, worst + 6);
  const x = (i: number) => pad + (i / (points.length - 1)) * (W - pad * 2);
  const y = (rank: number) => 20 + ((rank - lo) / Math.max(1, hi - lo)) * (H - 60);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.rank)}`).join(" ");
  return (
    <figure ref={ref} className="relative mt-4" data-history>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block overflow-visible" role="img" aria-label="Место в рейтинге по семестрам">
        <line x1={pad} x2={W - pad} y1={H - 30} y2={H - 30} stroke="var(--line)" strokeWidth={1} />
        <path d={d} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={p.semester}>
            <circle cx={x(i)} cy={y(p.rank)} r={hover === i ? 6 : 4.5} fill="var(--accent)" stroke="var(--bg)" strokeWidth={2} />
            {(i === 0 || i === points.length - 1 || hover === i) && (
              <text x={x(i)} y={y(p.rank) - 12} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--text)" className="tabular-nums">
                {p.rank}
              </text>
            )}
            <text x={x(i)} y={H - 10} textAnchor="middle" fontSize={12} fill="var(--text-3)">
              {p.semester} сем.
            </text>
            <rect x={x(i) - 30} y={0} width={60} height={H - 30} fill="transparent" onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} />
          </g>
        ))}
      </svg>
      {hover != null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-xl bg-s2 px-3 py-2 text-[13px] whitespace-nowrap shadow-[0_0_0_.5px_var(--line),0_12px_30px_-10px_rgba(0,0,0,.5)]"
          style={{ left: `${(x(hover) / W) * 100}%` }}
        >
          <b className="block font-medium">{points[hover].title}</b>
          <span className="text-text-2 tabular-nums">
            {points[hover].rank} место, средний {points[hover].gpa}
          </span>
        </div>
      )}
      <table className="sr-only">
        <caption>Место по семестрам</caption>
        <tbody>
          {points.map((p) => (
            <tr key={p.semester}>
              <th>{p.title}</th>
              <td>{p.rank}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function RatingView({ d }: { d: RatingData }) {
  const [mode, setMode] = useState<"cumulative" | "semester">("cumulative");
  const [howOpen, setHowOpen] = useState(false);
  const closeHow = useCallback(() => setHowOpen(false), []);
  const cum = d.periods.filter((p) => p.kind === "cumulative");
  const p = d.periods.filter((x) => x.kind === mode).at(-1);
  const prev = mode === "cumulative" ? cum.at(-2) : undefined;

  return (
    <>
      <Link href="/study?tab=perf" className="-ml-1 inline-flex items-center gap-0.5 rounded-lg pr-1.5 text-[15px] text-text-2 transition-colors duration-150 hover:text-text">
        <ChevronLeft size={17} strokeWidth={1.6} />
        Успеваемость
      </Link>
      <div className="mt-1 flex items-end justify-between gap-6 max-sm:flex-col max-sm:items-stretch max-sm:gap-4">
        <div>
          <h1 className="text-[34px] leading-[1.15] font-medium tracking-[-.03em] max-sm:text-[28px]">Рейтинг</h1>
          <div className="mt-1 text-[15px] text-text-2">
            {d.program}, {d.course} курс, {d.size} {plural(d.size, "студент", "студента", "студентов")}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-s1 px-3 text-[13px] text-text-2" data-private>
              <Lock size={13} strokeWidth={1.8} />
              Видно только тебе
            </span>
            <button
              type="button"
              onClick={() => setHowOpen(true)}
              data-how
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-s1 px-3 text-[13px] text-text-2 transition-colors hover:bg-s2 hover:text-text"
            >
              <Info size={13} strokeWidth={1.8} />
              Как считается
            </button>
          </div>
        </div>
        {p && (
          <Segmented
            label="Какой рейтинг"
            value={mode}
            onChange={setMode}
            items={[
              { id: "cumulative", label: "Накопленный" },
              { id: "semester", label: "Последняя сессия" },
            ]}
          />
        )}
      </div>

      {!p ? (
        <p className="mt-9 text-[15px] text-text-3">Рейтинг появится после первой сессии</p>
      ) : (
        <div key={mode} className="view-in">
          <section aria-label="Твоё место" className="mt-9 flex flex-wrap items-end gap-x-14 gap-y-6 max-sm:gap-x-8">
            <div>
              <b className="block text-[56px] leading-none font-medium tracking-[-.04em] tabular-nums max-sm:text-[44px]" data-rank>
                {p.rank}
              </b>
              <span className="text-sm text-text-3">место из {d.size}</span>
            </div>
            <div>
              <b className="block text-[40px] leading-none font-medium tracking-[-.035em] max-sm:text-[32px]">топ-{p.top}%</b>
              <span className="text-sm text-text-3">{prev ? (prev.rank === p.rank ? "как после прошлой сессии" : `на ${Math.abs(prev.rank - p.rank)} ${plural(Math.abs(prev.rank - p.rank), "место", "места", "мест")} ${prev.rank > p.rank ? "выше" : "ниже"}, чем после прошлой сессии`) : p.title}</span>
            </div>
            <div>
              <b className="block text-[40px] leading-none font-medium tracking-[-.035em] tabular-nums max-sm:text-[32px]">{p.gpa}</b>
              <span className="text-sm text-text-3">твой средний, медиана курса {p.median}</span>
            </div>
          </section>

          <section aria-labelledby="dist" className="mt-12">
            <h2 id="dist" className={H2}>
              Где ты среди однокурсников
            </h2>
            <Histogram p={p} />
          </section>

          <div className="mt-12 grid grid-cols-[minmax(0,1fr)] gap-12 min-[1000px]:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <section aria-labelledby="perks">
              <h2 id="perks" className={cn(H2, "mb-2")}>
                Что даёт место
              </h2>
              <div className="rows [--row-inset:14px]">
                {d.perks.map((k) => (
                  <div key={k.title} data-perk={k.ok ? "ok" : "no"} className="-mx-3.5 grid grid-cols-[52px_minmax(0,1fr)] items-start gap-x-3 px-3.5 py-3">
                    <span className="pt-0.5 text-[15px] text-text-3 tabular-nums">{k.top}%</span>
                    <span className="min-w-0">
                      <b className="block font-medium">{k.title}</b>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[13px]" style={{ color: k.ok ? "var(--st-green)" : "var(--st-orange)" }}>
                        {k.ok ? <Check size={14} strokeWidth={2} /> : <TrendingUp size={14} strokeWidth={2} />}
                        {k.status}
                      </span>
                      <span className="block text-[13px] text-text-3">{k.note}</span>
                    </span>
                  </div>
                ))}
              </div>
            </section>
            <div className="flex flex-col gap-12">
              {cum.length > 1 && (
                <section aria-labelledby="hist">
                  <h2 id="hist" className={H2}>
                    Как менялось место
                  </h2>
                  <History points={cum} size={d.size} />
                </section>
              )}
              {cum.length <= 1 && (
                <button type="button" onClick={() => setHowOpen(true)} className="self-start text-sm text-text-2 hover:text-text">
                  Как считается рейтинг ›
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <Modal open={howOpen} onClose={closeHow} accent="var(--accent)" cover={false} title="Как считается рейтинг" width={520}>
        <div data-how-modal>
          <h2 className="text-[22px] font-semibold tracking-[-.025em]">Как считается рейтинг</h2>
          <div className="mt-5 rounded-2xl bg-s3 px-4 py-3.5 text-center text-[15px]">
            <span className="text-text-2">Средний балл</span> = <span className="text-text-2">Σ оценка × кредиты</span> / <span className="text-text-2">Σ кредитов</span>
          </div>
          <ul className="mt-5 flex flex-col gap-3 text-[15px]">
            {[
              ["Только экзамены", "Зачёты в средний не входят. Предмет на 6 кредитов весит вдвое больше, чем на 3"],
              ["Накопленный и за сессию", "Накопленный — за всё обучение, пересчитывается после каждой сессии. «Последняя сессия» — только её оценки"],
              ["С кем сравнение", "Со своей программой и курсом. При равном балле выше тот, у кого больше кредитов"],
              ["Кто видит", "Своё место видишь только ты. Однокурсников на графике нет — только сколько человек с каким баллом"],
            ].map(([t, x]) => (
              <li key={t}>
                <b className="block font-medium">{t}</b>
                <span className="text-sm text-text-2">{x}</span>
              </li>
            ))}
          </ul>
        </div>
      </Modal>
    </>
  );
}
