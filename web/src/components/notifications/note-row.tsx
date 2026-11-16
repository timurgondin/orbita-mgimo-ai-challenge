"use client";

import Link from "next/link";
import {
  Award,
  BookOpen,
  CalendarClock,
  Clock3,
  FileCheck2,
  FolderOpen,
  Megaphone,
  ShieldCheck,
  Stamp,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NewsItem, NotificationKind } from "@/server/data/types";

/** Тип уведомления — видно сразу: подпись над заголовком и значок в цвете типа (цвета — статусы и курсы из гайда). */
export const KIND: Record<NotificationKind, { label: string; icon: LucideIcon; color: string }> = {
  grade: { label: "Оценка", icon: Award, color: "var(--st-green)" },
  material: { label: "Материалы", icon: FolderOpen, color: "var(--st-blue)" },
  deadline: { label: "Срок", icon: Clock3, color: "var(--st-yellow)" },
  schedule: { label: "Расписание", icon: CalendarClock, color: "var(--st-orange)" },
  document: { label: "Справка", icon: FileCheck2, color: "var(--st-violet)" },
  office: { label: "Офис", icon: Stamp, color: "var(--st-violet)" },
  library: { label: "Библиотека", icon: BookOpen, color: "var(--c-eng)" },
  security: { label: "Безопасность", icon: ShieldCheck, color: "var(--st-red)" },
  announcement: { label: "Объявление", icon: Megaphone, color: "var(--accent)" },
};
const kindOf = (k: NotificationKind) => KIND[k] ?? KIND.announcement;

/** Человек — круглая монограмма со значком типа в углу; система — квадратная плитка со значком в цвете типа. */
export function NoteAvatar({ n }: { n: NewsItem }) {
  const k = kindOf(n.kind);
  if (n.avatar.kind === "initials") {
    return (
      <span className="relative shrink-0">
        <span className="mono grid size-10 place-items-center rounded-full text-[13px] font-semibold" style={{ background: n.avatar.gradient }}>
          {n.avatar.text}
        </span>
        <span
          className="absolute -right-1 -bottom-1 grid size-[18px] place-items-center rounded-full text-white shadow-[0_0_0_2px_var(--ring-bg,var(--bg))]"
          style={{ background: k.color }}
        >
          <k.icon size={10} strokeWidth={2.4} />
        </span>
      </span>
    );
  }
  return (
    <span
      className="grid size-10 shrink-0 place-items-center rounded-[12px]"
      style={{ background: `color-mix(in srgb, ${k.color} 14%, transparent)`, color: k.color }}
    >
      <k.icon size={18} strokeWidth={1.7} />
    </span>
  );
}

export function NoteLabel({ n }: { n: NewsItem }) {
  const k = kindOf(n.kind);
  return (
    <div className="text-[12.5px] leading-tight font-medium" style={{ color: k.color }}>
      {k.label}
    </div>
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

/**
 * Строка уведомления. Новое — жирный заголовок, светлее пояснение и точка у времени;
 * прочитанное — обычный вес и приглушённые цвета.
 */
export function NoteRow({ n, fresh, onNavigate }: { n: NewsItem; fresh?: boolean; onNavigate?: () => void }) {
  const unread = fresh ?? n.unread;
  return (
    <Link
      href={n.href ?? "#"}
      onClick={onNavigate}
      data-note={n.id}
      data-unread={unread || undefined}
      className="-mx-3 flex items-center gap-3.5 rounded-[14px] px-3 py-[11px] transition-colors duration-150 hover:bg-hover"
    >
      <NoteAvatar n={n} />
      <div className="min-w-0 flex-1">
        <NoteLabel n={n} />
        <div className={cn("mt-0.5 line-clamp-2", unread ? "font-semibold text-text" : "text-text-2")}>{n.title}</div>
        <div className={cn("mt-px truncate text-sm", unread ? "text-text-2" : "text-text-3")}>
          <NoteSubtitle n={n} />
        </div>
      </div>
      <time
        className={cn(
          "flex items-center gap-2 self-start pt-0.5 text-[13px] whitespace-nowrap",
          unread ? "text-text-2 after:size-2 after:rounded-full after:bg-accent after:content-['']" : "text-text-3",
        )}
      >
        {n.time}
      </time>
    </Link>
  );
}
