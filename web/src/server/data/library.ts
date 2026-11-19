import "server-only";
import { DEMO_NOW, daysBetween, formatDayMonth, mskTime } from "@/lib/demo-clock";
import { plural } from "@/lib/phrases";
import { db } from "@/server/db/client";
import { getStudent } from "./shared";
import type { BookCard, LibraryData, LoanView, ReaderData } from "./types";

const DAY = 86_400_000;
export const MAX_RENEWALS = 2;
export const RENEW_DAYS = 14;
export const MAX_HOLDS = 5;

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

/** Можно ли продлить: только короткая выдача, не больше двух раз, и если на книгу нет очереди (все экземпляры на руках). */
export function renewState(l: { kind: string; renewals: number; returnedAt: Date | null }, b: { available: number }): { ok: boolean; note: string } {
  if (l.returnedAt) return { ok: false, note: "Книга сдана" };
  if (l.kind !== "short") return { ok: false, note: "Учебник выдан на учебный год" };
  if (l.renewals >= MAX_RENEWALS) return { ok: false, note: "Продлили уже дважды — верните книгу" };
  if (b.available === 0) return { ok: false, note: "На книгу очередь — продлить нельзя" };
  return { ok: true, note: `Можно продлить ещё ${MAX_RENEWALS - l.renewals} ${plural(MAX_RENEWALS - l.renewals, "раз", "раза", "раз")}` };
}

function loanView(l: { id: string; kind: string; inventory: string; takenAt: Date; dueAt: Date; returnedAt: Date | null; renewals: number; book: BookRow }): LoanView {
  const left = daysBetween(DEMO_NOW, l.dueAt);
  const span = Math.max(1, l.dueAt.getTime() - l.takenAt.getTime());
  const r = renewState(l, l.book);
  const due =
    l.kind === "hold"
      ? `Забрать до ${formatDayMonth(l.dueAt)}`
      : left < 0
        ? `Просрочена на ${-left} ${plural(-left, "день", "дня", "дней")}`
        : left === 0
          ? `Сегодня до ${mskTime(l.dueAt)}`
          : left === 1
            ? `Завтра до ${mskTime(l.dueAt)}`
            : `До ${formatDayMonth(l.dueAt)}`;
  return {
    id: l.id,
    book: card(l.book),
    kind: l.kind as LoanView["kind"],
    kindLabel: l.kind === "semester" ? "Учебник на учебный год" : l.kind === "hold" ? "Бронь на абонементе" : "На две недели",
    inventory: l.inventory,
    due,
    hot: !l.returnedAt && left <= 1,
    elapsed: Math.min(100, Math.max(0, Math.round(((DEMO_NOW.getTime() - l.takenAt.getTime()) / span) * 100))),
    canRenew: r.ok,
    renewNote: r.note,
    renewals: l.renewals,
    taken: formatDayMonth(l.takenAt),
    returned: l.returnedAt ? formatDayMonth(l.returnedAt) : null,
    late: !!l.returnedAt && l.returnedAt > l.dueAt,
  };
}

/** Библиотека текущего студента: книги на руках, бронь, чтение, книги к курсам, история. Пользователь — из сессии. */
export async function getLibrary(): Promise<LibraryData | null> {
  const user = await getStudent();
  if (!user) return null;
  const [loans, readings, enrolled] = await Promise.all([
    db.loan.findMany({ where: { userId: user.id }, include: { book: true }, orderBy: { dueAt: "asc" } }),
    db.reading.findMany({ where: { userId: user.id }, include: { book: true }, orderBy: { lastAt: "desc" } }),
    db.enrollment.findMany({ where: { userId: user.id, course: { format: "offline" } }, select: { course: { select: { slug: true, title: true, color: true } } }, orderBy: { order: "asc" } }),
  ]);
  const active = loans.filter((l) => !l.returnedAt);
  const history = loans.filter((l) => l.returnedAt).sort((a, b) => b.returnedAt!.getTime() - a.returnedAt!.getTime());
  const books = await db.book.findMany({ where: { course: { in: enrolled.map((e) => e.course.slug) } }, orderBy: { title: "asc" } });
  const mineBook = new Map(active.map((l) => [l.bookId, l.kind === "hold" ? "hold" : "loan"] as const));
  const readBook = new Set(readings.map((r) => r.bookId));
  const yearAgo = new Date(DEMO_NOW.getTime() - 365 * DAY);
  const returned = history.length;
  const onTime = history.filter((l) => l.returnedAt! <= l.dueAt).length;

  return {
    onHand: active.filter((l) => l.kind !== "hold").map(loanView),
    holds: active.filter((l) => l.kind === "hold").map(loanView),
    reading: readings.map((r) => ({
      book: card(r.book),
      page: r.page,
      percent: Math.round((r.page / r.book.pages) * 100),
      last: daysBetween(r.lastAt, DEMO_NOW) <= 0 ? "сегодня" : daysBetween(r.lastAt, DEMO_NOW) === 1 ? "вчера" : formatDayMonth(r.lastAt),
    })),
    courses: enrolled
      .map((e) => ({
        title: e.course.title,
        color: e.course.color,
        books: books
          .filter((b) => b.course === e.course.slug)
          .map((b) => ({ ...card(b), mine: mineBook.get(b.id) ?? null, reading: readBook.has(b.id) })),
      }))
      .filter((c) => c.books.length),
    history: history.map(loanView),
    stats: {
      onHand: active.filter((l) => l.kind !== "hold").length,
      pages: readings.reduce((s, r) => s + r.page, 0),
      year: loans.filter((l) => l.takenAt >= yearAgo && l.kind !== "hold").length,
      onTime: returned ? `${onTime} из ${returned}` : null,
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
