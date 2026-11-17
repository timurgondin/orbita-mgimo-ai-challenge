// Фразы вместо склеек через «·». Правило — docs/ui-guide.md, «Метаданные».

type Place = { label: "ауд." | "каб." | ""; number: string };

/** «Семинар» + ауд. 3108 → «Семинар в ауд. 3108»; онлайн → «Семинар онлайн»; без вида → «Ауд. 3108». */
export function kindAt(kind: string | undefined, place: Place): string {
  // неразрывный пробел: «ауд. 4105» не переносится по частям
  const where = place.label ? `${place.label}\u00a0${place.number}` : place.number.toLowerCase();
  if (!kind) return where.charAt(0).toUpperCase() + where.slice(1);
  return place.label ? `${kind} в ${where}` : `${kind} ${where}`;
}


/** Слово к числу: plural(5, "кредит", "кредита", "кредитов") → «кредитов». */
export function plural(n: number, one: string, few: string, many: string): string {
  const d = n % 10, h = n % 100;
  return d === 1 && h !== 11 ? one : d >= 2 && d <= 4 && (h < 12 || h > 14) ? few : many;
}

/** «6 кредитов», «1 кредит» */
export const creditsLabel = (n: number) => `${n} ${plural(n, "кредит", "кредита", "кредитов")}`;
