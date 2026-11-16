"use server";

import { revalidatePath } from "next/cache";
import { CONTACT_ERROR, normalizeContact, type ContactField } from "@/lib/contacts";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db/client";

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
