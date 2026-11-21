import "server-only";
import { CAFES, ONLINE_PLACE, coffeeSlots, formatsMeet, isFormat, isInterest, mondayOf, type CoffeeFormat } from "@/lib/coffee";
import { DEMO_DATE, DEMO_NOW, formatDayMonth, formatShortWeekday, mskDate, mskTime } from "@/lib/demo-clock";
import { db } from "@/server/db/client";

export const currentWeek = () => mondayOf(DEMO_DATE);

export function parseInterests(raw: string): string[] {
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? [...new Set(v.filter(isInterest))] : [];
  } catch {
    return [];
  }
}
export const parseFormat = (raw: string): CoffeeFormat => (isFormat(raw) ? raw : "campus");

/** Занятость участников на неделе: пары их курсов и консультации, на которые они записаны. */
async function busyOf(userIds: string[], week: string) {
  const from = new Date(`${week}T00:00:00+03:00`);
  const to = new Date(from.getTime() + 7 * 86_400_000);
  const courseIds = (await db.enrollment.findMany({ where: { userId: { in: userIds } }, select: { courseId: true } })).map((e) => e.courseId);
  const [events, cons] = await Promise.all([
    db.scheduleEvent.findMany({ where: { courseId: { in: courseIds }, startsAt: { gte: from, lt: to } }, select: { startsAt: true, endsAt: true } }),
    db.consultation.findMany({ where: { signups: { some: { userId: { in: userIds } } }, startsAt: { gte: from, lt: to } }, select: { startsAt: true, endsAt: true } }),
  ]);
  return [...events, ...cons];
}

/** Общие свободные окна пары на остаток недели. */
export async function slotsFor(userIds: string[], week = currentWeek()) {
  return coffeeSlots(await busyOf(userIds, week), DEMO_NOW, week);
}

const when = (d: Date) =>
  mskDate(d) === DEMO_DATE ? `сегодня в ${mskTime(d)}` : `${formatShortWeekday(mskDate(d)).toLowerCase()}, ${formatDayMonth(d)}, в ${mskTime(d)}`;

const placeFor = (online: boolean, seed: string) => (online ? ONLINE_PLACE : CAFES[[...seed].reduce((a, c) => a + c.charCodeAt(0), 0) % CAFES.length]);

/**
 * Подобрать пару на текущую неделю, если её ещё нет: студент с другим набором людей (не встречались раньше), свободный на этой неделе,
 * с совместимым форматом. Больше общих интересов и другой факультет — выше. Возвращает id встречи или null.
 */
export async function matchNow(userId: string): Promise<string | null> {
  const week = currentWeek();
  const me = await db.user.findUnique({ where: { id: userId }, select: { faculty: true, coffeeProfile: true } });
  if (!me?.coffeeProfile?.active) return null;
  const busyThisWeek = await db.coffeeMember.findMany({ where: { match: { week, status: "active" } }, select: { userId: true } });
  const taken = new Set(busyThisWeek.map((m) => m.userId));
  if (taken.has(userId)) return null;
  const metBefore = new Set(
    (await db.coffeeMember.findMany({ where: { match: { members: { some: { userId } } }, userId: { not: userId } }, select: { userId: true } })).map((m) => m.userId),
  );
  const mine = new Set(parseInterests(me.coffeeProfile.interests));
  const myFormat = parseFormat(me.coffeeProfile.format);
  const candidates = await db.coffeeProfile.findMany({
    where: { active: true, userId: { not: userId }, user: { role: "student" } },
    select: { userId: true, interests: true, format: true, user: { select: { faculty: true } } },
  });
  const ranked = candidates
    .filter((c) => !taken.has(c.userId) && !metBefore.has(c.userId) && formatsMeet(myFormat, parseFormat(c.format)))
    .map((c) => ({
      c,
      score: parseInterests(c.interests).filter((i) => mine.has(i)).length * 3 + (c.user.faculty !== me.faculty ? 2 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.c.userId.localeCompare(b.c.userId));

  for (const { c } of ranked) {
    const [slot] = await slotsFor([userId, c.userId], week);
    if (!slot) continue;
    const online = myFormat === "online" || parseFormat(c.format) === "online";
    const match = await db.coffeeMatch.create({
      data: {
        week, startsAt: slot.startsAt, endsAt: slot.endsAt, online, place: placeFor(online, userId + c.userId), createdAt: DEMO_NOW,
        members: { create: [{ userId }, { userId: c.userId }] },
      },
    });
    const partners = await db.user.findMany({ where: { id: { in: [userId, c.userId] } }, select: { id: true, firstName: true, lastName: true, program: true } });
    for (const p of partners) {
      const other = partners.find((x) => x.id !== p.id)!;
      await db.notification.create({
        data: {
          userId: p.id, kind: "coffee", category: "announcement", level: "info", title: "Random Coffee: пара на неделю",
          body: `**${other.firstName} ${other.lastName}**, ${other.program ?? "студент"}. Кофе ${when(slot.startsAt)}`,
          link: "/coffee", createdAt: DEMO_NOW, refId: match.id,
        },
      });
    }
    return match.id;
  }
  return null;
}
