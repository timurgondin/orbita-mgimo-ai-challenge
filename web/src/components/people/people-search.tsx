"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";
import type { PeopleCircle, PersonHit } from "@/server/data/types";
import { findPeople } from "@/server/people/actions";

export type PeopleTab = "all" | "students" | "teachers";
const TABS: { id: PeopleTab; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "students", label: "Студенты" },
  { id: "teachers", label: "Преподаватели" },
];
const H2 = "mb-1.5 text-lg font-semibold tracking-[-.02em]";

/** Аватар человека: фото, если есть, иначе монограмма. */
export function PersonAvatar({ p, size = 40 }: { p: Pick<PersonHit, "photo" | "initials" | "gradient">; size?: number }) {
  const box = { width: size, height: size, fontSize: Math.round(size * 0.36) };
  if (p.photo)
    // eslint-disable-next-line @next/next/no-img-element -- фото из БД через свой маршрут, оптимизатор не нужен
    return <img src={p.photo} alt="" width={size} height={size} loading="lazy" className="shrink-0 rounded-full object-cover" style={box} />;
  return (
    <span aria-hidden="true" className="mono grid shrink-0 place-items-center rounded-full font-semibold" style={{ ...box, background: p.gradient }}>
      {p.initials}
    </span>
  );
}

function PersonRow({ p }: { p: PersonHit }) {
  return (
    <Link
      href={p.href}
      data-person={p.kind}
      className="-mx-3.5 flex min-h-[64px] items-center gap-3.5 rounded-[14px] px-3.5 py-2.5 transition-colors duration-150 hover:bg-hover"
    >
      <PersonAvatar p={p} />
      <span className="min-w-0 flex-1">
        <b className="block truncate font-medium">{p.name}</b>
        <small className="block truncate text-[13.5px] text-text-3">{p.sub}</small>
      </span>
      {p.tag && <span className="shrink-0 text-sm text-text-2 tabular-nums">{p.tag}</span>}
      <ChevronRight aria-hidden="true" size={16} strokeWidth={1.6} className="shrink-0 text-text-3" />
    </Link>
  );
}

function List({ people, tags = true }: { people: PersonHit[]; tags?: boolean }) {
  return (
    <div className="rows [--row-inset:68px]">
      {people.map((p) => (
        <PersonRow key={p.href} p={tags ? p : { ...p, tag: null }} />
      ))}
    </div>
  );
}

/** Поиск людей: строка, вкладки «Все / Студенты / Преподаватели»; пока запрос пуст — своя группа и свои преподаватели. */
export function PeopleSearch({ circle, initialQuery, initialTab, initialHits }: { circle: PeopleCircle; initialQuery: string; initialTab: PeopleTab; initialHits: PersonHit[] }) {
  const [q, setQ] = useState(initialQuery);
  const [tab, setTab] = useState<PeopleTab>(initialTab);
  const [hits, setHits] = useState(initialHits);
  const [pending, start] = useTransition();
  const req = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const query = q.trim();

  useEffect(() => {
    // запрос и вкладка — в адресе: «Назад» из карточки возвращает к тем же результатам
    const url = new URL(location.href);
    url.searchParams.delete("q");
    url.searchParams.delete("tab");
    if (query) url.searchParams.set("q", query);
    if (tab !== "all") url.searchParams.set("tab", tab);
    history.replaceState(null, "", url); // null — так Next.js синхронизирует адрес со своим роутером
  }, [query, tab]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const search = (nextQ: string, nextTab: PeopleTab) => {
    clearTimeout(timer.current);
    const id = ++req.current;
    const trimmed = nextQ.trim();
    if (!trimmed) return setHits([]);
    timer.current = setTimeout(() => {
      start(async () => {
        const r = await findPeople(trimmed, nextTab);
        if (id === req.current) setHits(r);
      });
    }, 140);
  };

  const classmates = tab === "teachers" ? [] : circle.classmates;
  const teachers = tab === "students" ? [] : circle.teachers;

  return (
    <>
      <div className="flex items-end justify-between gap-6 max-sm:flex-col max-sm:items-stretch max-sm:gap-5">
        <h1 className="text-[34px] leading-[1.15] font-medium tracking-[-.03em] max-sm:text-[28px]">Люди</h1>
        <Segmented variant="tabs" label="Кого искать" value={tab} onChange={(t) => (setTab(t), search(q, t))} items={TABS} />
      </div>

      <search className="mt-8 block">
        <label className="relative block">
          <span className="sr-only">Найти человека</span>
          <Search size={18} strokeWidth={1.8} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-text-3" />
          <input
            type="search"
            value={q}
            onChange={(e) => (setQ(e.target.value), search(e.target.value, tab))}
            placeholder="Фамилия, имя или группа"
            maxLength={60}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="search"
            data-people-search
            className="h-12 w-full rounded-2xl bg-s1 pr-4 pl-11 text-base placeholder:text-text-3 focus:bg-s2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </label>
      </search>

      {query ? (
        <section aria-label="Результаты" className={cn("mt-8 transition-opacity duration-150", pending && "opacity-60")} data-people-results>
          <p role="status" className="sr-only">
            {hits.length ? `Найдено: ${hits.length}` : "Никого не нашли"}
          </p>
          {hits.length ? <List people={hits} /> : !pending && <p className="py-6 text-[15px] text-text-3">Никого не нашли</p>}
        </section>
      ) : (
        <div className="mt-11 grid grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-14 max-[900px]:grid-cols-1 max-[900px]:gap-11">
          {classmates.length > 0 && (
            <section aria-labelledby="pp-group" data-people-group>
              <h2 id="pp-group" className={H2}>
                Группа {circle.group}
              </h2>
              <List people={classmates} tags={false} />
            </section>
          )}
          {teachers.length > 0 && (
            <section aria-labelledby="pp-teachers" data-people-teachers className={cn(!classmates.length && "col-span-full max-w-[720px]")}>
              <h2 id="pp-teachers" className={H2}>
                Мои преподаватели
              </h2>
              <List people={teachers} />
            </section>
          )}
        </div>
      )}
    </>
  );
}
