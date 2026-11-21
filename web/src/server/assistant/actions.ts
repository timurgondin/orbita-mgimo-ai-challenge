"use server";

import { DEMO_DATE, DEMO_MINUTES, addDays, daysBetween, formatDayMonth, formatShortWeekday, toMinutes } from "@/lib/demo-clock";
import { REQUEST_TYPES, type RequestType } from "@/lib/office-catalog";
import { findByName, groupRoles, weekOf } from "@/server/data/directory";
import { emailOf, getStudent } from "@/server/data/shared";
import { getStudyData } from "@/server/data/study";
import { getTimeData } from "@/server/data/time";
import { getScheduleForToday, getSoon } from "@/server/data/today";
import type { Lesson, PersonHit } from "@/server/data/types";
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

// служебные слова запроса о человеке: остаток — ФИО
const PEOPLE_STOP = new Set(
  ("найди найти найдите поищи покажи открой кто такой такая такие где учится учатся есть ли мне меня мой моя моё мое мои моего моей наш наша нашей нашего " +
    "пожалуйста плиз дай скинь скажи подскажи какие какая какой какое что там когда " +
    "студент студентка студента студентку студентов однокурсник однокурсника однокурсницу одногруппник одногруппника одногруппницу " +
    "преподаватель преподавателя преподавательницу препод препода почта почту почты email мейл контакт контакты телеграм телеграмм telegram телефон " +
    "расписание расписания пары пара пар занятия занятий профиль карточку карточка группа группы группе " +
    "староста старосты старосту старостой куратор куратора куратору куратором " +
    "сегодня завтра послезавтра понедельник вторник среда среду четверг пятница пятницу суббота субботу воскресенье неделю неделе " +
    "из по у к с о об и а в во на это его ее её их").split(" "),
);
/** «расписание Матвея Жукова» → основы «матве», «жуко»: падеж не мешает найти по началу слова. */
const nameStems = (t: string) =>
  t
    .split(/[^a-zа-я-]+/)
    .filter((w) => w.length >= 3 && !PEOPLE_STOP.has(w))
    .map((w) => (w.length >= 5 ? w.slice(0, -2) : w));
/** «Жуков Матвей Петрович» → «Матвей Жуков» */
const firstLast = (name: string) => {
  const [last = "", first = ""] = name.split(" ");
  return `${first} ${last}`;
};

async function people(t: string): Promise<AssistantReply | null> {
  const stems = nameStems(t);
  if (!stems.length || stems.length > 3) return null;
  const items = await findByName(stems);
  if (!items.length) return null;
  const steps = [{ state: "searching", label: "Ищу в справочнике" } as const];
  if (items.length === 1) {
    const p = items[0];
    const login = p.kind === "student" ? p.href.slice("/people/".length) : null;
    const text = login
      ? `${p.name}: ${p.sub}${p.tag ? `, группа ${p.tag}` : ""}. Почта ${emailOf(login)}, расписание — в карточке.`
      : `${p.name}: ${p.sub}. Контакты и расписание — в карточке.`;
    return { steps: [...steps], text, card: { kind: "people", items } };
  }
  return { steps: [...steps], text: `Нашёл ${items.length} ${plural(items.length, "человека", "человек", "человек")}. Кого открыть?`, card: { kind: "people", items } };
}

const WEEKDAYS = ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"];
/** День из запроса: «на вторник», «в пятницу», «завтра»; по умолчанию — сегодня. */
function askedDay(t: string): string {
  if (has(t, /послезавтра/)) return addDays(DEMO_DATE, 2);
  if (has(t, /завтра/)) return addDays(DEMO_DATE, 1);
  const monday = addDays(DEMO_DATE, -((noon(DEMO_DATE).getUTCDay() + 6) % 7));
  const idx = [/понедельн/, /вторник/, /(?<![а-я])сред[аыуе]?(?![а-я])/, /четверг/, /пятниц/, /суббот/, /воскресен/].findIndex((re) => re.test(t));
  return idx >= 0 ? addDays(monday, idx) : DEMO_DATE;
}
const dayPhrase = (iso: string) => {
  const d = daysBetween(noon(DEMO_DATE), noon(iso));
  const name = WEEKDAYS[(noon(iso).getUTCDay() + 6) % 7];
  return d === 0 ? `сегодня, ${formatDayMonth(noon(iso))}` : d === 1 ? `завтра, ${formatDayMonth(noon(iso))}` : `${name}, ${formatDayMonth(noon(iso))}`;
};

