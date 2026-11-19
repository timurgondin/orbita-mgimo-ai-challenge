import "server-only";
import { DEMO_NOW, daysBetween } from "@/lib/demo-clock";
import { MOBILITY } from "@/lib/announcements";
import { ACTIVE_STATUSES } from "@/lib/office-catalog";
import { db } from "@/server/db/client";
import { plural } from "@/lib/phrases";
import { getArchive } from "./archive";
import { getRatingSummary } from "./rating";
import { getStudent } from "./shared";
import type { MobilityPage } from "./types";

/** Страница конкурса мобильности для текущего студента: требования сверены с его данными, своя заявка — если уже подана. */
export async function getMobilityPage(): Promise<MobilityPage | null> {
  const user = await getStudent();
  if (!user) return null;
  const [archive, rating, english, app] = await Promise.all([
    getArchive(),
    getRatingSummary(),
    db.enrollment.findFirst({ where: { userId: user.id, course: { title: { contains: "Английский" } } }, select: { course: { select: { title: true } } } }),
    db.officeRequest.findFirst({ where: { userId: user.id, typeId: MOBILITY.typeId, status: { in: [...ACTIVE_STATUSES] } }, select: { number: true, params: true } }),
  ]);
  const gpa = archive?.average ? Number(archive.average.replace(",", ".")) : null;
  const level = english?.course.title.match(/[ABC][12]\+?/)?.[0] ?? null;
  const engOk = !!level && (level >= "B2" || level.startsWith("C"));
  const checks: MobilityPage["checks"] = {
    course: { ok: (user.course ?? 0) >= 2, note: `${user.course ?? 1} курс` },
    gpa: { ok: gpa != null && gpa >= 7, note: gpa != null ? `У тебя ${archive!.average}` : "Пока нет оценок" },
    rating: { ok: !!rating && rating.top <= 25, note: rating ? `${rating.rank} место, топ-${rating.top}%` : "Рейтинга пока нет" },
    english: { ok: engOk, note: level ? `Курс ${level} в Орбите` : "Нужен сертификат" },
    debts: { ok: true, note: "Долгов нет" },
  };
  const deadline = new Date(MOBILITY.deadline);
  const left = daysBetween(DEMO_NOW, deadline);
  let priorities: string[] = [];
  try {
    priorities = app ? ((JSON.parse(app.params) as { priorities?: string[] }).priorities ?? []) : [];
  } catch {}
  return {
    checks,
    eligible: Object.values(checks).every((c) => c.ok),
    open: DEMO_NOW < deadline,
    left: left > 0 ? `${left} ${plural(left, "день", "дня", "дней")}` : "сегодня последний день",
    application: app ? { number: app.number, priorities } : null,
  };
}
