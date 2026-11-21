/** Random Coffee: общие константы клиента, сервера и сида. */
import { BELLS } from "./bells";
import { addDays } from "./demo-clock";

export const COFFEE_INTERESTS = [
  "Стартапы", "Финансы", "ИИ", "Политика", "Дебаты", "Языки", "Путешествия", "Кино", "Книги", "Музыка",
  "Театр", "Фотография", "Дизайн", "Настолки", "Бег", "Йога", "Кулинария", "Волонтёрство",
] as const;
export type CoffeeInterest = (typeof COFFEE_INTERESTS)[number];
export const MIN_INTERESTS = 3;
export const MAX_INTERESTS = 6;

export const COFFEE_FORMATS = ["campus", "online", "any"] as const;
export type CoffeeFormat = (typeof COFFEE_FORMATS)[number];

export const CAFES = ["Кофейня «Зерно», корпус А", "Кафе в атриуме, корпус Б", "Терраса библиотеки, 3 этаж"] as const;
export const ONLINE_PLACE = "Видеозвонок в Орбите";
export const COFFEE_MINUTES = 30;

export const isInterest = (x: unknown): x is CoffeeInterest => typeof x === "string" && (COFFEE_INTERESTS as readonly string[]).includes(x);
export const isFormat = (x: unknown): x is CoffeeFormat => typeof x === "string" && (COFFEE_FORMATS as readonly string[]).includes(x);
export const formatsMeet = (a: CoffeeFormat, b: CoffeeFormat) => a === "any" || b === "any" || a === b;

/** Понедельник недели (YYYY-MM-DD) для даты по Москве. */
export function mondayOf(isoDate: string): string {
  const wd = new Date(`${isoDate}T12:00:00+03:00`).getUTCDay(); // 0 — вс
  return addDays(isoDate, -((wd + 6) % 7));
}

type Busy = { startsAt: Date; endsAt: Date };

/**
 * Окна для кофе на остаток недели: 30 минут сразу после пары (10:50, 12:30, 14:20, 16:00, 17:40), когда ни у кого из двоих нет занятий.
 * Не раньше чем через 3 часа от «сейчас», с понедельника по субботу недели `week`, не больше двух в день.
 */
export function coffeeSlots(busy: Busy[], now: Date, week: string, limit = 5): { startsAt: Date; endsAt: Date }[] {
  const earliest = now.getTime() + 3 * 3_600_000;
  const starts = [2, 3, 4, 5, 6].map((p) => BELLS[p][1]);
  const out: { startsAt: Date; endsAt: Date }[] = [];
  for (let d = 0; d < 6 && out.length < limit; d++) {
    const day = addDays(week, d);
    let perDay = 0;
    for (const t of starts) {
      if (perDay >= 2) break;
      const startsAt = new Date(`${day}T${t}:00+03:00`);
      const endsAt = new Date(startsAt.getTime() + COFFEE_MINUTES * 60_000);
      if (startsAt.getTime() < earliest) continue;
      if (busy.some((b) => b.startsAt < endsAt && b.endsAt > startsAt)) continue;
      out.push({ startsAt, endsAt });
      perDay++;
      if (out.length >= limit) break;
    }
  }
  return out;
}
