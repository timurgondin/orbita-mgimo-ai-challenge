/** Где забрать заказанную книгу: постаматы открываются по Орбита ID, станция — самообслуживание в библиотеке. Общая константа клиента и сервера. */
export interface PickupPoint {
  id: string;
  kind: "locker" | "station";
  name: string;
  place: string;
  hours: string;
  /** сколько везут из книгохранилища: станция в том же корпусе — пара часов, постамат — к полудню следующего дня */
  delivery: "hours" | "nextDay";
}

export const PICKUP_POINTS: PickupPoint[] = [
  { id: "locker-a", kind: "locker", name: "Постамат в корпусе А", place: "1 этаж, у гардероба", hours: "Круглосуточно", delivery: "nextDay" },
  { id: "locker-b", kind: "locker", name: "Постамат в корпусе Б", place: "Холл, рядом с кофейней", hours: "Круглосуточно", delivery: "nextDay" },
  { id: "locker-dorm", kind: "locker", name: "Постамат в общежитии", place: "Общежитие № 2, вестибюль", hours: "Круглосуточно", delivery: "nextDay" },
  { id: "station", kind: "station", name: "Станция выдачи", place: "Библиотека, корпус А, 3 этаж", hours: "С 8:00 до 22:00", delivery: "hours" },
];

export const pointById = (id: unknown) => (typeof id === "string" ? PICKUP_POINTS.find((p) => p.id === id) : undefined);

/** Этапы заказа — как у посылки. status в БД — id текущего этапа. */
export const ORDER_STEPS = [
  { id: "placed", label: "Оформлен" },
  { id: "packing", label: "Собираем" },
  { id: "transit", label: "В пути" },
  { id: "ready", label: "Ждёт вас" },
] as const;
export type OrderStatus = (typeof ORDER_STEPS)[number]["id"] | "picked" | "cancelled";

export const MAX_ORDERS = 5;
/** Сколько дней книга ждёт в ячейке */
export const PICKUP_DAYS = 3;
