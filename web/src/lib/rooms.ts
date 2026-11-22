/**
 * Комнаты кампуса для брони (вымышленные): переговорки для групповой работы — с именами звёзд, как в больших офисах,
 * и учебные аудитории, которые свободны между парами. Общая константа клиента и сервера.
 */
export type Equip = "screen" | "board" | "vks";
export interface Room {
  id: string;
  kind: "meet" | "class";
  name: string; // «Вега» или «Аудитория 1201»
  number: string; // номер на двери
  building: number;
  floor: number;
  place: string;
  seats: number;
  equip: Equip[];
}

export const ROOMS: Room[] = [
  { id: "vega", kind: "meet", name: "Вега", number: "2215", building: 2, floor: 2, place: "Коворкинг", seats: 4, equip: ["screen"] },
  { id: "altair", kind: "meet", name: "Альтаир", number: "2217", building: 2, floor: 2, place: "Коворкинг", seats: 6, equip: ["screen", "board"] },
  { id: "sirius", kind: "meet", name: "Сириус", number: "1310", building: 1, floor: 3, place: "У читального зала", seats: 2, equip: ["vks"] },
  { id: "lyra", kind: "meet", name: "Лира", number: "1204", building: 1, floor: 2, place: "Библиотека", seats: 8, equip: ["screen", "board", "vks"] },
  { id: "orion", kind: "meet", name: "Орион", number: "3120", building: 3, floor: 1, place: "У лифтов", seats: 10, equip: ["screen", "board", "vks"] },
  { id: "cassiopeia", kind: "meet", name: "Кассиопея", number: "4110", building: 4, floor: 1, place: "Напротив ауд. 4105", seats: 4, equip: ["board"] },
  { id: "andromeda", kind: "meet", name: "Андромеда", number: "5214", building: 5, floor: 2, place: "Студенческий центр", seats: 12, equip: ["screen", "board", "vks"] },
  { id: "polaris", kind: "meet", name: "Полярная", number: "3402", building: 3, floor: 4, place: "Тихая зона", seats: 2, equip: [] },
  { id: "a1201", kind: "class", name: "Аудитория 1201", number: "1201", building: 1, floor: 2, place: "Поточная", seats: 60, equip: ["screen", "board"] },
  { id: "a1202", kind: "class", name: "Аудитория 1202", number: "1202", building: 1, floor: 2, place: "Семинарская", seats: 28, equip: ["board"] },
  { id: "a2302", kind: "class", name: "Аудитория 2302", number: "2302", building: 2, floor: 3, place: "Семинарская", seats: 30, equip: ["screen", "board"] },
  { id: "a3108", kind: "class", name: "Аудитория 3108", number: "3108", building: 3, floor: 1, place: "Семинарская", seats: 24, equip: ["screen", "board"] },
  { id: "a4207", kind: "class", name: "Аудитория 4207", number: "4207", building: 4, floor: 2, place: "Компьютерный класс", seats: 20, equip: ["screen", "vks"] },
  { id: "a5301", kind: "class", name: "Аудитория 5301", number: "5301", building: 5, floor: 3, place: "Семинарская", seats: 28, equip: ["board"] },
];

export const EQUIP: Record<Equip, string> = { screen: "Экран", board: "Доска", vks: "Видеосвязь" };

export const roomById = (id: unknown) => (typeof id === "string" ? ROOMS.find((r) => r.id === id) : undefined);
export const roomPlace = (r: Room) => `Корпус ${r.building}, ${r.floor} этаж`;

/** Кампус открыт с 08:00 до 21:00; бронь — по 30 минут, от 30 минут до 2 часов, на неделю вперёд (кроме воскресенья). */
export const OPEN = 8 * 60;
export const CLOSE = 21 * 60;
export const STEP = 30;
export const DURATIONS = [30, 60, 90, 120] as const;
export const DAYS_AHEAD = 20; // три недели вперёд, включая сегодня
/** Дней в полосе на одной странице (как неделя Пн–Сб). */
export const DAYS_PER_PAGE = 6;
/** Отметка у двери: за 15 минут до начала и до 15 минут после. Не отметились — бронь снимается, комната свободна. */
export const CHECKIN_BEFORE = 15;
export const CHECKIN_AFTER = 15;
/** Сколько будущих броней может быть у одного человека. */
export const MAX_ACTIVE = 3;
export const TITLE_MAX = 60;

export const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
export const durationLabel = (m: number) => (m < 60 ? `${m} мин` : m % 60 ? `${Math.floor(m / 60)},5 ч` : `${m / 60} ч`);
