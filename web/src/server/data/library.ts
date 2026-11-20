import "server-only";
import { DEMO_NOW, addDays, dayStart, daysBetween, formatDayMonth, mskDate, mskTime } from "@/lib/demo-clock";
import { ORDER_STEPS, PICKUP_POINTS, pointById, type PickupPoint } from "@/lib/library-points";
import { plural } from "@/lib/phrases";
import { db } from "@/server/db/client";
import { getStudent } from "./shared";
import type { BookCard, CatalogBook, HistoryItem, LibraryData, LoanView, OrderView, ReaderData } from "./types";

const DAY = 86_400_000;
export const MAX_RENEWALS = 2;
export const RENEW_DAYS = 14;

type BookRow = { id: string; slug: string; title: string; author: string; year: number; color: string; pages: number; format: string; shelf: string; copies: number; available: number; publisher: string };

const card = (b: BookRow): BookCard => ({
  id: b.id,
  slug: b.slug,
  title: b.title,
  author: b.author,
  year: b.year,
  publisher: b.publisher,
  color: b.color,
  pages: b.pages,
  shelf: b.shelf,
  print: b.format !== "ebook",
  ebook: b.format !== "print",
  copies: b.copies,
  available: b.available,
});

const days = (n: number) => `${n} ${plural(n, "день", "дня", "дней")}`;
const shortDate = (d: Date) => new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", timeZone: "Europe/Moscow" }).format(d).replace(".", "");

/** «сегодня к 15:00», «завтра к 12:00», «24 ноября к 12:00» */
export function etaPhrase(d: Date): string {
  const n = daysBetween(DEMO_NOW, d);
  const day = n === 0 ? "сегодня" : n === 1 ? "завтра" : formatDayMonth(d);
  return `${day} к ${mskTime(d)}`;
}

/** Когда заказ будет в пункте: станция в здании библиотеки — через три часа (до часа вверх), постамат — завтра к 12:00. */
export function readyAtFor(p: PickupPoint, from = DEMO_NOW): Date {
  if (p.delivery === "hours") {
    const t = new Date(from.getTime() + 3 * 3_600_000);
    t.setUTCMinutes(0, 0, 0);
    return new Date(t.getTime() + 3_600_000);
  }
  return new Date(dayStart(addDays(mskDate(from), 1)).getTime() + 12 * 3_600_000);
}

/** Можно ли продлить: только короткая выдача, не больше двух раз, и если на книгу нет очереди (все экземпляры на руках). */
export function renewState(l: { kind: string; renewals: number; returnedAt: Date | null }, b: { available: number }): { ok: boolean; note: string } {
  if (l.returnedAt) return { ok: false, note: "Книга сдана" };
  if (l.kind !== "short") return { ok: false, note: "Учебник выдан на учебный год" };
  if (l.renewals >= MAX_RENEWALS) return { ok: false, note: "Продлили уже дважды — верните книгу" };
  if (b.available === 0) return { ok: false, note: "На книгу очередь — продлить нельзя" };
  return { ok: true, note: `Можно продлить ещё ${MAX_RENEWALS - l.renewals} ${plural(MAX_RENEWALS - l.renewals, "раз", "раза", "раз")}` };
}

type LoanRow = { id: string; kind: string; inventory: string; takenAt: Date; dueAt: Date; returnedAt: Date | null; renewals: number; book: BookRow };

function loanView(l: LoanRow): LoanView {
  const left = daysBetween(DEMO_NOW, l.dueAt);
  const span = Math.max(1, l.dueAt.getTime() - l.takenAt.getTime());
  const r = renewState(l, l.book);
  const due =
    left < 0 ? `Просрочена на ${days(-left)}` : left === 0 ? `Сегодня до ${mskTime(l.dueAt)}` : left === 1 ? `Завтра до ${mskTime(l.dueAt)}` : `До ${formatDayMonth(l.dueAt)}`;
  return {
    id: l.id,
    book: card(l.book),
    kind: l.kind === "semester" ? "semester" : "short",
    kindLabel: l.kind === "semester" ? "Учебник на учебный год" : "На две недели",
    inventory: l.inventory,
    due,
    hot: left <= 1,
    elapsed: Math.min(100, Math.max(0, Math.round(((DEMO_NOW.getTime() - l.takenAt.getTime()) / span) * 100))),
    canRenew: r.ok,
    renewNote: r.note,
    renewals: l.renewals,
  };
}

type OrderRow = { id: string; point: string; status: string; createdAt: Date; readyAt: Date; pickupBy: Date | null; cell: string | null; book: BookRow };

