/** Каталог заявок «Офиса»: константа, общая для клиента (форма) и сервера (проверка). В БД хранится только id. */

export type RequestKind = "cert" | "app";

export interface RequestType {
  id: string;
  title: string;
  icon: string; // имя иконки lucide, сопоставляется на клиенте
  color: string; // токен цвета: amber | violet | teal | rose | sky | green | lilac | text-3
  kind: RequestKind;
  format: string; // «PDF с QR», «Заявление»
  eta: string; // «1 день»
  days: number;
  steps: readonly string[]; // этапы трекера
  /** Справка: куда */
  purposes?: readonly string[];
  langs?: readonly string[];
  formats?: readonly string[];
  /** Заявление: выбор из списка */
  subjectLabel?: string;
  subjects?: readonly string[];
  defaults: { purpose?: string; lang?: string; format?: string; subject?: string };
}

const CERT_STEPS = ["Подана", "Принята", "Готовится", "Готова"] as const;
const APP_STEPS = ["Подано", "Проверка", "Решение"] as const;
const PURPOSES = ["По месту требования", "Работодатель", "Банк", "Соцзащита"] as const;
const FORMATS = ["Электронная с QR", "Бумажная"] as const;
const LANGS = ["Русский", "Английский"] as const;

export const PAPER = "Бумажная";

export const REQUEST_TYPES: readonly RequestType[] = [
  { id: "study", title: "Справка об обучении", icon: "file-text", color: "violet", kind: "cert", format: "PDF с QR", eta: "1 день", days: 1, steps: CERT_STEPS, purposes: PURPOSES, langs: LANGS, formats: FORMATS, defaults: { purpose: "По месту требования", lang: "Русский", format: "Электронная с QR" } },
  { id: "visa", title: "Справка для визы", icon: "plane", color: "sky", kind: "cert", format: "На английском", eta: "2 дня", days: 2, steps: CERT_STEPS, purposes: ["Посольство", "Консульство", "Визовый центр"], langs: LANGS, formats: FORMATS, defaults: { purpose: "Посольство", lang: "Английский", format: "Электронная с QR" } },
  { id: "grades", title: "Выписка оценок", icon: "list-checks", color: "green", kind: "cert", format: "PDF с QR", eta: "1 день", days: 1, steps: CERT_STEPS, purposes: PURPOSES, langs: LANGS, formats: FORMATS, defaults: { purpose: "По месту требования", lang: "Русский", format: "Электронная с QR" } },
  { id: "army", title: "Справка в военкомат", icon: "shield", color: "teal", kind: "cert", format: "Бумажная", eta: "3 дня", days: 3, steps: CERT_STEPS, purposes: ["Военкомат"], langs: ["Русский"], formats: [PAPER], defaults: { purpose: "Военкомат", lang: "Русский", format: PAPER } },
  { id: "retake", title: "Пересдача", icon: "rotate-ccw", color: "amber", kind: "app", format: "Заявление", eta: "3 дня", days: 3, steps: APP_STEPS, subjectLabel: "Дисциплина", subjects: ["Микроэкономика", "Эконометрика", "Международное право"], defaults: { subject: "Микроэкономика" } },
  { id: "credit", title: "Перезачёт дисциплины", icon: "arrow-left-right", color: "lilac", kind: "app", format: "Заявление", eta: "5 дней", days: 5, steps: APP_STEPS, subjectLabel: "Что перезачесть", subjects: ["«Python для анализа данных» → «Информатика»", "«Statistics» → «Эконометрика»"], defaults: { subject: "«Python для анализа данных» → «Информатика»" } },
  { id: "dorm", title: "Общежитие", icon: "bed-double", color: "rose", kind: "app", format: "Заявление", eta: "7 дней", days: 7, steps: APP_STEPS, subjectLabel: "Заселение", subjects: ["С 1 декабря", "С 1 января", "С 1 февраля"], defaults: { subject: "С 1 декабря" } },
  { id: "leave", title: "Академический отпуск", icon: "pause", color: "text-3", kind: "app", format: "Заявление", eta: "10 дней", days: 10, steps: APP_STEPS, subjectLabel: "Срок", subjects: ["Семестр", "Учебный год"], defaults: { subject: "Семестр" } },
];

