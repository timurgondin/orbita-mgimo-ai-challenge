"use server";

import { DEMO_DATE, DEMO_MINUTES, daysBetween, formatDayMonth, formatShortWeekday, toMinutes } from "@/lib/demo-clock";
import { REQUEST_TYPES, type RequestType } from "@/lib/office-catalog";
import { getStudent } from "@/server/data/shared";
import { getStudyData } from "@/server/data/study";
import { getTimeData } from "@/server/data/time";
import { getScheduleForToday, getSoon } from "@/server/data/today";
import type { Lesson } from "@/server/data/types";
import type { AssistantConsultation, AssistantLesson, AssistantReply } from "./types";

/**
 * Имитация ИИ-помощника. Вопрос разбирается по ключевым словам, ответ строится из данных
 * текущего пользователя (только из сессии). Действия (заявка, запись) помощник лишь предлагает —
 * выполняют их существующие серверные действия после подтверждения студентом.
 */

const MAX_TEXT = 300;
const CHIPS = ["Какая следующая пара?", "Мой средний балл", "Что сдать на неделе?", "Закажи справку об обучении", "Запиши на консультацию"];

const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е");
const has = (t: string, re: RegExp) => re.test(t);

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

const noon = (iso: string) => new Date(`${iso}T12:00:00+03:00`);
function dayLabel(iso: string) {
  const d = daysBetween(noon(DEMO_DATE), noon(iso));
  if (d === 0) return "Сегодня";
  if (d === 1) return "Завтра";
  return `${formatShortWeekday(iso)}, ${formatDayMonth(noon(iso))}`;
}

const place = (l: Lesson) => (l.place.number ? `${l.place.label} ${l.place.number}`.trim() : l.format === "online" ? "Онлайн" : "");
const toLesson = (l: Lesson, when: string, live = false): AssistantLesson => ({
  title: l.title,
  start: l.start,
  end: l.end,
  place: place(l),
  teacher: l.teacher,
  when,
  live,
});

// ---------- Намерения ----------

async function nextLesson(): Promise<AssistantReply> {
  const steps = [{ state: "searching", label: "Смотрю расписание" } as const];
  const s = await getScheduleForToday();
  if (!s) return noStudent();
  const now = s.today.find((l) => toMinutes(l.start) <= DEMO_MINUTES && DEMO_MINUTES < toMinutes(l.end));
  const next = s.today.find((l) => toMinutes(l.start) > DEMO_MINUTES);
  const items: AssistantLesson[] = [];
  if (now) items.push(toLesson(now, "Сейчас", true));
  if (next) items.push(toLesson(next, "Дальше"));
  if (!items.length && s.tomorrow) items.push(toLesson(s.tomorrow, "Завтра"));
  if (!items.length) return { steps, text: "Сегодня и завтра пар больше нет.", chips: ["Что сдать на неделе?"] };

  let text: string;
  if (next) {
    const wait = toMinutes(next.start) - DEMO_MINUTES;
    const where = place(next);
    text = `Следующая — «${next.title}» в ${next.start}${where ? `, ${where}` : ""}.`;
    text += now ? ` Сейчас идёт «${now.title}», до конца ${toMinutes(now.end) - DEMO_MINUTES} мин.` : wait <= 60 ? ` Начало через ${wait} мин.` : "";
  } else if (now) {
    text = `Сейчас идёт «${now.title}», она последняя на сегодня.`;
  } else {
    text = `Сегодня пар больше нет. Завтра первая — «${s.tomorrow!.title}» в ${s.tomorrow!.start}.`;
  }
  return { steps, text, card: { kind: "lessons", items }, chips: ["Что сдать на неделе?", "Мой средний балл"] };
}

async function grades(): Promise<AssistantReply> {
  const steps = [
    { state: "searching", label: "Смотрю оценки" },
    { state: "solving", label: "Считаю средний балл" },
  ] as const;
  const d = await getStudyData();
  if (!d) return noStudent();
  const { perf } = d;
  const rows = perf.rows.filter((r) => !r.valueMuted).sort((a, b) => b.fill - a.fill);
  let text = `Средний балл за семестр — ${perf.average} из 10, взвешен по кредитам.`;
  if (perf.rank && perf.size) text += ` Это ${perf.rank}-е место из ${perf.size} на потоке.`;
  if (rows.length > 1) text += ` Лучший результат — «${rows[0].title}», слабее всего — «${rows[rows.length - 1].title}».`;
  return {
    steps: [...steps],
    text,
    card: { kind: "grades", average: perf.average, rank: perf.rank, size: perf.size, rows: perf.rows.slice(0, 5).map(({ id, title, color, value, fill }) => ({ id, title, color, value, fill })) },
    chips: ["Что сдать на неделе?", "Запиши на консультацию"],
  };
}

