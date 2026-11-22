/** Фиксированное «сейчас» для демо: четверг, 19 ноября 2026, 11:49 (Europe/Moscow). */
export const DEMO_DATE = "2026-11-19";
export const DEMO_MINUTES = 11 * 60 + 49;
const TZ = "Europe/Moscow";
/** Москва всегда UTC+3 (без перехода на летнее время с 2014 года) — даты и время считаем арифметикой, без Intl. */
const MSK_OFFSET = 3 * 3_600_000;
const mskIso = (d: Date) => new Date(d.getTime() + MSK_OFFSET).toISOString();

/** Форматтеры Intl создаются один раз: создание на каждый вызов стоило десятки микросекунд. */
const FMT_LONG = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
const FMT_WEEKDAY = new Intl.DateTimeFormat("ru-RU", { weekday: "short", timeZone: TZ });
const FMT_DAY_MONTH = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: TZ });
const FMT_MONTH_SHORT = new Intl.DateTimeFormat("ru-RU", { month: "short", timeZone: TZ });

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
  return mskDate(d);
}

/** «Четверг, 19 ноября» */
export function formatLongDate(isoDate: string): string {
  return capitalize(FMT_LONG.format(atNoon(isoDate)));
}

/** «Пн» */
export function formatShortWeekday(isoDate: string): string {
  return capitalize(FMT_WEEKDAY.format(atNoon(isoDate)));
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
  return mskIso(d).slice(0, 10);
}

/** «HH:MM» по Москве. */
export function mskTime(d: Date): string {
  return mskIso(d).slice(11, 16);
}

export function mskMinutes(d: Date): number {
  const m = Math.floor((d.getTime() + MSK_OFFSET) / 60_000) % 1440;
  return m < 0 ? m + 1440 : m;
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
  return FMT_DAY_MONTH.format(d);
}

/** «дек» */
export function formatMonthShort(d: Date): string {
  return FMT_MONTH_SHORT.format(d).replace(".", "");
}

