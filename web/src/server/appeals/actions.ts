"use server";

import { revalidatePath } from "next/cache";
import { DEMO_NOW } from "@/lib/demo-clock";
import { KINDS, PER_DAY, TEXT_MAX, TEXT_MIN, staffById, unitById, type TargetKind } from "@/lib/appeals";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db/client";

export type AppealResult = { ok: true; number: number } | { ok: false; error: string };

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Кому адресовано и куда приёмная ректора передаст. Адресат — только из справочника, свободный ввод не принимается. */
async function resolveTarget(kind: unknown, id: unknown): Promise<{ targetKind: TargetKind; targetId: string | null; targetName: string; targetLine: string | null; forwardedTo: string | null } | null> {
  if (kind === "none") return { targetKind: "none", targetId: null, targetName: "Университет в целом", targetLine: null, forwardedTo: null };
  if (typeof id !== "string" || !/^[a-z0-9-]{1,60}$/.test(id)) return null;
  if (kind === "teacher") {
    const t = await db.teacher.findUnique({ where: { slug: id }, select: { slug: true, lastName: true, firstName: true, middleName: true, position: true, department: true } });
    if (!t) return null;
    return { targetKind: "teacher", targetId: t.slug, targetName: [t.lastName, t.firstName, t.middleName].filter(Boolean).join(" "), targetLine: `${t.position}, ${lower(t.department)}`, forwardedTo: t.department };
  }
  if (kind === "staff") {
    const s = staffById(id);
    if (!s) return null;
    return { targetKind: "staff", targetId: s.id, targetName: s.name, targetLine: s.position, forwardedTo: unitById(s.unit)?.name ?? null };
  }
  if (kind === "unit") {
    const u = unitById(id);
    if (!u) return null;
    return { targetKind: "unit", targetId: u.id, targetName: u.name, targetLine: "Служба", forwardedTo: u.name };
  }
  return null;
}

/**
 * Обращение в приёмную ректора. Автор — только из сессии; вид, адресат и текст проверяются здесь;
 * не больше пяти обращений за сутки (защита от спама). Анонимность — флаг: ректорат имени не видит, автор видит своё обращение.
 */
export async function sendAppeal(input: { kind?: unknown; targetKind?: unknown; targetId?: unknown; text?: unknown; anonymous?: unknown }): Promise<AppealResult> {
  const user = await requireUser();
  const kind = KINDS.find((k) => k.id === input?.kind)?.id;
  if (!kind) return { ok: false, error: "Выберите вид обращения" };
  const target = await resolveTarget(input.targetKind, input.targetId);
  if (!target) return { ok: false, error: "Адресат не найден" };
  const text = typeof input.text === "string" ? input.text.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim() : "";
  if (text.length < TEXT_MIN) return { ok: false, error: "Опишите подробнее" };
  if (text.length > TEXT_MAX) return { ok: false, error: `Не больше ${TEXT_MAX} символов` };
  if (typeof input.anonymous !== "boolean") return { ok: false, error: "Неверный запрос" };

  return db.$transaction(async (tx) => {
    const recent = await tx.appeal.count({ where: { userId: user.id, createdAt: { gt: new Date(DEMO_NOW.getTime() - 86_400_000) } } });
    if (recent >= PER_DAY) return { ok: false as const, error: `Не больше ${PER_DAY} обращений в сутки` };
    const last = await tx.appeal.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
    const number = (last?.number ?? 1000) + 1;
    await tx.appeal.create({ data: { number, userId: user.id, kind, ...target, text, anonymous: input.anonymous as boolean, status: "sent", createdAt: DEMO_NOW } });
    revalidatePath("/redbutton");
    return { ok: true as const, number };
  });
}
