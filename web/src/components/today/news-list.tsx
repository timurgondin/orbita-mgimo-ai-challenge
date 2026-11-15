import Link from "next/link";
import { SectionHeader } from "./section-header";
import { FileCheck2, MapPin, Megaphone } from "lucide-react";
import type { NewsItem } from "@/server/data/types";
import { cn } from "@/lib/utils";

function Avatar({ avatar }: { avatar: NewsItem["avatar"] }) {
  const base = "grid size-10 shrink-0 place-items-center rounded-full text-[13px] font-semibold";
  if (avatar.kind === "initials") {
    return (
      <span className={cn(base, "text-[#1d1d20]")} style={{ background: avatar.gradient }}>
        {avatar.text}
      </span>
    );
  }
  const Icon = { megaphone: Megaphone, "map-pin": MapPin, "file-check-2": FileCheck2 }[avatar.icon];
  return (
    <span className={cn(base, "bg-s2 text-text-2")}>
      <Icon size={17} strokeWidth={1.6} />
    </span>
  );
}

function Item({ n }: { n: NewsItem }) {
  const { before, emphasis, after } = n.subtitle;
  return (
    <Link
      href="#"
      className="-mx-3 flex items-center gap-3.5 rounded-[14px] px-3 py-[11px] transition-colors duration-150 hover:bg-hover"
    >
      <Avatar avatar={n.avatar} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{n.title}</div>
        <div className="mt-px truncate text-sm text-text-3">
          {before}
          {emphasis && <b className="font-medium text-text">{emphasis}</b>}
          {after}
        </div>
      </div>
      <time
        className={cn(
          "flex items-center gap-2 text-[13px] whitespace-nowrap text-text-3",
          n.unread && "after:size-[7px] after:rounded-full after:bg-accent after:content-['']",
        )}
      >
        {n.time}
      </time>
    </Link>
  );
}

export function NewsList({ news }: { news: NewsItem[] }) {
  return (
    <section aria-label="Новое">
      <SectionHeader title="Новое" linkLabel="Все" />
      {news.map((n) => (
        <Item key={n.id} n={n} />
      ))}
    </section>
  );
}