async function tasks(): Promise<AssistantReply> {
  const steps = [{ state: "searching", label: "Смотрю задания" } as const];
  const user = await getStudent();
  if (!user) return noStudent();
  const items = await getSoon();
  if (!items.length) return { steps, text: "На ближайшие пять дней сдавать нечего.", chips: ["Мой средний балл"] };
  const hot = items.filter((i) => i.today);
  let text = `Ближайшие пять дней — ${items.length} ${plural(items.length, "работа", "работы", "работ")}.`;
  text += hot.length ? ` Сегодня срок у «${hot[0].title}».` : ` Первая — «${items[0].title}», срок ${items[0].due.toLowerCase()}.`;
  return {
    steps,
    text,
    card: { kind: "tasks", items: items.map((i) => ({ id: i.id, title: i.title, course: i.course, color: i.color, due: i.due, hot: i.today, note: i.note })) },
    chips: ["Запиши на консультацию", "Какая следующая пара?"],
  };
}

function pickRequestType(t: string): RequestType {
  const id = has(t, /военкомат|арми|отсрочк/) ? "army" : has(t, /виз|посольств|консульств/) ? "visa" : has(t, /выписк|оценк|успеваем/) ? "grades" : "study";
  return REQUEST_TYPES.find((r) => r.id === id)!;
}

async function request(t: string): Promise<AssistantReply> {
  const user = await getStudent();
  if (!user) return noStudent();
  const type = pickRequestType(t);
  const lang = has(t, /англ|english/) && type.langs?.includes("Английский") ? "Английский" : type.defaults.lang!;
  const format = has(t, /бумаж|печат|распечат/) && type.formats?.includes("Бумажная") ? "Бумажная" : type.defaults.format!;
  return {
    steps: [
      { state: "searching", label: "Ищу нужную справку" },
      { state: "working", label: "Заполняю заявку" },
    ],
    text: "Заявку подготовил, данные взял из профиля. Проверьте и подтвердите — отправлю в учебный офис.",
    card: { kind: "request", typeId: type.id, title: type.title, eta: type.eta, params: { purpose: type.defaults.purpose!, lang, format, copies: 1 } },
  };
}

async function consultations(t: string): Promise<AssistantReply> {
  const steps = [
    { state: "searching", label: "Ищу консультации" },
    { state: "connecting", label: "Сверяю с расписанием" },
  ] as const;
  const d = await getTimeData();
  if (!d) return noStudent();
  const open = d.consultations.filter((c) => !c.past && !c.going && c.count < c.capacity && c.date >= DEMO_DATE && !(c.date === DEMO_DATE && toMinutes(c.start) <= DEMO_MINUTES));
  // «к Петровой», «по микроэкономике» — фильтр по фамилии или курсу
  const words = t.split(/[^a-zа-я]+/).filter((w) => w.length >= 4);
  const stem = (w: string) => w.slice(0, Math.max(4, w.length - 2));
  const matched = open.filter((c) => words.some((w) => norm(c.teacher).includes(stem(w)) || norm(c.courseTitle).includes(stem(w))));
  const list = (matched.length ? matched : open).sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start)).slice(0, 3);
  if (!list.length) return { steps: [...steps], text: "Свободных мест на ближайших консультациях нет.", chips: ["Что сдать на неделе?"] };
  const items: AssistantConsultation[] = list.map((c) => ({
    id: c.id,
    day: dayLabel(c.date),
    start: c.start,
    end: c.end,
    teacher: c.teacher,
    teacherInitials: c.teacherInitials,
    teacherGradient: c.teacherGradient,
    courseTitle: c.courseTitle,
    color: c.color,
    place: c.place,
    online: c.online,
    count: c.count,
    capacity: c.capacity,
  }));
  const text = matched.length
    ? `Нашёл ${items.length} ${plural(items.length, "консультацию", "консультации", "консультаций")} со свободными местами. Выберите время — запишу.`
    : `Ближайшие консультации со свободными местами. Выберите время — запишу.`;
  return { steps: [...steps], text, card: { kind: "consultations", items } };
}

function greeting(): AssistantReply {
  return { steps: [{ state: "composing", label: "Думаю" }], text: "Привет! Знаю ваше расписание, оценки и сроки, могу заказать справку или записать на консультацию.", chips: CHIPS.slice(0, 4) };
}

function fallback(): AssistantReply {
  return {
    steps: [{ state: "searching", label: "Ищу ответ" }],
    text: "Пока не знаю, как с этим помочь. Вот что умею уже сейчас:",
    chips: CHIPS,
  };
}

function noStudent(): AssistantReply {
  return { steps: [{ state: "searching", label: "Ищу ответ" }], text: "Пока помогаю только студентам. Для сотрудников — скоро." };
}

export async function askAssistant(raw: unknown): Promise<AssistantReply> {
  if (typeof raw !== "string") return fallback();
  const t = norm(raw.trim().slice(0, MAX_TEXT));
  if (!t) return fallback();
  if (has(t, /справк|выписк/)) return request(t);
  if (has(t, /консультац|запиш|записа/)) return consultations(t);
  if (has(t, /средн|балл|оценк|успеваем|рейтинг|gpa/)) return grades();
  if (has(t, /дедлайн|срок|сдать|сдава|задани|контрольн|домашк|эссе|долг/)) return tasks();
  if (has(t, /(?<![а-я])пар(а|ы|у|е|ой)?(?![а-я])|заняти|расписан|лекци|семинар|аудитор|куда идти|следующ/)) return nextLesson();
  if (has(t, /^(привет|здравств|добр|хай|hi|hello)/)) return greeting();
  return fallback();
}

