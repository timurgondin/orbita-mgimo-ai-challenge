export interface Lesson {
  id: string;
  /** ISO-дата, YYYY-MM-DD */
  date: string;
  start: string;
  end: string;
  title: string;
  /** Формат занятия: «Семинар», «Лекция»… */
  format?: string;
  place: { label: "ауд." | "каб."; number: string };
  teacher: string;
  note?: { kind: "flag" | "ok"; text: string };
}

export const schedule: Lesson[] = [
  {
    id: "micro-1119",
    date: "2026-11-19",
    start: "11:40",
    end: "13:10",
    title: "Микроэкономика",
    format: "Семинар",
    place: { label: "ауд.", number: "3108" },
    teacher: "Петрова Е. А.",
  },
  {
    id: "english-1119",
    date: "2026-11-19",
    start: "13:50",
    end: "15:20",
    title: "Английский язык",
    place: { label: "ауд.", number: "4105" },
    teacher: "Morgan K.",
    note: { kind: "flag", text: "Новая аудитория" },
  },
  {
    id: "econometrics-consult-1119",
    date: "2026-11-19",
    start: "15:30",
    end: "16:15",
    title: "Консультация по эконометрике",
    place: { label: "каб.", number: "518" },
    teacher: "Соколов Д. В.",
    note: { kind: "ok", text: "Записана" },
  },
  {
    id: "micro-1120",
    date: "2026-11-20",
    start: "09:30",
    end: "11:00",
    title: "Микроэкономика",
    format: "Лекция",
    place: { label: "ауд.", number: "2201" },
    teacher: "Петрова Е. А.",
  },
];
