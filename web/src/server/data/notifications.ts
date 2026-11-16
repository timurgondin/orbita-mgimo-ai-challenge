import "server-only";
import { cache } from "react";
import { db } from "@/server/db/client";
import { requireUser } from "@/server/auth/session";
import { DEMO_NOW, daysBetween, formatDayMonth, formatShortWeekday, mskDate, mskTime } from "@/lib/demo-clock";
import { avatarGradientByKey, teacherInitials } from "./shared";
import type { NewsItem, NotificationCategory, NotificationCenterData, NotificationKind, NotificationLevel } from "./types";

const DAY_MS = 86_400_000;
const LEVEL_RANK: Record<NotificationLevel, number> = { action: 0, important: 1, info: 2 };

function timeLabel(d: Date): string {
  const diff = daysBetween(d, DEMO_NOW);
  if (diff <= 0) return mskTime(d);
  if (diff === 1) return "Вчера";
  if (diff < 7) return formatShortWeekday(mskDate(d));
  return formatDayMonth(d);
}

function groupOf(d: Date): NewsItem["group"] {
  const diff = daysBetween(d, DEMO_NOW);
  return diff <= 0 ? "Сегодня" : diff === 1 ? "Вчера" : "Ранее";
}

/** «До завтра, 10:00», «До 21 ноября» */
function dueLabel(d: Date): string {
  const diff = daysBetween(DEMO_NOW, d);
  if (diff <= 0) return `Сегодня до ${mskTime(d)}`;
  if (diff === 1) return `До завтра, ${mskTime(d)}`;
  return `До ${formatDayMonth(d)}`;
}

function parseBody(body: string): NewsItem["subtitle"] {
  const m = body.match(/^(.*?)\*\*(.+?)\*\*(.*)$/);
  return m ? { before: m[1] || undefined, emphasis: m[2], after: m[3] || undefined } : { before: body };
}

/** Все уведомления текущего пользователя (только из сессии); «будущие» относительно демо-часов не показываем. */
export const getNotificationCenter = cache(async (): Promise<NotificationCenterData> => {
  const user = await requireUser();
  const rows = await db.notification.findMany({
    where: { userId: user.id, createdAt: { lte: DEMO_NOW } },
    orderBy: { createdAt: "desc" },
    take: 60,
  });
  const items: NewsItem[] = rows.map((n) => {
    const level = (n.level as NotificationLevel) ?? "info";
    const pending = level === "action" && !n.resolvedAt;
    return {
      id: n.id,
      kind: (n.kind as NotificationKind) ?? "announcement",
      category: n.category as NotificationCategory,
      level,
      title: n.title,
      subtitle: parseBody(n.body),
      time: timeLabel(n.createdAt),
      group: groupOf(n.createdAt),
      unread: n.readAt == null,
      pending,
      due: pending && n.dueAt ? dueLabel(n.dueAt) : undefined,
      urgent: pending && !!n.dueAt && n.dueAt.getTime() - DEMO_NOW.getTime() <= DAY_MS,
      href: n.link,
      // действие показываем, пока оно актуально: resolve — пока не решено
      action:
        n.actionLabel && (n.actionKind === "link" || pending)
          ? { label: n.actionLabel, kind: n.actionKind === "resolve" ? "resolve" : "link" }
          : undefined,
      avatar:
        n.actorName && n.kind === "grade"
          ? { kind: "initials", text: teacherInitials(n.actorName), gradient: avatarGradientByKey(n.actorAvatar ?? "sand") }
          : { kind: "icon", icon: (n.kind as NotificationKind) ?? "announcement" },
    };
  });
  return {
    items,
    actions: items.filter((i) => i.pending).length,
    dot: items.some((i) => i.unread && i.level !== "info"),
  };
});

/** «Новое» на «Сегодня»: самые важные — нерешённые действия, затем непрочитанное важное, затем свежее. */
export async function getTopNews(limit = 3): Promise<NewsItem[]> {
  const { items } = await getNotificationCenter();
  const score = (i: NewsItem) => (i.pending ? 0 : i.unread ? 1 + LEVEL_RANK[i.level] : 10);
  return items
    .filter((i) => !i.urgent) // срочное уже в полосе наверху «Сегодня»
    .map((item, order) => ({ item, order }))
    .sort((a, b) => score(a.item) - score(b.item) || a.order - b.order)
    .slice(0, limit)
    .map((x) => x.item);
}
