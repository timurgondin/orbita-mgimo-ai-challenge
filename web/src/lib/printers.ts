/** Принтеры кампуса (вымышленные). Статус и очередь — снимок для демо; печать выпускается по Орбита ID на любом из них. */
export interface Printer {
  id: string;
  building: number; // корпус
  floor: number;
  place: string;
  color: boolean;
  a3: boolean;
  scan: boolean;
  status: "ready" | "busy" | "paper" | "offline";
  queue: number;
}

export const PRINTERS: Printer[] = [
  { id: "p-a1", building: 1, floor: 1, place: "Холл у гардероба", color: true, a3: true, scan: true, status: "ready", queue: 0 },
  { id: "p-a3", building: 1, floor: 3, place: "У читального зала", color: false, a3: false, scan: true, status: "busy", queue: 3 },
  { id: "p-b2", building: 2, floor: 2, place: "Коворкинг", color: true, a3: false, scan: true, status: "ready", queue: 1 },
  { id: "p-c1", building: 3, floor: 1, place: "У лифтов", color: false, a3: false, scan: true, status: "ready", queue: 0 },
  { id: "p-c4", building: 3, floor: 4, place: "Кафедра экономики, у каб. 518", color: false, a3: false, scan: false, status: "paper", queue: 0 },
  { id: "p-d1", building: 4, floor: 1, place: "Напротив ауд. 4105", color: true, a3: false, scan: true, status: "ready", queue: 0 },
  { id: "p-e1", building: 5, floor: 1, place: "Студенческое кафе", color: false, a3: false, scan: true, status: "offline", queue: 0 },
  { id: "p-lib", building: 1, floor: 2, place: "Библиотека, абонемент", color: true, a3: true, scan: true, status: "ready", queue: 2 },
];

export const printerById = (id: unknown) => (typeof id === "string" ? PRINTERS.find((p) => p.id === id) : undefined);
export const printerName = (p: Printer) => `Корпус ${p.building}, ${p.floor} этаж`;

/** Квота на месяц: чёрно-белые и цветные страницы. */
export const QUOTA = { bw: 200, color: 30 } as const;
export const MAX_COPIES = 10;
/** Сколько файл ждёт в очереди, пока не напечатают. */
export const HOLD_HOURS = 24;
