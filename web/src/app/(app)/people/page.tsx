import type { Metadata } from "next";
import { PeopleSearch, type PeopleTab } from "@/components/people/people-search";
import { getPeopleCircle, isPeopleKind, searchPeople } from "@/server/data/directory";

export const metadata: Metadata = { title: "Люди — Орбита" };

/** Поиск людей: студенты и преподаватели. Запрос и вкладка — в адресе (?q=, ?tab=). */
export default async function PeoplePage({ searchParams }: { searchParams: Promise<{ q?: string; tab?: string }> }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 60) : "";
  const tab: PeopleTab = isPeopleKind(sp.tab) ? sp.tab : "all";
  const [circle, hits] = await Promise.all([getPeopleCircle(), q.trim() ? searchPeople(q, tab) : []]);
  return <PeopleSearch circle={circle} initialQuery={q} initialTab={tab} initialHits={hits} />;
}
