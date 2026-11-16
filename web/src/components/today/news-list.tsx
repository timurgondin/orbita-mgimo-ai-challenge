"use client";

import { ChevronRight } from "lucide-react";
import { ActionCard, useNotifications } from "@/components/notifications/center";
import { NoteRow } from "@/components/notifications/note-row";
import type { NewsItem } from "@/server/data/types";

/** «Новое» — окно в центр уведомлений: самые важные, «Все» открывает шторку. */
export function NewsList({ news }: { news: NewsItem[] }) {
  const { open, data } = useNotifications();
  // свежая версия из центра (после «Продлить» или прочтения), порядок — серверный
  const live = news.map((n) => data.items.find((i) => i.id === n.id) ?? n);
  return (
    <section aria-label="Новое">
      <div className="mb-3.5 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold tracking-[-.02em]">Новое</h2>
        <button
          type="button"
          onClick={open}
          data-open-center
          className="-mr-2 inline-flex items-center gap-0.5 rounded-lg px-2 py-1 text-sm text-text-3 transition-[color,background] duration-150 hover:bg-hover hover:text-text"
        >
          Все
          <ChevronRight size={15} strokeWidth={1.6} />
        </button>
      </div>
      <div className="flex flex-col">
        {live.map((n) => (n.pending ? <ActionCard key={n.id} n={n} compact className="-mx-3 rounded-[14px] bg-transparent px-3 py-[11px]" /> : <NoteRow key={n.id} n={n} />))}
        {!live.length && <p className="text-[15px] text-text-3">Пока ничего нового</p>}
      </div>
    </section>
  );
}
