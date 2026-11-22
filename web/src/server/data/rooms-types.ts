// Типы бронирования аудиторий: общие для сервера и клиента (без server-only).
import type { Room } from "@/lib/rooms";

/** Занятый отрезок дня в минутах от полуночи: пара по расписанию или чужая/своя бронь. */
export interface RoomBusy {
  from: number;
  to: number;
  kind: "class" | "booking";
  mine?: boolean;
}

export interface RoomsDay {
  date: string;
  dow: string;
  day: string;
  /** «Сегодня», «Завтра», «Сб, 21 ноября» */
  label: string;
  /** «19 ноября» — для диапазона над полосой дней */
  dm: string;
  /** Самое раннее начало брони в этот день, минуты (сегодня — ближайшие полчаса после «сейчас») */
  minStart: number;
}

export interface RoomView extends Room {
  where: string;
  /** Занятость по дням: дата → отрезки */
  busy: Record<string, RoomBusy[]>;
}

export type BookingState = "upcoming" | "checkin" | "active" | "done" | "missed" | "cancelled";

export interface BookingView {
  id: string;
  roomId: string;
  roomName: string;
  number: string;
  where: string;
  place: string;
  date: string;
  dayLabel: string;
  start: string;
  end: string;
  title: string | null;
  state: BookingState;
  /** «Отметиться с 12:45», «Отметиться до 13:15», «Идёт, до 14:00» */
  note: string;
}

export interface RoomsData {
  days: RoomsDay[];
  rooms: RoomView[];
  upcoming: BookingView[];
  past: BookingView[];
  nowDate: string;
  nowMin: number;
}
