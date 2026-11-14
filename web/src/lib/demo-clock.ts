/** Фиксированное «сейчас» для демо: четверг, 19 ноября 2026, 12:29 (Europe/Moscow). */
export const DEMO_DATE = "2026-11-19";
export const DEMO_MINUTES = 12 * 60 + 29;
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