function orderView(o: OrderRow): OrderView {
  const p = pointById(o.point) ?? PICKUP_POINTS[0];
  const status = o.status as OrderView["status"];
  // у станции выдачи нет этапа «В пути»: она в здании книгохранилища
  const steps = ORDER_STEPS.filter((s) => !(p.kind === "station" && s.id === "transit"));
  const cur = steps.findIndex((s) => s.id === status);
  return {
    id: o.id,
    book: card(o.book),
    status,
    steps: steps.map((s, i) => ({
      label: s.label,
      state: i < cur ? "fin" : i === cur ? "cur" : "todo",
      when:
        s.id === "placed"
          ? shortDate(o.createdAt)
          : s.id === "ready"
            ? status === "ready" && o.pickupBy
              ? `до ${shortDate(o.pickupBy)}`
              : etaPhrase(o.readyAt).replace(" к ", ", ")
            : i === cur
              ? "сейчас"
              : "",
    })),
    point: { id: p.id, kind: p.kind, name: p.name, place: p.place, hours: p.hours },
    line: status === "ready" && o.pickupBy ? `Ячейка ${o.cell}, заберите до ${formatDayMonth(o.pickupBy)}` : `Привезём ${etaPhrase(o.readyAt)}`,
    cell: o.cell,
    canCancel: true,
  };
}

/** «Осень 2026» — по месяцу возврата */
function term(d: Date): string {
  const [y, m] = mskDate(d).split("-").map(Number);
  return `${m >= 9 ? "Осень" : m >= 7 ? "Лето" : "Весна"} ${y}`;
}

function historyItem(l: LoanRow): HistoryItem {
  const ret = l.returnedAt!;
  const sameMonth = mskDate(l.takenAt).slice(0, 7) === mskDate(ret).slice(0, 7);
  const from = sameMonth ? new Intl.DateTimeFormat("ru-RU", { day: "numeric", timeZone: "Europe/Moscow" }).format(l.takenAt) : formatDayMonth(l.takenAt);
  const late = daysBetween(l.dueAt, ret);
  return {
    id: l.id,
    book: card(l.book),
    span: `${from} – ${formatDayMonth(ret)}`,
    kept: days(Math.max(1, daysBetween(l.takenAt, ret))),
    late: ret > l.dueAt && late > 0 ? `на ${days(late)} позже` : null,
  };
}

