"use client";

import Link from "next/link";
import { ArrowUpRight, ChevronRight, Copy, Mail, MapPin, MessagesSquare } from "lucide-react";
import { Week } from "@/components/people/week";
import { DotField } from "@/components/today/dot-field";
import { useToast } from "@/components/ui/toast";
import { plural } from "@/lib/phrases";
import { cn } from "@/lib/utils";
import type { TeacherPageData } from "@/server/data/types";

const H2 = "mb-3 text-lg font-semibold tracking-[-.02em]";
const ROW = "-mx-3.5 flex min-h-[54px] items-center gap-3.5 rounded-[14px] px-3.5 py-2.5";
const MASK = "radial-gradient(80% 140% at 100% 0%, #000 10%, transparent 75%)";

/** Карточка преподавателя: шапка с интересами, неделя, контакты и профили, о себе и публикации. */
export function TeacherPage({ t }: { t: TeacherPageData }) {
  const { toast, node } = useToast();
  const copy = () => navigator.clipboard?.writeText(t.email).then(() => toast("Почта скопирована"), () => toast("Почта скопирована"));
  const stats = [
    { value: String(t.load.pairs), label: `${plural(t.load.pairs, "пара", "пары", "пар")} ${t.nav.label === "Эта неделя" ? "на этой неделе" : "за неделю"}` },
    { value: String(t.load.groups), label: plural(t.load.groups, "группа", "группы", "групп") },
    { value: String(t.publications.length), label: plural(t.publications.length, "публикация", "публикации", "публикаций") },
  ];

  return (
    <>
      <header className="relative overflow-hidden rounded-[28px] bg-s1 px-8 pt-8 pb-7 max-sm:rounded-[24px] max-sm:px-5 max-sm:pt-6">
        <DotField rgb="139,142,255" peak={0.55} mask={MASK} />
        <div className="relative flex items-start gap-6 max-sm:flex-col max-sm:gap-4">
          <span
            aria-hidden="true"
            style={{ background: t.gradient }}
            className="mono grid size-[104px] shrink-0 place-items-center rounded-[32px] text-[34px] font-semibold tracking-[-.02em] max-sm:size-[80px] max-sm:rounded-[26px] max-sm:text-[26px]"
          >
            {t.initials}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-[34px] leading-[1.15] font-medium tracking-[-.03em] [text-wrap:balance] max-sm:text-[28px]">{t.name}</h1>
            <div className="mt-1 text-[15px] text-text-2">
              {t.position}, {t.department.charAt(0).toLowerCase() + t.department.slice(1)}
              {t.degree && <span className="block text-text-3">{t.degree}</span>}
            </div>
            {t.interests.length > 0 && (
              <ul aria-label="Научные интересы" className="mt-4 flex flex-wrap gap-1.5">
                {t.interests.map((i) => (
                  <li key={i} data-interest className="inline-flex h-7 items-center rounded-full border border-line bg-bg/40 px-3 text-[13px] text-text-2">
                    {i}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <a
            href={`mailto:${t.email}`}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-text px-4 text-sm font-semibold text-bg transition-[opacity,transform] duration-150 hover:opacity-90 active:scale-[.97]"
          >
            <Mail size={16} strokeWidth={1.9} />
            Написать
          </a>
        </div>
        <div className="relative mt-7 flex flex-wrap gap-x-12 gap-y-4 border-t-[.5px] border-line pt-5 max-sm:gap-x-8">
          {stats.map((s) => (
            <div key={s.label}>
              <b className="block text-[28px] leading-none font-medium tracking-[-.03em] tabular-nums">{s.value}</b>
              <span className="text-[13px] text-text-3">{s.label}</span>
            </div>
          ))}
        </div>
      </header>

      <div className="mt-12">
        <Week key={t.nav.monday} week={t.week} nav={t.nav} />
      </div>

      <div className="mt-14 grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-12 max-[1000px]:grid-cols-1">
        <div className="flex min-w-0 flex-col gap-12">
          {t.bio && (
            <section aria-labelledby="bio">
              <h2 id="bio" className={H2}>
                О преподавателе
              </h2>
              <p className="max-w-[640px] text-[15px] leading-relaxed text-text-2">{t.bio}</p>
            </section>
          )}

          {t.publications.length > 0 && (
            <section aria-labelledby="pubs">
              <h2 id="pubs" className={H2}>
                Публикации
              </h2>
              <div className="rows [--row-inset:0px]">
                {t.publications.map((p) => (
                  <div key={p.title} className="grid grid-cols-[52px_minmax(0,1fr)] gap-x-3 py-3">
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

        <aside className="flex min-w-0 flex-col gap-10">
          {t.mine.length > 0 && (
            <section aria-labelledby="mine">
              <h2 id="mine" className={H2}>
                Ведёт у тебя
              </h2>
              <div className="flex flex-col gap-2">
                {t.mine.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/study/${c.slug}`}
                    style={{ "--cc": `var(--c-${c.color})` } as React.CSSProperties}
                    className="flex items-center gap-3 rounded-2xl bg-[color-mix(in_srgb,var(--cc)_14%,var(--s1))] px-4 py-3 transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--cc)_20%,var(--s1))]"
                  >
                    <span className="min-w-0 flex-1">
                      <b className="block truncate font-medium">{c.title}</b>
                      <small className="text-[13px] text-text-2">{c.role}</small>
                    </span>
                    <ChevronRight size={16} strokeWidth={1.6} className="text-text-3" />
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section aria-labelledby="contacts">
            <h2 id="contacts" className={H2}>
              Контакты
            </h2>
            <div className="rows [--row-inset:14px]">
              <div className={cn(ROW, "hover:bg-hover")}>
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
                  <MapPin size={16} strokeWidth={1.6} className="shrink-0 text-text-3" />
                  <span>
                    <small className="block text-[13px] text-text-3">Кабинет</small>
                    <b className="font-medium">{t.office.replace(/^Каб\.\s*/, "")}</b>
                  </span>
                </div>
              )}
              {t.consultation && (
                <Link href={`/time?tab=cons&open=${t.consultation.id}`} className={cn(ROW, "hover:bg-hover")}>
                  <MessagesSquare size={16} strokeWidth={1.6} className="shrink-0 text-text-3" />
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

          {t.links.length > 0 && (
            <section aria-labelledby="links">
              <h2 id="links" className={H2}>
                Профили
              </h2>
              <div className="rows [--row-inset:14px]">
                {t.links.map((l) => (
                  <a key={l.kind} data-profile={l.kind} href={l.href} target="_blank" rel="noopener noreferrer" className={cn(ROW, "hover:bg-hover")}>
                    <span className="min-w-0 flex-1">
                      <small className="block text-[13px] text-text-3">{l.label}</small>
                      <b className="block truncate font-medium tabular-nums">{l.value}</b>
                      {l.metric && <small className="block text-[13px] text-text-2">{l.metric}</small>}
                    </span>
                    <ArrowUpRight size={16} strokeWidth={1.6} className="text-text-3" />
                  </a>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
      {node}
    </>
  );
}
