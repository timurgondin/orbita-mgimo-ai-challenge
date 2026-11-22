import "server-only";
import { BELLS, PAIRS } from "@/lib/bells";
import { DEMO_DATE, DEMO_MINUTES, DEMO_NOW, addDays, dayStart, formatDayMonth, formatShortWeekday, mskDate, mskMinutes, toMinutes } from "@/lib/demo-clock";
import { CHECKIN_AFTER, CHECKIN_BEFORE, DAYS_AHEAD, ROOMS, STEP, hhmm, roomById, roomPlace, type Room } from "@/lib/rooms";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import type { BookingState, BookingView, RoomBusy, RoomsData, RoomsDay } from "./rooms-types";

const MIN = 60_000;

/** Дни брони: сегодня и неделя вперёд, кроме воскресенья. */
export function bookingDays(): RoomsDay[] {
  const out: RoomsDay[] = [];
  for (let i = 0; i <= DAYS_AHEAD; i++) {
    const date = addDays(DEMO_DATE, i);
    if (new Date(`${date}T12:00:00+03:00`).getUTCDay() === 0) continue;
    const dm = formatDayMonth(dayStart(date));
    out.push({
      date,
      dow: formatShortWeekday(date),
      day: date.slice(8).replace(/^0/, ""),
      dm,
      label: i === 0 ? "Сегодня" : i === 1 ? "Завтра" : `${formatShortWeekday(date)}, ${dm}`,
      minStart: i === 0 ? Math.ceil(DEMO_MINUTES / STEP) * STEP : 0,
    });
  }
  return out;
}

/** Детерминированный «шум» для занятости аудиторий другими группами: одинаковый при каждом запросе. */
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) % 100;
}
const DENSITY: Record<number, number> = { 1: 35, 2: 60, 3: 65, 4: 55, 5: 55, 6: 40, 7: 20, 8: 10 };

/**
 * Пары в учебной аудитории за день: настоящие из расписания (все группы в БД) и пары других групп университета,
 * которых нет в прототипе, — по сетке звонков, стабильно для каждой аудитории и дня.
 */
export async function classBusy(rooms: Room[], dates: string[]): Promise<Map<string, RoomBusy[]>> {
  const out = new Map<string, RoomBusy[]>();
  const classes = rooms.filter((r) => r.kind === "class");
  if (!classes.length || !dates.length) return out;
  const sorted = [...dates].sort();
  const events = await db.scheduleEvent.findMany({
    where: { room: { in: classes.map((r) => r.number) }, startsAt: { gte: dayStart(sorted[0]), lt: dayStart(addDays(sorted[sorted.length - 1], 1)) } },
    select: { room: true, startsAt: true, endsAt: true },
  });
  const byRoomDay = groupBy(events, (e) => `${e.room}|${mskDate(e.startsAt)}`);
  for (const r of classes) {
    for (const date of dates) {
      const sat = new Date(`${date}T12:00:00+03:00`).getUTCDay() === 6;
      const list: RoomBusy[] = (byRoomDay.get(`${r.number}|${date}`) ?? [])
        .map((e) => ({ from: mskMinutes(e.startsAt), to: mskMinutes(e.endsAt), kind: "class" as const }));
      for (const p of PAIRS) {
        const d = sat ? (p <= 4 ? 30 : 0) : DENSITY[p];
        if (hash(`${r.id}|${date}|${p}`) < d) list.push({ from: toMinutes(BELLS[p][0]), to: toMinutes(BELLS[p][1]), kind: "class" });
      }
      out.set(`${r.id}|${date}`, merge(list));
    }
  }
  return out;
}

/** Разложить записи по ключу за один проход — вместо фильтра по всему списку для каждой комнаты и дня. */
function groupBy<T>(items: T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of items) {
    const k = key(x);
    const list = m.get(k);
    if (list) list.push(x);
    else m.set(k, [x]);
  }
  return m;
}

/** Склеить пересекающиеся отрезки одного вида (своя бронь не склеивается с чужой). */
function merge(list: RoomBusy[]): RoomBusy[] {
  const s = [...list].sort((a, b) => a.from - b.from);
  const out: RoomBusy[] = [];
  for (const x of s) {
    const last = out[out.length - 1];
    if (last && x.from <= last.to && last.kind === x.kind && !!last.mine === !!x.mine) last.to = Math.max(last.to, x.to);
    else out.push({ ...x });
  }
  return out;
}

