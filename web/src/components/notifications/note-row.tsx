"use client";

import Link from "next/link";
import {
  BookOpen,
  CalendarClock,
  FileCheck2,
  FolderOpen,
  Megaphone,
  ShieldCheck,
  Stamp,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NewsItem, NotificationKind } from "@/server/data/types";

const ICONS: Record<NotificationKind, LucideIcon> = {
  grade: FileCheck2,
  document: FileCheck2,
  announcement: Megaphone,
  schedule: CalendarClock,
  library: BookOpen,
  material: FolderOpen,
  security: ShieldCheck,
  office: Stamp,
};

export function NoteAvatar({ avatar }: { avatar: NewsItem["avatar"] }) {
  const base = "grid size-10 shrink-0 place-items-center rounded-full text-[13px] font-semibold";
  if (avatar.kind === "initials") {
    return (
      <span className={cn(base, "text-[#1d1d20]")} style={{ background: avatar.gradient }}>
        {avatar.text}
      </span>
    );
  }
  const Icon = ICONS[avatar.icon] ?? Megaphone;
  return (
    <span className={cn(base, "bg-[color-mix(in_srgb,var(--text)_7%,transparent)] text-text-2")}>
      <Icon size={17} strokeWidth={1.6} />
    </span>
  );
}

export function NoteSubtitle({ n }: { n: NewsItem }) {
  const { before, emphasis, after } = n.subtitle;
  return (
    <>
      {before}
      {emphasis && <b className="font-medium text-text">{emphasis}</b>}
      {after}
    </>
  );
}

/** Строка уведомления: аватар или значок, заголовок, одна строка пояснения, время справа. Точка — непрочитанное. */
export function NoteRow({ n, fresh, onNavigate }: { n: NewsItem; fresh?: boolean; onNavigate?: () => void }) {
  const unread = fresh ?? n.unread;
  return (
    <Link
      href={n.href ?? "#"}
      onClick={onNavigate}
      data-note={n.id}
      className="-mx-3 flex items-center gap-3.5 rounded-[14px] px-3 py-[11px] transition-colors duration-150 hover:bg-hover"
    >
      <NoteAvatar avatar={n.avatar} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{n.title}</div>
        <div className="mt-px truncate text-sm text-text-3">
          <NoteSubtitle n={n} />
        </div>
      </div>
      <time
        className={cn(
          "flex items-center gap-2 text-[13px] whitespace-nowrap text-text-3",
          unread && "after:size-[7px] after:rounded-full after:bg-accent after:content-['']",
        )}
      >
        {n.time}
      </time>
    </Link>
  );
}
