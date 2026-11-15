/** Фиксированное «сейчас» для демо: четверг, 19 ноября 2026, 11:49 (Europe/Moscow). */
export const DEMO_DATE = "2026-11-19";
export const DEMO_MINUTES = 11 * 60 + 49;
const TZ = "Europe/Moscow";

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function atNoon(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00+03:00`);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function addDays(isoDate: string, days: number): string {
  const d = atNoon(isoDate);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toLocaleDateString("sv-SE", { timeZone: TZ });
}

/** «Четверг, 19 ноября» */
export function formatLongDate(isoDate: string): string {
  return capitalize(
    new Intl.DateTimeFormat("ru-RU", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: TZ,
    }).format(atNoon(isoDate)),
  );
}

/** «Пн» */
export function formatShortWeekday(isoDate: string): string {
  return capitalize(
    new Intl.DateTimeFormat("ru-RU", { weekday: "short", timeZone: TZ }).format(
      atNoon(isoDate),
    ),
  );
}

export function greeting(minutes: number): string {
  const h = minutes / 60;
  if (h < 5) return "Доброй ночи";
  if (h < 12) return "Доброе утро";
  if (h < 18) return "Добрый день";
  return "Добрый вечер";
}

/** «41 мин», «1 ч 5 мин» */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} мин`;
  return m === 0 ? `${h} ч` : `${h} ч ${m} мин`;
}

/** «Сейчас» как момент времени. */
export const DEMO_NOW = new Date(`${DEMO_DATE}T11:49:00+03:00`);

/** Дата YYYY-MM-DD по Москве. */
export function mskDate(d: Date): string {
  return d.toLocaleDateString("sv-SE", { timeZone: TZ });
}

/** «HH:MM» по Москве. */
export function mskTime(d: Date): string {
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ }).format(d);
}

export function mskMinutes(d: Date): number {
  return toMinutes(mskTime(d));
}

/** Начало суток по Москве. */
export function dayStart(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00+03:00`);
}

/** Разница в днях между датами по Москве (b − a). */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((dayStart(mskDate(b)).getTime() - dayStart(mskDate(a)).getTime()) / 86_400_000);
}

/** «3 декабря» */
export function formatDayMonth(d: Date): string {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: TZ }).format(d);
}

/** «дек» */
export function formatMonthShort(d: Date): string {
  return new Intl.DateTimeFormat("ru-RU", { month: "short", timeZone: TZ }).format(d).replace(".", "");
}

/** Начало семестра — понедельник 31 августа 2026. */
const SEMESTER_START = "2026-08-31";
const SEMESTER_WEEKS = 16;

export function semesterLabel(now: Date = DEMO_NOW): string {
  const week = Math.floor(daysBetween(dayStart(SEMESTER_START), now) / 7) + 1;
  return `Осенний семестр · ${week}-я неделя из ${SEMESTER_WEEKS}`;
}
