import "server-only";
import { addDays } from "@/lib/demo-clock";
import { db } from "@/server/db/client";
import { currentWeek, parseFormat, parseInterests, slotsFor } from "@/server/coffee/match";
import { avatarGradientByKey, getStudent } from "./shared";
import type { CoffeePerson, CoffeeView } from "./types";

type Answer = "new" | "yes" | "skip";
const answer = (s: string): Answer => (s === "yes" || s === "skip" ? s : "new");

const person = (u: { firstName: string; lastName: string; avatar: string; program: string | null; course: number | null; faculty: string | null }): CoffeePerson => ({
  name: `${u.firstName} ${u.lastName}`,
  initials: `${u.firstName[0] ?? ""}${u.lastName[0] ?? ""}`.toUpperCase(),
  gradient: avatarGradientByKey(u.avatar),
  study: [u.program, u.course ? `${u.course} курс` : null].filter(Boolean).join(", "),
  faculty: u.faculty,
});

const PERSON = { firstName: true, lastName: true, avatar: true, program: true, course: true, faculty: true, telegram: true } as const;

/**
 * Random Coffee текущего студента (из сессии). О паре — только то, что нужно для встречи: имя, программа, интересы;
 * Telegram пары — лишь когда оба согласились. Чужие встречи не читаются: выборка только по своему участию.
 */
export async function getCoffee(): Promise<CoffeeView | null> {
  const user = await getStudent();
  if (!user) return null;
  const week = currentWeek();
  const [profile, mine] = await Promise.all([
    db.coffeeProfile.findUnique({ where: { userId: user.id } }),
    db.coffeeMember.findMany({
      where: { userId: user.id },
      include: {
        match: {
          include: { members: { where: { userId: { not: user.id } }, include: { user: { select: { ...PERSON, coffeeProfile: { select: { interests: true } } } } } } },
        },
      },
      orderBy: { match: { startsAt: "desc" } },
    }),
  ]);
  const myInterests = profile ? parseInterests(profile.interests) : [];

  const cur = mine.find((m) => m.match.week === week);
  let current: CoffeeView["current"] = null;
  if (cur && cur.match.members[0]) {
    const other = cur.match.members[0];
    const theirInterests = parseInterests(other.user.coffeeProfile?.interests ?? "[]");
    const both = cur.answer === "yes" && other.answer === "yes";
    const cancelled = cur.match.status !== "active";
    const alternatives = cancelled
      ? []
      : (await slotsFor([user.id, other.userId], week))
          .filter((s) => s.startsAt.getTime() !== cur.match.startsAt.getTime())
          .slice(0, 4)
          .map((s) => ({ startsAt: s.startsAt.toISOString(), endsAt: s.endsAt.toISOString() }));
    current = {
      id: cur.match.id,
      partner: {
        ...person(other.user),
        firstName: other.user.firstName,
        interests: theirInterests,
        shared: theirInterests.filter((i) => myInterests.includes(i)),
      },
      telegram: both && !cancelled ? other.user.telegram : null,
      startsAt: cur.match.startsAt.toISOString(),
      endsAt: cur.match.endsAt.toISOString(),
      place: cur.match.place,
      online: cur.match.online,
      mine: answer(cur.answer),
      theirs: answer(other.answer),
      cancelled,
      alternatives,
    };
  }

  const past = mine
    .filter((m) => m.match.week < week && m.match.members[0])
    .map((m) => ({
      id: m.match.id,
      partner: person(m.match.members[0].user),
      date: m.match.startsAt.toISOString(),
      met: m.met,
      cancelled: m.match.status !== "active",
    }));

  return {
    profile: profile ? { active: profile.active, interests: myInterests, format: parseFormat(profile.format) } : null,
    current,
    nextRound: addDays(week, 7),
    past,
  };
}
