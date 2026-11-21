"use client";

import { ArrowUpRight, Copy, Eye, Mail, Phone, Send } from "lucide-react";
import { PrivacyButton } from "@/components/profile/privacy";
import { Week } from "@/components/people/week";
import { DotField } from "@/components/today/dot-field";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { StudentPageData } from "@/server/data/types";

const H2 = "mb-3 text-lg font-semibold tracking-[-.02em]";
const ROW = "-mx-3.5 flex min-h-[54px] items-center gap-3.5 rounded-[14px] px-3.5 py-2.5";
const KV = "-mx-3.5 grid min-h-[54px] grid-cols-[140px_minmax(0,1fr)] items-center gap-4 rounded-[14px] px-3.5 py-2.5 max-sm:grid-cols-1 max-sm:gap-0.5";
const MASK = "radial-gradient(80% 140% at 100% 0%, #000 10%, transparent 75%)";
const BTN = "inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-[opacity,transform,background] duration-150 active:scale-[.97]";

/** Карточка студента для других: справочные данные, расписание группы, почта и открытые студентом контакты. */
export function StudentPage({ s }: { s: StudentPageData }) {
  const { toast, node } = useToast();
  const copy = () => navigator.clipboard?.writeText(s.email).then(() => toast("Почта скопирована"), () => toast("Почта скопирована"));
  const hasWeek = !!s.group || s.week.some((d) => d.items.length);
  const study: [string, string | null][] = [
    ["Факультет", s.faculty],
    ["Программа", s.program],
    ["Курс", s.level],
    ["Группа", s.group],
  ];

  return (
    <>
      <header className="relative overflow-hidden rounded-[28px] bg-s1 px-8 pt-8 pb-8 max-sm:rounded-[24px] max-sm:px-5 max-sm:pt-6 max-sm:pb-6">
        <DotField rgb="139,142,255" peak={0.55} mask={MASK} />
        <div className="relative flex items-center gap-6 max-sm:flex-col max-sm:items-start max-sm:gap-4">
          {s.photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- фото из БД через свой маршрут
            <img src={s.photo} alt="" width={104} height={104} className="size-[104px] shrink-0 rounded-[32px] object-cover max-sm:size-[80px] max-sm:rounded-[26px]" />
          ) : (
            <span
              aria-hidden="true"
              style={{ background: s.gradient }}
              className="mono grid size-[104px] shrink-0 place-items-center rounded-[32px] text-[34px] font-semibold tracking-[-.02em] max-sm:size-[80px] max-sm:rounded-[26px] max-sm:text-[26px]"
            >
              {s.initials}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-[34px] leading-[1.15] font-medium tracking-[-.03em] [text-wrap:balance] max-sm:text-[28px]">{s.name}</h1>
            <div className="mt-1 text-[15px] text-text-2">
              {[s.program, s.level?.match(/\d курс/)?.[0]].filter(Boolean).join(", ")}
              {s.group && <span className="block text-text-3">Группа {s.group}</span>}
            </div>
          </div>
          {s.me ? (
            <PrivacyButton
              p={{ login: s.login, email: s.email, ...s.own! }}
              className={cn(BTN, "bg-s2 text-text hover:bg-s3")}
            >
              <Eye size={16} strokeWidth={1.9} />
              Приватность
            </PrivacyButton>
          ) : (
            <a href={`mailto:${s.email}`} className={cn(BTN, "bg-text text-bg hover:opacity-90")}>
              <Mail size={16} strokeWidth={1.9} />
              Написать
            </a>
          )}
        </div>
      </header>

      <div className="mt-12 grid grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] items-start gap-x-14 gap-y-11 [grid-template-areas:'week_contacts'_'week_study'] [grid-template-rows:auto_1fr] max-[1000px]:grid-cols-1 max-[1000px]:gap-y-11 max-[1000px]:[grid-template-areas:'contacts'_'week'_'study']">
        {hasWeek && (
          <div className="min-w-0 [grid-area:week]" data-student-week>
            <Week key={s.nav.monday} week={s.week} nav={s.nav} title="Расписание" />
          </div>
        )}
        <section aria-labelledby="st-study" className="min-w-0 [grid-area:study]">
          <h2 id="st-study" className={H2}>
            Учёба
          </h2>
          <dl className="rows [--row-inset:14px]">
            {study
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className={KV}>
                  <dt className="text-sm text-text-3 max-sm:text-[13px]">{k}</dt>
                  <dd className="min-w-0 font-medium">{v}</dd>
                </div>
              ))}
          </dl>
        </section>

        <section aria-labelledby="st-contacts" data-student-contacts className="min-w-0 [grid-area:contacts]">
          <h2 id="st-contacts" className={H2}>
            Контакты
          </h2>
          <div className="rows [--row-inset:14px]">
            <div className={cn(ROW, "hover:bg-hover")}>
              <Mail size={16} strokeWidth={1.6} className="shrink-0 text-text-3" />
              <span className="min-w-0 flex-1">
                <small className="block text-[13px] text-text-3">Почта</small>
                <a href={`mailto:${s.email}`} data-contact="email" className="block truncate font-medium hover:underline">
                  {s.email}
                </a>
              </span>
              <button type="button" aria-label="Скопировать почту" onClick={copy} className="grid size-8 place-items-center rounded-[10px] text-text-3 hover:bg-s2 hover:text-text">
                <Copy size={16} strokeWidth={1.6} />
              </button>
            </div>
            {s.telegram && (
              <a href={`https://t.me/${s.telegram.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer" data-contact="telegram" className={cn(ROW, "hover:bg-hover")}>
                <Send size={16} strokeWidth={1.6} className="shrink-0 text-text-3" />
                <span className="min-w-0 flex-1">
                  <small className="block text-[13px] text-text-3">Telegram</small>
                  <b className="block truncate font-medium">{s.telegram}</b>
                </span>
                <ArrowUpRight size={16} strokeWidth={1.6} className="text-text-3" />
              </a>
            )}
            {s.phone && (
              <a href={`tel:${s.phone.replace(/[^\d+]/g, "")}`} data-contact="phone" className={cn(ROW, "hover:bg-hover")}>
                <Phone size={16} strokeWidth={1.6} className="shrink-0 text-text-3" />
                <span className="min-w-0 flex-1">
                  <small className="block text-[13px] text-text-3">Телефон</small>
                  <b className="block truncate font-medium tabular-nums">{s.phone}</b>
                </span>
              </a>
            )}
          </div>
        </section>
      </div>
      {node}
    </>
  );
}
