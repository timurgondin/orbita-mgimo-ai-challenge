import "server-only";
import { requireUser, type CurrentUser } from "@/server/auth/session";
import { db } from "@/server/db/client";

/** Личные данные для проверки: поля совпадают с пунктами заявки «Исправление личных данных» (lib/office-catalog). */
export function personalRows(u: CurrentUser): [string, string][] {
  return [
    ["ФИО", [u.lastName, u.firstName, u.middleName].filter(Boolean).join(" ")],
    ["Факультет", u.faculty ?? ""],
    ["Программа", u.program ?? ""],
    ["Курс и группа", [u.course ? `${u.course} курс` : null, u.groupName ? `группа ${u.groupName}` : null].filter(Boolean).join(", ")],
    ["Форма обучения", u.studyForm ?? ""],
    ["Зачётная книжка", u.recordBook ?? ""],
  ];
}

export interface FirstStepsView {
  steps: FirstStep[];
  rows: [string, string][];
  phone: string | null;
  telegram: string | null;
}

export interface FirstStep {
  id: "data" | "photo" | "contacts" | "medical" | "books";
  title: string;
  href: string;
  done: boolean;
}

/** «Первые шаги» первокурсника на «Сегодня»: всё считается по данным, отметок вручную нет. Всё сделано — блока нет. */
export async function getFirstSteps(): Promise<FirstStepsView | null> {
  const u = await requireUser();
  if (u.role !== "student" || u.course !== 1) return null;
  const [freshman, dataFix, readyBooks] = await Promise.all([
    db.officeRequest.findFirst({ where: { userId: u.id, typeId: "freshman" }, select: { number: true, docReceivedAt: true } }),
    db.officeRequest.count({ where: { userId: u.id, typeId: "data-fix" } }),
    db.bookOrder.count({ where: { userId: u.id, status: "ready", closedAt: null } }),
  ]);
  const steps: FirstStep[] = [
    { id: "data", title: "Подтвердить личные данные", href: "/profile", done: !!u.dataConfirmedAt || dataFix > 0 },
    { id: "photo", title: "Добавить фото для Орбита ID", href: "/profile", done: !!u.photoAt },
    { id: "contacts", title: "Указать телефон и Telegram", href: "/profile", done: !!u.phone && !!u.telegram },
  ];
  if (freshman) {
    steps.push({ id: "medical", title: "Загрузить медсправку 086/у", href: `/office?request=${freshman.number}`, done: !!freshman.docReceivedAt });
  }
  steps.push({ id: "books", title: "Забрать учебники из постамата", href: "/library", done: readyBooks === 0 });
  if (steps.every((s) => s.done)) return null;
  return { steps, rows: personalRows(u), phone: u.phone, telegram: u.telegram };
}