/**
 * Бронь «держит» комнату, если отметились или ещё можно отметиться. Не отметились за 15 минут — комната свободна.
 * Условие для Prisma — одно на чтение и на проверку пересечений в действиях.
 */
export const holdsRoom = () => ({
  OR: [{ status: "checked" }, { status: "booked", startsAt: { gte: new Date(DEMO_NOW.getTime() - CHECKIN_AFTER * MIN) } }],
});

export function bookingState(b: { status: string; startsAt: Date; endsAt: Date }): BookingState {
  const now = DEMO_NOW.getTime();
  if (b.status === "cancelled") return "cancelled";
  if (b.status === "checked") return b.endsAt.getTime() > now ? "active" : "done";
  if (now > b.startsAt.getTime() + CHECKIN_AFTER * MIN) return "missed";
  if (now >= b.startsAt.getTime() - CHECKIN_BEFORE * MIN) return "checkin";
  return "upcoming";
}

const dayLabel = (d: Date) => {
  const diff = Math.round((dayStart(mskDate(d)).getTime() - dayStart(DEMO_DATE).getTime()) / 86_400_000);
  const date = mskDate(d);
  return diff === 0 ? "Сегодня" : diff === 1 ? "Завтра" : diff === -1 ? "Вчера" : `${formatShortWeekday(date)}, ${formatDayMonth(d)}`;
};

function view(b: { id: string; roomId: string; title: string | null; status: string; startsAt: Date; endsAt: Date }): BookingView | null {
  const r = roomById(b.roomId);
  if (!r) return null;
  const state = bookingState(b);
  const start = mskMinutes(b.startsAt);
  const end = hhmm(mskMinutes(b.endsAt));
  const note: Record<BookingState, string> = {
    upcoming: mskDate(b.startsAt) === DEMO_DATE ? `Отметиться с ${hhmm(start - CHECKIN_BEFORE)}` : "",
    checkin: `Отметиться до ${hhmm(start + CHECKIN_AFTER)}`,
    active: `Ваша до ${end}`,
    done: "Прошла",
    missed: "Снята: не отметились",
    cancelled: "Отменена",
  };
  return {
    id: b.id,
    roomId: r.id,
    roomName: r.name,
    number: r.number,
    where: roomPlace(r),
    place: r.place,
    date: mskDate(b.startsAt),
    dayLabel: dayLabel(b.startsAt),
    start: hhmm(start),
    end,
    title: b.title,
    state,
    note: note[state],
  };
}

/** Брони — студентам и преподавателям (как печать). */
export async function roomsUser() {
  const me = await requireUser();
  return me.role === "student" || me.role === "teacher" ? me : null;
}

/** Комнаты с занятостью на неделю брони и свои брони. Чужие брони — только «занято», без имён. */
export async function getRooms(): Promise<RoomsData | null> {
  const user = await roomsUser();
  if (!user) return null;
  const days = bookingDays();
  const from = dayStart(days[0].date);
  const to = dayStart(addDays(days[days.length - 1].date, 1));
  const [bookings, mine, classes] = await Promise.all([
    db.roomBooking.findMany({ where: { startsAt: { gte: from, lt: to }, ...holdsRoom() }, select: { roomId: true, userId: true, startsAt: true, endsAt: true } }),
    db.roomBooking.findMany({ where: { userId: user.id }, orderBy: { startsAt: "desc" }, take: 30 }),
    classBusy(ROOMS, days.map((d) => d.date)),
  ]);
  const bookingsByRoomDay = groupBy(bookings, (b) => `${b.roomId}|${mskDate(b.startsAt)}`);
  const rooms = ROOMS.map((r) => {
    const busy: Record<string, RoomBusy[]> = {};
    for (const d of days) {
      const own = (bookingsByRoomDay.get(`${r.id}|${d.date}`) ?? [])
        .map((b) => ({ from: mskMinutes(b.startsAt), to: mskMinutes(b.endsAt), kind: "booking" as const, mine: b.userId === user.id || undefined }));
      busy[d.date] = merge([...(classes.get(`${r.id}|${d.date}`) ?? []), ...own]);
    }
    return { ...r, where: roomPlace(r), busy };
  });
  const views = mine.map(view).filter((v): v is BookingView => !!v);
  const live = (s: BookingState) => s === "upcoming" || s === "checkin" || s === "active";
  return {
    days,
    rooms,
    upcoming: views.filter((v) => live(v.state)).reverse(),
    past: views.filter((v) => !live(v.state)).slice(0, 4),
    nowDate: DEMO_DATE,
    nowMin: DEMO_MINUTES,
  };
}