/** Библиотека текущего студента: заказы, книги на руках, чтение, каталог (с книгами к курсам), история. Пользователь — из сессии. */
export async function getLibrary(): Promise<LibraryData | null> {
  const user = await getStudent();
  if (!user) return null;
  const [loans, orders, readings, enrolled, books, busy] = await Promise.all([
    db.loan.findMany({ where: { userId: user.id }, include: { book: true }, orderBy: { dueAt: "asc" } }),
    db.bookOrder.findMany({ where: { userId: user.id, closedAt: null }, include: { book: true }, orderBy: { createdAt: "desc" } }),
    db.reading.findMany({ where: { userId: user.id }, include: { book: true }, orderBy: { lastAt: "desc" } }),
    db.enrollment.findMany({ where: { userId: user.id, course: { format: "offline" } }, select: { course: { select: { slug: true, title: true, color: true } } }, orderBy: { order: "asc" } }),
    db.book.findMany({ orderBy: { title: "asc" } }),
    // когда освободится книга, у которой все экземпляры на руках: только ближайший срок, без того, у кого она
    db.loan.groupBy({ by: ["bookId"], where: { returnedAt: null, book: { available: 0 } }, _min: { dueAt: true } }),
  ]);
  const active = loans.filter((l) => !l.returnedAt);
  const returned = loans.filter((l) => l.returnedAt).sort((a, b) => b.returnedAt!.getTime() - a.returnedAt!.getTime());
  const mine = new Map<string, "loan" | "order">([...orders.map((o) => [o.bookId, "order"] as const), ...active.map((l) => [l.bookId, "loan"] as const)]);
  const readBook = new Set(readings.map((r) => r.bookId));
  const courseBy = new Map(enrolled.map((e) => [e.course.slug, { title: e.course.title, color: e.course.color }]));
  const backBy = new Map(busy.map((g) => [g.bookId, g._min.dueAt]));

  const catalog: CatalogBook[] = books.map((b) => {
    const back = backBy.get(b.id);
    return {
      ...card(b),
      about: b.about,
      course: (b.course && courseBy.get(b.course)) || null,
      mine: mine.get(b.id) ?? null,
      reading: readBook.has(b.id),
      back: b.format !== "ebook" && b.available === 0 && back ? `Вернут ${formatDayMonth(back)}` : null,
    };
  });
  const order = enrolled.map((e) => e.course.title);
  const courseBooks = catalog.filter((b) => b.course).sort((a, b) => order.indexOf(a.course!.title) - order.indexOf(b.course!.title));

  const groups = new Map<string, HistoryItem[]>();
  for (const l of returned) groups.set(term(l.returnedAt!), [...(groups.get(term(l.returnedAt!)) ?? []), historyItem(l)]);

  const yearAgo = new Date(DEMO_NOW.getTime() - 365 * DAY);
  const onTime = returned.filter((l) => l.returnedAt! <= l.dueAt).length;
  const shelfCount = new Map<string, number>();
  for (const b of books) shelfCount.set(b.shelf, (shelfCount.get(b.shelf) ?? 0) + 1);

  return {
    orders: orders.map(orderView),
    onHand: active.map(loanView),
    reading: readings.map((r) => ({
      book: card(r.book),
      page: r.page,
      percent: Math.round((r.page / r.book.pages) * 100),
      last: daysBetween(r.lastAt, DEMO_NOW) <= 0 ? "сегодня" : daysBetween(r.lastAt, DEMO_NOW) === 1 ? "вчера" : formatDayMonth(r.lastAt),
    })),
    courseBooks,
    catalog,
    shelves: [...shelfCount.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ru")).map(([s]) => s),
    points: PICKUP_POINTS.map((p) => ({ id: p.id, kind: p.kind, name: p.name, place: p.place, hours: p.hours, eta: etaPhrase(readyAtFor(p)) })),
    history: [...groups.entries()].map(([title, items]) => ({ title, items })),
    stats: {
      year: loans.filter((l) => l.takenAt >= yearAgo).length,
      pages: readings.reduce((s, r) => s + r.page, 0),
      onTime: returned.length ? `${onTime} из ${returned.length}` : null,
      days: returned.length ? Math.round(returned.reduce((s, l) => s + daysBetween(l.takenAt, l.returnedAt!), 0) / returned.length) : null,
    },
  };
}

// ---------- Читалка: текст вымышленный, собирается из шаблонов по разделу каталога ----------
const CHAPTERS: Record<string, string[]> = {
  Экономика: ["Спрос и предложение", "Эластичность", "Поведение потребителя", "Производство и издержки", "Конкуренция", "Монополия", "Олигополия", "Рынки факторов", "Провалы рынка", "Государство и рынок"],
  "Анализ данных": ["Данные и вопросы", "Описательная статистика", "Регрессия", "Проверка гипотез", "Диагностика модели", "Причинность", "Панельные данные", "Практикум"],
  "Мировая экономика": ["Торговля и специализация", "Цепочки поставок", "Тарифы и санкции", "Инвестиции", "Регионы", "Будущее торговли"],
  Право: ["Источники", "Договор", "Исполнение", "Ответственность", "Споры", "Практика"],
  История: ["Истоки", "Конгрессы и конференции", "Церемониал", "Кризисы", "Новый порядок", "Уроки"],
  "Международные отношения": ["Теории", "Государства и власть", "Институты", "Нормы", "Безопасность", "Многополярность"],
};
const PARAGRAPHS = [
  "В этой главе мы разбираем тему «{t}». Начнём с простого примера, к которому будем возвращаться до конца главы: он помогает увидеть, как общая идея работает на конкретных данных.",
  "Ключевое понятие здесь — то, как участники принимают решения при ограничениях. Если ограничение меняется, меняется и выбор; задача исследователя — понять направление и силу этого изменения.",
  "Обратите внимание на допущения. Почти любая модель опирается на упрощения, и полезно спрашивать себя, какие из них критичны для вывода, а без каких результат останется прежним.",
  "Исторически эта идея прошла долгий путь: от первых описательных работ к строгим моделям и эмпирическим проверкам. Современная литература спорит не столько о самом механизме, сколько о его масштабе.",
  "Практический вывод для читателя: прежде чем делать вывод по данным, проверьте, нет ли третьего фактора, который объясняет и причину, и следствие. Это самая частая ошибка в студенческих работах.",
  "Вопросы для самопроверки в конце главы помогут закрепить материал. Разбор решений — в приложении, но попробуйте сначала решить сами: так материал запоминается значительно лучше.",
];

export async function getReader(slug: string, pageParam?: string): Promise<ReaderData | null> {
  const user = await getStudent();
  if (!user || typeof slug !== "string" || slug.length > 60) return null;
  const book = await db.book.findUnique({ where: { slug } });
  if (!book || book.format === "print") return null;
  const saved = await db.reading.findUnique({ where: { userId_bookId: { userId: user.id, bookId: book.id } } });
  const want = Number(pageParam);
  const page = Number.isInteger(want) && want >= 1 && want <= book.pages ? want : (saved?.page ?? 1);
  const chapters = CHAPTERS[book.shelf] ?? ["Введение", "Основы", "Методы", "Практика", "Заключение"];
  const per = Math.ceil(book.pages / chapters.length);
  const ch = Math.min(chapters.length - 1, Math.floor((page - 1) / per));
  const first = (page - 1) % per === 0;
  const pick = (i: number) => PARAGRAPHS[(page * 7 + i * 2) % PARAGRAPHS.length].replace("{t}", chapters[ch].toLowerCase());
  return {
    book: card(book),
    page,
    pages: book.pages,
    chapter: `Глава ${ch + 1}. ${chapters[ch]}`,
    chapterStart: first,
    paragraphs: [pick(0), pick(1), pick(2)],
    toc: chapters.map((t, i) => ({ title: `Глава ${i + 1}. ${t}`, page: i * per + 1 })),
  };
}
