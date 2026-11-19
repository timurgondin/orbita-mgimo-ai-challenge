"use server";

import { revalidatePath } from "next/cache";
import { MAX_PINNED, TILE_IDS } from "@/lib/tiles";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db/client";

export type TilesResult = { ok: true; message: string } | { ok: false; error: string };

/** Закрепить плитки на «Сегодня»: от одной до пяти, только из белого списка, порядок — как выбрал студент. */
export async function setPinnedTiles(ids: unknown): Promise<TilesResult> {
  const user = await requireUser();
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > MAX_PINNED) return { ok: false, error: `Закрепите от 1 до ${MAX_PINNED} плиток` };
  if (!ids.every((x) => typeof x === "string" && (TILE_IDS as readonly string[]).includes(x)) || new Set(ids).size !== ids.length) return { ok: false, error: "Некорректный выбор" };
  await db.user.update({ where: { id: user.id }, data: { tiles: JSON.stringify(ids) } });
  revalidatePath("/");
  return { ok: true, message: "Главная обновлена" };
}
