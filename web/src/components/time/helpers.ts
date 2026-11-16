import { DEMO_DATE, DEMO_MINUTES, addDays, daysBetween, formatDayMonth, formatDuration, toMinutes } from "@/lib/demo-clock";

export const DOW = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
export const DOWL = ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const noon = (iso: string) => new Date(`${iso}T12:00:00+03:00`);

export const weekDates = (monday: string) => Array.from({ length: 6 }, (_, i) => addDays(monday, i));
export const dayNumber = (iso: string) => Number(iso.slice(8));
/** «19 ноября» */
export const dayMonth = (iso: string) => formatDayMonth(noon(iso));
/** Индекс дня недели 0–5 (Пн–Сб) для даты внутри недели */
export const dowIndex = (monday: string, iso: string) => daysBetween(noon(monday), noon(iso));

/** «16 – 21 ноября» / «30 ноября – 5 декабря» */
export function weekTitle(monday: string): string {
  const days = weekDates(monday);
  const [a, b] = [dayMonth(days[0]).split(" "), dayMonth(days[5]).split(" ")];
  return a[1] === b[1] ? `${a[0]} – ${b[0]} ${b[1]}` : `${a[0]} ${a[1]} – ${b[0]} ${b[1]}`;
}

/** «Сегодня» / «Завтра» / «Вчера» либо null */
export function relDay(iso: string): string | null {
  const d = daysBetween(noon(DEMO_DATE), noon(iso));
  return d === 0 ? "Сегодня" : d === 1 ? "Завтра" : d === -1 ? "Вчера" : null;
}

export interface SlotStatus {
  state: "past" | "live" | "future";
  text: string;
  tone: "" | "live" | "hot";
  progress?: number;
}

export function slotStatus(date: string, start: string, end: string): SlotStatus {
  const diff = daysBetween(noon(DEMO_DATE), noon(date));
  if (diff < 0) return { state: "past", text: "Прошла", tone: "" };
  if (diff > 0) return { state: "future", text: "", tone: "" };
  const [s, e] = [toMinutes(start), toMinutes(end)];
  if (e <= DEMO_MINUTES) return { state: "past", text: "Прошла", tone: "" };
  if (s <= DEMO_MINUTES)
    return { state: "live", text: `ещё ${formatDuration(e - DEMO_MINUTES)}`, tone: "live", progress: Math.round(((DEMO_MINUTES - s) / (e - s)) * 100) };
  const x = s - DEMO_MINUTES;
  return { state: "future", text: `Через ${formatDuration(x)}`, tone: x <= 30 ? "hot" : "" };
}

/** «3 этаж, корпус 2» из номера аудитории (первая цифра — корпус, вторая — этаж) */
export function roomHint(room: string): string {
  return /^\d{4}$/.test(room) ? `${room[1]} этаж корпуса ${room[0]}` : `${room[0]} этаж главного корпуса`;
}

export const cc = (color: string) => ({ "--cc": `var(--c-${color})` }) as React.CSSProperties;
export const ACCENT = { "--cc": "var(--accent)" } as React.CSSProperties;
