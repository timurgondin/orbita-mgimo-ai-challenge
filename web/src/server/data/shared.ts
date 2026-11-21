import "server-only";
import { requireUser, type CurrentUser } from "@/server/auth/session";
import { AVATAR_GRADIENTS } from "@/lib/user-view";
import { DEMO_NOW, daysBetween, formatDayMonth, formatShortWeekday, mskDate, mskTime } from "@/lib/demo-clock";
import type { WorkStatus } from "./types";

/** Пользователь из сессии; для не-студентов — null. Id из адреса или формы нигде не принимается. */
export async function getStudent(): Promise<CurrentUser | null> {
  const user = await requireUser();
  return user.role === "student" ? user : null;
}

/** Университетская почта по логину: у студента всегда видна в поиске людей. */
export const emailOf = (login: string) => `${login}@orbita.edu`;

export const fmt1 = (n: number) => n.toFixed(1).replace(".", ",");
export const fmtWork = (n: number) => (Number.isInteger(n) ? String(n) : fmt1(n));
export const round1 = (n: number) => Math.round(n * 10) / 10;

export const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Инициалы преподавателя из «Петрова Е. А.» → «ЕП», «Morgan K.» → «KM». */
export function teacherInitials(name: string): string {
  const [surname = "", first = ""] = name.split(" ");
  return `${first[0] ?? ""}${surname[0] ?? ""}`.toUpperCase();
}

export const avatarGradientByKey = (key: string) => AVATAR_GRADIENTS[key] ?? AVATAR_GRADIENTS.sand;

/** Текущий балл = Σ(балл·вес) / Σ(вес проверенных), один знак после запятой. */
export function currentScore(items: { weight: number; work?: { status: string; score: number | null } }[]): number | null {
  let sum = 0;
  let weights = 0;
  for (const { weight, work } of items) {
    if (work?.status === "graded" && work.score != null) {
      sum += work.score * weight;
      weights += weight;
    }
  }
  return weights ? round1(sum / weights) : null;
}

/** Срок для списков: «Сегодня, 23:59» / «Сб, 18:00» / «3 декабря». */
export function formatDue(due: Date, now: Date = DEMO_NOW): { label: string; today: boolean } {
  const diff = daysBetween(now, due);
  if (diff === 0) return { label: `Сегодня, ${mskTime(due)}`, today: true };
  if (diff > 0 && diff < 7) return { label: `${formatShortWeekday(mskDate(due))}, ${mskTime(due)}`, today: false };
  return { label: formatDayMonth(due), today: false };
}

export const isOpen = (status: WorkStatus | string) => status !== "graded";
