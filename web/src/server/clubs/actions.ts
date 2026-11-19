"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { DEMO_NOW } from "@/lib/demo-clock";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db/client";

export type ClubResult = { ok: true; message: string } | { ok: false; error: string };

const NOT_FOUND = "Клуб не найден";
const MAX_CLUBS = 8;
const idOk = (id: unknown): id is string => typeof id === "string" && /^[a-z0-9]{1,40}$/i.test(id);

/** Вступить: в открытый клуб — сразу, в клуб с отбором — заявка руководителю. Пользователь только из сессии. */
export async function joinClub(id: unknown): Promise<ClubResult> {
  const user = await requireUser();
  if (user.role !== "student") return { ok: false, error: "Клубы доступны студентам" };
  if (!idOk(id)) return { ok: false, error: NOT_FOUND };
  const club = await db.club.findUnique({ where: { id }, select: { id: true, joinMode: true, title: true } });
  if (!club) return { ok: false, error: NOT_FOUND };
  const count = await db.clubMember.count({ where: { userId: user.id } });
  if (count >= MAX_CLUBS) return { ok: false, error: `Не больше ${MAX_CLUBS} клубов одновременно` };
  const status = club.joinMode === "open" ? "member" : "pending";
  try {
    await db.clubMember.create({ data: { clubId: club.id, userId: user.id, status, createdAt: DEMO_NOW } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, error: "Вы уже в клубе или заявка отправлена" };
    throw e;
  }
  revalidatePath("/clubs");
  return { ok: true, message: status === "member" ? "Вы в клубе" : "Заявка отправлена руководителю" };
}

/** Выйти из клуба или отозвать заявку. Только своё участие. */
export async function leaveClub(id: unknown): Promise<ClubResult> {
  const user = await requireUser();
  if (!idOk(id)) return { ok: false, error: NOT_FOUND };
  const r = await db.clubMember.deleteMany({ where: { clubId: id, userId: user.id } });
  if (!r.count) return { ok: false, error: "Вы не состоите в этом клубе" };
  revalidatePath("/clubs");
  return { ok: true, message: "Готово" };
}
