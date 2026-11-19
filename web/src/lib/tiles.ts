/** Плитки быстрого доступа на «Сегодня». Студент закрепляет до пяти, остальные — в окне «Ещё». Общая константа клиента и сервера. */
export const TILE_IDS = ["courses", "grades", "rating", "documents", "card", "teachers", "library", "clubs", "print"] as const;
export type TileId = (typeof TILE_IDS)[number];

export const MAX_PINNED = 5;
export const DEFAULT_PINNED: TileId[] = ["grades", "card", "teachers", "library", "print"];

/** Закреплённые из БД: только известные id, без повторов, не больше пяти; пусто или битое — по умолчанию. */
export function parsePinned(raw: string | null | undefined): TileId[] {
  try {
    const v: unknown = raw ? JSON.parse(raw) : null;
    if (Array.isArray(v)) {
      const ids = [...new Set(v.filter((x): x is TileId => (TILE_IDS as readonly string[]).includes(x)))].slice(0, MAX_PINNED);
      if (ids.length) return ids;
    }
  } catch {}
  return DEFAULT_PINNED;
}
