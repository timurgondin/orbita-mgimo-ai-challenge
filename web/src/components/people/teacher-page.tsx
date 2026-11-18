"use client";

import Link from "next/link";
import { ArrowUpRight, ChevronRight, Copy } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { TeacherPageData } from "@/server/data/types";

const H2 = "mb-2 text-lg font-semibold tracking-[-.02em]";
const ROW = "-mx-3.5 flex min-h-[54px] items-center gap-3.5 rounded-[14px] px-3.5 py-2.5";

/** Карточка преподавателя: кто он, как связаться, что ведёт, расписание недели, публикации и профили. */
export function TeacherPage({ t }: { t: TeacherPageData }) {
  const { toast, node } = useToast();
  const copy = () => navigator.clipboard?.writeText(t.email).then(() => toast("Почта скопирована"), () => toast("Почта скопирована"));

  return (
    <>
      <div className="flex items-center gap-6 max-sm:flex-col max-sm:items-start max-sm:gap-4">
        <span
          aria-hidden="true"
          style={{ background: t.gradient }}
          className="mono grid size-28 shrink-0 place-items-center rounded-[34px] text-4xl font-semibold tracking-[-.02em] max-sm:size-[88px] max-sm:rounded-[28px] max-sm:text-[28px]"
        >
          {t.initials}
        </span>
        <div className="min-w-0">
          <h1 className="text-[34px] leading-[1.15] font-medium tracking-[-.03em] [text-wrap:balance] max-sm:text-[28px]">{t.name}</h1>
          <div className="mt-1 text-[15px] text-text-2">
            {t.position}, {t.department.charAt(0).toLowerCase() + t.department.slice(1)}
          </div>
          {t.degree && <div className="text-[15px] text-text-3">{t.degree}</div>}
        </div>
      </div>

      <div className="mt-[52px] grid grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-14 max-[900px]:grid-cols-1 max-[900px]:gap-11">
        <div className="flex flex-col gap-12">
          {t.bio && (
            <section aria-labelledby="bio">
              <h2 id="bio" className={H2}>
                О преподавателе
              </h2>
              <p className="text-[15px] leading-relaxed text-text-2">{t.bio}</p>
              {t.interests.length > 0 && (
                <p className="mt-3 text-[15px] text-text-2">
                  <span className="text-text-3">Научные интересы:</span> {t.interests.join(", ").toLowerCase()}
                </p>
              )}
            </section>
          )}

          <section aria-labelledby="week">
            <h2 id="week" className={H2}>
              Расписание на неделе
            </h2>
            {t.week.length ? (
              t.week.map((d) => (
                <div key={d.date} className="mt-3 first:mt-0">
                  <div className="mb-0.5 text-[13px] text-text-3">{d.label}</div>
                  <div className="rows [--row-inset:14px]">
                    {d.items.map((e) => (
                      <div key={e.id} data-week-item className={cn("-mx-3.5 grid grid-cols-[100px_minmax(0,1fr)_auto] items-center gap-x-3 rounded-2xl px-3.5 py-2.5 max-sm:grid-cols-[88px_minmax(0,1fr)]", !e.mine && "text-text-2")}>
                        <span className="text-sm tabular-nums">
                          {e.start}–{e.end}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{e.title}</span>
                          <span className="flex items-center gap-2 text-[13px] text-text-3">
                            <i className="size-1.5 shrink-0 rounded-full" style={{ background: `var(--c-${e.color})` }} />
                            <span className="truncate">{e.course}</span>
                          </span>
                        </span>
                        <span className="text-[13px] whitespace-nowrap text-text-3 max-sm:hidden">ауд. {e.room}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-[15px] text-text-3">На этой неделе занятий нет</p>
            )}
          </section>

          {t.publications.length > 0 && (
            <section aria-labelledby="pubs">
              <h2 id="pubs" className={H2}>
                Публикации
              </h2>
              <div className="rows [--row-inset:0px]">
                {t.publications.map((p) => (
                  <div key={p.title} className="grid grid-cols-[44px_minmax(0,1fr)] gap-x-3 py-3">
                    <span className="text-sm text-text-3 tabular-nums">{p.year}</span>
                    <span>
                      <b className="block font-medium">{p.title}</b>
                      <small className="text-[13px] text-text-3">{p.venue}</small>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="flex flex-col gap-12 max-[900px]:order-first">
          <section aria-labelledby="contacts">
            <h2 id="contacts" className={H2}>
              Контакты
            </h2>
            <div className="rows [--row-inset:14px]">
              <div className={cn(ROW, "group hover:bg-hover")}>
                <span className="min-w-0 flex-1">
                  <small className="block text-[13px] text-text-3">Почта</small>
                  <a href={`mailto:${t.email}`} className="block truncate font-medium hover:underline">
                    {t.email}
                  </a>
                </span>
                <button type="button" aria-label="Скопировать почту" onClick={copy} className="grid size-8 place-items-center rounded-[10px] text-text-3 hover:bg-s2 hover:text-text">
                  <Copy size={16} strokeWidth={1.6} />
                </button>
              </div>
              {t.office && (
                <div className={ROW}>
                  <span>
                    <small className="block text-[13px] text-text-3">Кабинет</small>
                    <b className="font-medium">{t.office}</b>
                  </span>
                </div>
              )}
              {t.consultation && (
                <Link href={`/time?tab=cons&open=${t.consultation.id}`} className={cn(ROW, "hover:bg-hover")}>
                  <span className="min-w-0 flex-1">
                    <small className="block text-[13px] text-text-3">Ближайшая консультация</small>
                    <b className="block truncate font-medium">
                      {t.consultation.when}, {t.consultation.place.charAt(0).toLowerCase() + t.consultation.place.slice(1)}
                    </b>
                  </span>
                  <ChevronRight size={16} strokeWidth={1.6} className="text-text-3" />
                </Link>
              )}
            </div>
          </section>

          {t.mine.length > 0 && (
            <section aria-labelledby="mine">
              <h2 id="mine" className={H2}>
                Ведёт у тебя
              </h2>
              <div className="rows [--row-inset:14px]">
                {t.mine.map((c) => (
                  <Link key={c.slug} href={`/study/${c.slug}`} className={cn(ROW, "hover:bg-hover")}>
                    <i className="size-2 shrink-0 rounded-full" style={{ background: `var(--c-${c.color})` }} />
                    <span className="min-w-0 flex-1">
                      <b className="block truncate font-medium">{c.title}</b>
                      <small className="text-[13px] text-text-3">{c.role}</small>
                    </span>
                    <ChevronRight size={16} strokeWidth={1.6} className="text-text-3" />
                  </Link>
                ))}
              </div>
            </section>
          )}

          {t.links.length > 0 && (
            <section aria-labelledby="links">
              <h2 id="links" className={H2}>
                Профили
              </h2>
              <div className="rows [--row-inset:14px]">
                {t.links.map((l) =>
                  l.href ? (
                    <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className={cn(ROW, "hover:bg-hover")}>
                      <span className="min-w-0 flex-1">
                        <small className="block text-[13px] text-text-3">{l.label}</small>
                        <b className="block truncate font-medium tabular-nums">{l.value}</b>
                      </span>
                      <ArrowUpRight size={16} strokeWidth={1.6} className="text-text-3" />
                    </a>
                  ) : (
                    <div key={l.label} className={ROW}>
                      <span>
                        <small className="block text-[13px] text-text-3">{l.label}</small>
                        <b className="font-medium tabular-nums">{l.value}</b>
                      </span>
                    </div>
                  ),
                )}
              </div>
            </section>
          )}
        </div>
      </div>
      {node}
    </>
  );
}