export const getType = (id: unknown): RequestType | undefined => (typeof id === "string" ? REQUEST_TYPES.find((t) => t.id === id) : undefined);

export const MAX_COMMENT = 500;
export const MAX_MESSAGE = 1000;
export const MAX_COPIES = 5;

export type CertParams = { purpose: string; lang: string; format: string; copies: number };
export type AppParams = { subject: string; comment: string };
export type RequestParams = CertParams | AppParams;

const isStr = (v: unknown): v is string => typeof v === "string";
const oneOf = (list: readonly string[] | undefined, v: unknown): v is string => isStr(v) && !!list && list.includes(v);

/** Проверка параметров по каталогу: только значения из белого списка, в результат попадают только известные поля. */
export function validateParams(type: RequestType, raw: unknown): { ok: true; params: RequestParams } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "Некорректные параметры" };
  const p = raw as Record<string, unknown>;
  if (type.kind === "cert") {
    if (!oneOf(type.purposes, p.purpose)) return { ok: false, error: "Некорректное значение «Куда»" };
    if (!oneOf(type.langs, p.lang)) return { ok: false, error: "Некорректный язык" };
    if (!oneOf(type.formats, p.format)) return { ok: false, error: "Некорректный формат" };
    const copies = p.copies;
    if (typeof copies !== "number" || !Number.isInteger(copies) || copies < 1 || copies > MAX_COPIES) return { ok: false, error: `Экземпляров от 1 до ${MAX_COPIES}` };
    return { ok: true, params: { purpose: p.purpose, lang: p.lang, format: p.format, copies: p.format === PAPER ? copies : 1 } };
  }
  if (!oneOf(type.subjects, p.subject)) return { ok: false, error: "Некорректный выбор" };
  const comment = p.comment == null ? "" : p.comment;
  if (!isStr(comment)) return { ok: false, error: "Некорректный комментарий" };
  if (comment.trim().length > MAX_COMMENT) return { ok: false, error: `Комментарий не длиннее ${MAX_COMMENT} символов` };
  return { ok: true, params: { subject: p.subject, comment: comment.trim() } };
}

/** Строка под названием в каталоге: «PDF с QR за 1 день», «Ответ за 3 дня». */
export const catalogLine = (t: RequestType) => (t.kind === "cert" ? `${t.format} за ${t.eta}` : `Ответ за ${t.eta}`);

/** Подзаголовок карточки заявки. */
export function paramsSubtitle(type: RequestType, params: unknown): string {
  const p = (params ?? {}) as Partial<CertParams & AppParams>;
  if (type.kind === "app") return p.subject ?? "";
  return `${p.format === PAPER ? "Бумажная" : "Электронная"} на ${p.lang === "Английский" ? "английском" : "русском"}`;
}

export const ACTIVE_STATUSES = ["sent", "work", "review"] as const;

export const STATUS_TAGS: Record<string, { label: string; color: string; icon: string }> = {
  sent: { label: "Подана", color: "var(--st-violet)", icon: "send" },
  work: { label: "В работе", color: "var(--st-blue)", icon: "loader-circle" },
  review: { label: "На рассмотрении", color: "var(--st-yellow)", icon: "scan-search" },
  waiting: { label: "Ждёт вас", color: "var(--st-orange)", icon: "paperclip" },
  ready: { label: "Готово", color: "var(--st-green)", icon: "circle-check" },
  done: { label: "Выдано", color: "var(--st-gray)", icon: "archive" },
  rejected: { label: "Отклонено", color: "var(--st-red)", icon: "circle-x" },
  withdrawn: { label: "Отозвана", color: "var(--st-gray)", icon: "undo-2" },
};

export const OFFICE = {
  name: "Учебный офис факультета международного бизнеса",
  address: "Корпус А, каб. 104, окно 3",
  hours: "Пн–Пт 10:00–18:00",
  email: "office.ib@future.edu",
};
