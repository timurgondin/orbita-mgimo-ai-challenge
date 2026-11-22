// Бронирование аудиторий: брони демо-студентов и чужие брони переговорок на неделю вперёд (занятость для демо).
import type { PrismaClient } from "@prisma/client";
import { ROOMS } from "../src/lib/rooms";

const NOW = new Date("2026-11-19T11:49:00+03:00");
const at = (date: string, hm: string) => new Date(`${date}T${hm}:00+03:00`);
const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

// [логин, комната, день, начало, конец, тема, статус]
const MINE: [string, string, string, string, string, string | null, "booked" | "checked" | "cancelled"][] = [
  ["a.vorontsova", "vega", "2026-11-19", "13:00", "14:00", "Проект по маркетингу", "booked"],
  ["a.vorontsova", "lyra", "2026-11-23", "16:30", "18:00", "Подготовка к дебатам", "booked"],
  ["a.vorontsova", "altair", "2026-11-17", "16:30", "17:30", "Разбор задач по микроэкономике", "checked"],
  ["a.vorontsova", "sirius", "2026-11-16", "14:00", "15:00", null, "booked"], // не отметилась — снята
  ["m.orlov", "orion", "2026-11-19", "10:00", "11:00", "Кейс-чемпионат", "checked"],
  ["m.orlov", "andromeda", "2026-11-20", "12:00", "13:30", "Модель ООН", "booked"],
];

const DAYS = ["2026-11-19", "2026-11-20", "2026-11-21", "2026-11-23", "2026-11-24", "2026-11-25"];

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function seedRooms(db: PrismaClient) {
  await db.roomBooking.deleteMany();
  const others = (await db.user.findMany({ where: { role: "student", login: { notIn: ["a.vorontsova", "m.orlov", "n.lanskaya"] } }, select: { id: true }, orderBy: { login: "asc" }, take: 60 })).map((u) => u.id);
  const ids = new Map<string, string>();
  for (const login of new Set(MINE.map((m) => m[0]))) ids.set(login, (await db.user.findUniqueOrThrow({ where: { login }, select: { id: true } })).id);

  const rows: { roomId: string; userId: string; title: string | null; startsAt: Date; endsAt: Date; status: string; checkedAt: Date | null; createdAt: Date }[] = [];
  for (const [login, roomId, date, s, e, title, status] of MINE) {
    const startsAt = at(date, s);
    rows.push({ roomId, userId: ids.get(login)!, title, startsAt, endsAt: at(date, e), status, checkedAt: status === "checked" ? new Date(startsAt.getTime() + 4 * 60_000) : null, createdAt: new Date(startsAt.getTime() - 2 * 86_400_000) });
  }
  const free = (roomId: string, a: Date, b: Date) => !rows.some((r) => r.roomId === roomId && r.startsAt < b && r.endsAt > a);

  // чужие брони переговорок: днём занято плотнее, вечером и в субботу — реже
  const rand = rng(20261119);
  let k = 0;
  for (const room of ROOMS.filter((r) => r.kind === "meet")) {
    for (const date of DAYS) {
      const sat = date === "2026-11-21";
      const busy = (sat ? 0.12 : 0.3) + (room.seats >= 8 ? 0.06 : 0);
      for (let t = 8 * 60 + 30; t < 20 * 60; ) {
        const len = [60, 90, 60, 120, 30][Math.floor(rand() * 5)];
        const peak = t >= 11 * 60 && t < 17 * 60 ? 0.12 : 0;
        if (rand() < busy + peak && t + len <= 21 * 60) {
          const startsAt = at(date, hm(t));
          const endsAt = at(date, hm(t + len));
          if (free(room.id, startsAt, endsAt)) {
            const past = startsAt.getTime() <= NOW.getTime() - 15 * 60_000;
            rows.push({ roomId: room.id, userId: others[k++ % others.length], title: null, startsAt, endsAt, status: past ? "checked" : "booked", checkedAt: past ? new Date(startsAt.getTime() + 3 * 60_000) : null, createdAt: new Date(startsAt.getTime() - 86_400_000) });
          }
          t += len + (rand() < 0.5 ? 0 : 30);
        } else t += 30 * (1 + Math.floor(rand() * 2));
      }
    }
  }
  await db.roomBooking.createMany({ data: rows });
  return rows.length;
}
