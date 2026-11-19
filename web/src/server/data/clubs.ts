import "server-only";
import { db } from "@/server/db/client";
import { avatarGradientByKey } from "./shared";
import { getStudent } from "./shared";
import type { ClubView } from "./types";

const parse = (s: string): string[] => {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};
const initialsOf = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();

/** Все клубы и моё участие (пользователь из сессии). Контакты руководителя публичны — это его рабочие каналы клуба. */
export async function getClubs(): Promise<ClubView[] | null> {
  const user = await getStudent();
  if (!user) return null;
  const clubs = await db.club.findMany({
    orderBy: { order: "asc" },
    include: { members: { where: { userId: user.id }, select: { status: true } } },
  });
  return clubs.map((c) => {
    const mine = c.members[0]?.status as "member" | "pending" | undefined;
    return {
      id: c.id,
      slug: c.slug,
      title: c.title,
      category: c.category as ClubView["category"],
      color: c.color,
      short: c.short,
      description: c.description,
      schedule: c.schedule,
      place: c.place,
      members: c.membersCount + (mine === "member" ? 1 : 0),
      joinMode: c.joinMode as ClubView["joinMode"],
      tags: parse(c.tags),
      highlights: parse(c.highlights),
      leader: {
        name: c.leaderName,
        role: c.leaderRole,
        initials: initialsOf(c.leaderName),
        gradient: avatarGradientByKey(c.leaderAvatar),
        telegram: c.leaderTelegram,
        email: c.leaderEmail,
      },
      mine: mine ?? null,
    };
  });
}
