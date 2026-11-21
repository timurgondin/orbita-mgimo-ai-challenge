"use server";

import { revalidatePath } from "next/cache";
import { CONTACT_ERROR, normalizeContact, type ContactField } from "@/lib/contacts";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { cardQr } from "@/server/profile/card-code";

export type ContactResult = { ok: true; value: string | null } | { ok: false; error: string };

const FIELDS: readonly ContactField[] = ["phone", "telegram"];

/** Меняет только телефон или Telegram и только у себя (пользователь — из сессии, id не принимается). */
export async function updateContact(field: unknown, value: unknown): Promise<ContactResult> {
  const user = await requireUser();
  if (!FIELDS.includes(field as ContactField) || typeof value !== "string") return { ok: false, error: "Неверный запрос" };
  const f = field as ContactField;
  const v = normalizeContact(f, value);
  if (v === undefined) return { ok: false, error: CONTACT_ERROR[f] };
  await db.user.update({ where: { id: user.id }, data: { [f]: v } });
  revalidatePath("/profile");
  return { ok: true, value: v };
}

/** Новый QR Орбита ID — только свой (токен из сессии, параметров нет). */
export async function refreshCardQr(): Promise<{ qr: string; ttl: number } | null> {
  const user = await requireUser();
  if (user.role !== "student" || !user.cardToken) return null;
  return cardQr(user.cardToken);
}
