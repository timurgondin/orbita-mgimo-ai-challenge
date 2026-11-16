// Фразы вместо склеек через «·». Правило — docs/ui-guide.md, «Метаданные».

type Place = { label: "ауд." | "каб." | ""; number: string };

/** «Семинар» + ауд. 3108 → «Семинар в ауд. 3108»; онлайн → «Семинар онлайн»; без вида → «Ауд. 3108». */
export function kindAt(kind: string | undefined, place: Place): string {
  // неразрывный пробел: «ауд. 4105» не переносится по частям
  const where = place.label ? `${place.label}\u00a0${place.number}` : place.number.toLowerCase();
  if (!kind) return where.charAt(0).toUpperCase() + where.slice(1);
  return place.label ? `${kind} в ${where}` : `${kind} ${where}`;
}