/** «расписание Матвея Жукова на вторник», «пары Петровой завтра»: личное расписание человека на день. */
async function personSchedule(t: string): Promise<AssistantReply | null> {
  if (!has(t, /расписан|(?<![а-я])пар[аыу]?(?![а-я])|заняти/)) return null;
  const stems = nameStems(t);
  if (!stems.length || stems.length > 3) return null;
  const [p] = await findByName(stems, 1);
  if (!p) return null;
  const date = askedDay(t);
  const steps = [
    { state: "searching", label: "Ищу в справочнике" },
    { state: "connecting", label: "Смотрю расписание" },
  ] as const;
  const day = (await weekOf(p))?.find((d) => d.date === date);
  const who = firstLast(p.name);
  if (!day) return { steps: [...steps], text: `${who}: ${dayPhrase(date)} — пар нет.`, card: { kind: "people", items: [p] } };
  if (!day.items.length) return { steps: [...steps], text: `${who}: ${dayPhrase(date)} — пар нет.`, card: { kind: "people", items: [p] } };
  const n = day.items.length;
  const items: AssistantLesson[] = day.items.map((i) => ({
    title: i.title,
    start: i.start,
    end: i.end,
    place: `ауд. ${i.room}`,
    teacher: p.kind === "student" ? i.teacher : "",
    when: i.group && p.kind === "teacher" ? `${i.kind}, ${i.group}` : i.kind,
    live: false,
  }));
  return {
    steps: [...steps],
    text: `${who}: ${dayPhrase(date)} — ${n} ${plural(n, "пара", "пары", "пар")}, с ${day.items[0].start} до ${day.items[n - 1].end}.`,
    card: { kind: "lessons", items },
  };
}

const withoutEmail = ({ kind, href, name, initials, gradient, photo, sub, tag }: PersonHit): PersonHit => ({ kind, href, name, initials, gradient, photo, sub, tag });

/** «кто староста», «почта куратора», «кто куратор у Жукова» — своя группа или группа найденного студента. */
async function roles(t: string): Promise<AssistantReply | null> {
  const wantHead = has(t, /старост/);
  const wantCurator = has(t, /куратор/);
  if (!wantHead && !wantCurator) return null;
  const steps = [{ state: "searching", label: "Ищу в справочнике" } as const];
  const stems = nameStems(t);
  let login: string | null = null;
  if (stems.length) {
    const hit = (await findByName(stems, 5)).find((h) => h.kind === "student");
    if (hit) login = hit.href.slice("/people/".length);
  }
  const r = await groupRoles(login);
  if (!r) return login ? null : noStudent();
  const lines: string[] = [];
  const items: PersonHit[] = [];
  const subject = r.who ? `${r.who}, группа ${r.group ?? "—"}` : `Группа ${r.group ?? "—"}`;
  if (wantHead) {
    if (r.headman) {
      lines.push(`староста — ${firstLast(r.headman.name)}, ${r.headman.email}`);
      items.push(withoutEmail(r.headman));
    } else lines.push("старосту ещё не выбрали");
  }
  if (wantCurator) {
    if (r.curator) {
      lines.push(`куратор — ${firstLast(r.curator.name)}, ${r.curator.email}`);
      items.push(withoutEmail(r.curator));
    } else lines.push("куратора пока нет");
  }
  return {
    steps: [...steps],
    text: `${subject}: ${lines.join("; ")}.`,
    ...(items.length ? { card: { kind: "people" as const, items } } : {}),
  };
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
  // о людях: староста и куратор, расписание человека, «найди Беляеву» / «почта Жукова» (если остаток запроса — чьё-то ФИО)
  const person = (await roles(t)) ?? (await personSchedule(t)) ?? (await people(t));
  if (person) return person;
  if (has(t, /справк|выписк/)) return request(t);
  if (has(t, /консультац|запиш|записа/)) return consultations(t);
  if (has(t, /средн|балл|оценк|успеваем|рейтинг|gpa/)) return grades();
  if (has(t, /дедлайн|срок|сдать|сдава|задани|контрольн|домашк|эссе|долг/)) return tasks();
  if (has(t, /(?<![а-я])пар(а|ы|у|е|ой)?(?![а-я])|заняти|расписан|лекци|семинар|аудитор|куда идти|следующ/)) return nextLesson();
  if (has(t, /^(привет|здравств|добр|хай|hi|hello)/)) return greeting();
  return fallback();
}

