import Link from "next/link";
import { MapPin, Users } from "lucide-react";
import { DEMO_MINUTES, formatDuration, formatLongDate, toMinutes } from "@/lib/demo-clock";
import { plural } from "@/lib/phrases";
import { DotField } from "@/components/today/dot-field";
import { SectionHeader } from "@/components/today/section-header";
import { TileIcon, type TileIconName } from "@/components/today/tile-icons";
import { ProgressBar } from "@/components/ui/progress";
import type { ReviewItem, TeachConsultation, TeachCourseCard, TeachLesson } from "@/server/data/teach-types";
import { ReviewRow } from "./review-row";

const lower = (s: string) => (/^[А-ЯЁ][а-яё]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
/** «Семинар у ЦЭ-26-М», «Лекция потоку МБ-24» */
export const forGroup = (kind: string, group: string) => (group ? `${kind}, ${lower(group)}` : kind);

/** «Сейчас» / «Дальше»: пара преподавателя — группа, аудитория, сколько студентов. */
function NowCard({ l }: { l: TeachLesson }) {
  const start = toMinutes(l.start);
  const end = toMinutes(l.end);
  const ongoing = DEMO_MINUTES >= start && DEMO_MINUTES < end;
  const progress = ongoing ? Math.round(((DEMO_MINUTES - start) / (end - start)) * 100) : 0;
  return (
    <Link
      href={`/time?open=${l.id}`}
      data-teach-now
      className="relative flex min-h-[244px] flex-col overflow-hidden rounded-[26px] bg-s1 px-7 pt-[26px] pb-6 transition-colors duration-200 hover:bg-s2"
    >
      <DotField />
      <div className="relative flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-text-2">
          <span className="live-dot size-[7px] rounded-full bg-text [animation:blink_2.4s_ease-in-out_infinite]" />
          {ongoing ? "Сейчас" : "Дальше"}
        </span>
        <span className="text-text-3 tabular-nums">{ongoing ? `ещё ${formatDuration(end - DEMO_MINUTES)}` : `через ${formatDuration(start - DEMO_MINUTES)}`}</span>
      </div>
      <div className="relative mt-auto text-[30px] leading-[1.1] font-semibold tracking-[-.03em]">{l.title}</div>
      <div className="relative mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[15px] text-text-2">
        <span>{forGroup(l.kindLabel, l.group)}</span>
        <span className="flex items-center gap-1.5">
          <MapPin size={15} strokeWidth={1.6} className="text-text-3" />
          ауд. {l.room}
        </span>
        {l.students != null && (
          <span className="flex items-center gap-1.5">
            <Users size={15} strokeWidth={1.6} className="text-text-3" />
            {l.students}
          </span>
        )}
      </div>
      <div className="relative mt-[22px]">
        <ProgressBar value={progress} label="Прошло от пары" />
        <div className="mt-2 flex justify-between text-[13px] text-text-3">
          <span>{l.start}</span>
          <span>{l.end}</span>
        </div>
      </div>
    </Link>
  );
}

type Row = { id: string; start: string; title: string; line: string; href: string };

function DayRow({ r, muted }: { r: Row; muted?: boolean }) {
  return (
    <Link
      href={r.href}
      className="-mx-3 grid grid-cols-[54px_1fr] items-baseline gap-3.5 rounded-[14px] px-3 py-3 transition-colors duration-150 hover:bg-hover max-sm:grid-cols-[48px_1fr]"
    >
      <span className={muted ? "text-[15px] text-text-3" : "text-[15px] text-text-2"}>{r.start}</span>
      <div>
        <div className={muted ? "font-medium text-text-2" : "font-medium"}>{r.title}</div>
        <div className="mt-px text-sm text-text-3">{r.line}</div>
      </div>
    </Link>
  );
}

const TILES: { label: string; icon: TileIconName; color: string; href: string }[] = [
  { label: "Проверка", icon: "documents", color: "var(--st-violet)", href: "/study?tab=review" },
  { label: "Журнал", icon: "grades", color: "var(--st-green)", href: "/study?tab=journal" },
  { label: "Консультации", icon: "teachers", color: "var(--accent)", href: "/time?tab=cons" },
  { label: "Люди", icon: "people", color: "var(--c-py)", href: "/people" },
  { label: "Аудитории", icon: "rooms", color: "var(--c-world)", href: "/rooms" },
  { label: "Печать", icon: "print", color: "var(--c-law)", href: "/print" },
];

export function TeachToday({
  firstName,
  greeting,
  date,
  data,
  courses,
}: {
  firstName: string;
  greeting: string;
  date: string;
  data: { today: TeachLesson[]; cons: TeachConsultation[]; next: TeachLesson | null; nextDate: string | null; review: ReviewItem[]; total: number };
  courses: TeachCourseCard[];
}) {
  const current =
    data.today.find((l) => toMinutes(l.start) <= DEMO_MINUTES && DEMO_MINUTES < toMinutes(l.end)) ??
    data.today.find((l) => toMinutes(l.start) > DEMO_MINUTES);
  const rows: (Row & { m: number })[] = [
    ...data.today
      .filter((l) => l !== current && toMinutes(l.start) > DEMO_MINUTES)
      .map((l) => ({ id: l.id, start: l.start, m: toMinutes(l.start), title: l.title, line: `${forGroup(l.kindLabel, l.group)}, ауд. ${l.room}`, href: `/time?open=${l.id}` })),
    ...data.cons
      .filter((c) => toMinutes(c.start) > DEMO_MINUTES)
      .map((c) => ({ id: c.id, start: c.start, m: toMinutes(c.start), title: "Консультация", line: `Записались ${c.count} из ${c.capacity}`, href: `/time?tab=cons&open=${c.id}` })),
  ].sort((a, b) => a.m - b.m);

  return (
    <>
      <div>
        <div className="text-[15px] text-text-2">{date}</div>
        <h1 className="mt-1 text-[34px] leading-[1.15] font-medium tracking-[-.03em] max-sm:text-[28px]">
          {greeting}, {firstName}
        </h1>
      </div>

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] items-stretch gap-12 min-[900px]:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        {current ? (
          <NowCard l={current} />
        ) : (
          <div className="relative flex min-h-[244px] flex-col overflow-hidden rounded-[26px] bg-s1 px-7 pt-[26px] pb-6">
            <DotField />
            <div className="relative mt-auto text-[30px] leading-[1.1] font-semibold tracking-[-.03em]">Пар сегодня больше нет</div>
          </div>
        )}
        <section aria-label="Дальше сегодня" className="flex flex-col">
          <SectionHeader title="Дальше сегодня" linkLabel="Неделя" href="/time?view=week" />
          {rows.map((r) => (
            <DayRow key={r.id} r={r} />
          ))}
          {!rows.length && <p className="py-3 text-[15px] text-text-3">Больше ничего</p>}
          {data.next && data.nextDate && (
            <div className="mt-2 border-t-[.5px] border-line pt-3">
              <div className="text-[13px] text-text-3">{formatLongDate(data.nextDate).split(",")[0]}</div>
              <DayRow
                muted
                r={{ id: data.next.id, start: data.next.start, title: data.next.title, line: `${forGroup(data.next.kindLabel, data.next.group)}, ауд. ${data.next.room}`, href: `/time?open=${data.next.id}` }}
              />
            </div>
          )}
        </section>
      </div>

      <nav aria-label="Быстрый доступ" className="mt-14 grid grid-cols-6 gap-4 max-[900px]:grid-cols-3">
        {TILES.map((t) => (
          <Link key={t.label} href={t.href} className="group flex min-w-0 flex-col items-center gap-3 text-center text-[15px] font-medium tracking-[-.01em]">
            <span className="relative grid aspect-square w-full place-items-center rounded-3xl bg-s1 transition-colors duration-200 group-hover:bg-s2" style={{ color: t.color }}>
              <TileIcon
                name={t.icon}
                className="h-auto w-[46%] transition-transform duration-[450ms] ease-spring group-hover:-translate-y-0.5 group-hover:scale-[1.07] group-active:scale-[.97]"
              />
              {t.label === "Проверка" && data.total > 0 && (
                <span className="absolute top-2.5 right-2.5 grid h-[22px] min-w-[22px] place-items-center rounded-full bg-accent px-1.5 text-[12px] font-semibold text-white tabular-nums">
                  {data.total}
                </span>
              )}
            </span>
            <span className="max-w-full truncate">{t.label}</span>
          </Link>
        ))}
      </nav>

      <div className="mt-14 grid grid-cols-[minmax(0,1fr)] gap-12 min-[900px]:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <section aria-label="На проверке">
          <SectionHeader title={data.total ? `На проверке ${data.total}` : "На проверке"} linkLabel="Все работы" href="/study?tab=review" />
          {data.review.length ? (
            <div className="rows">
              {data.review.map((w) => (
                <ReviewRow key={w.id} w={w} href={`/study?tab=review&work=${w.id}`} />
              ))}
            </div>
          ) : (
            <p className="py-3 text-[15px] text-text-3">Всё проверено</p>
          )}
        </section>
        <section aria-label="Мои курсы">
          <SectionHeader title="Мои курсы" linkLabel="Все" href="/study" />
          {courses.map((c) => (
            <Link key={c.slug} href={`/study/${c.slug}`} className="-mx-3 flex items-center gap-3.5 rounded-[14px] px-3 py-[11px] transition-colors duration-150 hover:bg-hover">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{c.title}</div>
                <div className="mt-px flex items-center gap-2 text-sm text-text-3">
                  <i className="size-1.5 shrink-0 rounded-full" style={{ background: `var(--c-${c.color})` }} />
                  <span className="truncate">
                    {c.students} {plural(c.students, "студент", "студента", "студентов")}
                  </span>
                </div>
              </div>
              <div className="text-right whitespace-nowrap">
                <div className="text-sm text-text-2 tabular-nums">{c.average ?? "—"}</div>
                <div className="mt-px text-[13px] text-text-3">средний балл</div>
              </div>
            </Link>
          ))}
        </section>
      </div>
    </>
  );
}
