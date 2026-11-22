/**
 * Плитки быстрого доступа на «Сегодня». Студент расставляет все сервисы по порядку (перетаскиванием в окне «Ещё»):
 * первые пять видны на главной, остальные — в «Ещё». Общая константа клиента и сервера.
 */
export const TILE_IDS = ["courses", "grades", "rating", "documents", "card", "library", "clubs", "print", "coffee", "people", "rooms", "food", "redbutton"] as const;
export type TileId = (typeof TILE_IDS)[number];

export const MAX_PINNED = 5;
export const DEFAULT_PINNED: TileId[] = ["grades", "card", "people", "library", "print"];

const isTile = (x: unknown): x is TileId => typeof x === "string" && (TILE_IDS as readonly string[]).includes(x);

/** Полный порядок из БД: известные id без повторов, недостающие — в конец по умолчанию. Старый формат (только закреплённые) тоже читается. */
export function parseOrder(raw: string | null | undefined): TileId[] {
  let head: TileId[] = [];
  try {
    const v: unknown = raw ? JSON.parse(raw) : null;
    if (Array.isArray(v)) head = [...new Set(v.filter(isTile))];
  } catch {}
  if (!head.length) head = DEFAULT_PINNED;
  return [...head, ...TILE_IDS.filter((id) => !head.includes(id))];
}

/** Порядок — перестановка всех плиток (ровно по разу каждая). */
export const isOrder = (v: unknown): v is TileId[] => Array.isArray(v) && v.length === TILE_IDS.length && v.every(isTile) && new Set(v).size === v.length;
