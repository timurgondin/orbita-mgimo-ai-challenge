"use server";

import { revalidatePath } from "next/cache";
import { isOrder } from "@/lib/tiles";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db/client";

export type TilesResult = { ok: true; message: string } | { ok: false; error: string };

/** Порядок плиток на «Сегодня»: перестановка всех сервисов из белого списка; первые пять — на главной. */
export async function setTileOrder(ids: unknown): Promise<TilesResult> {
  const user = await requireUser();
  if (!isOrder(ids)) return { ok: false, error: "Некорректный порядок" };
  await db.user.update({ where: { id: user.id }, data: { tiles: JSON.stringify(ids) } });
  revalidatePath("/");
  return { ok: true, message: "Главная обновлена" };
}
