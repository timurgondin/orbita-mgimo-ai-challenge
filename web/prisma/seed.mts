import { PrismaClient } from "@prisma/client";
import { hashPassword, PEPPER_VERSION } from "../src/server/auth/password";

const db = new PrismaClient();
const PASSWORD = "orbita-demo";

const users = [
  { login: "a.vorontsova", role: "student", firstName: "Алиса", lastName: "Воронцова", faculty: "Факультет международного бизнеса", program: "Международный бизнес", course: 2, groupName: "МБ-24-1", avatar: "sand", onboardingDone: true },
  { login: "m.orlov", role: "student", firstName: "Максим", lastName: "Орлов", faculty: "Факультет международных отношений", program: "Мировая политика", course: 4, groupName: "МП-22-2", avatar: "mist", onboardingDone: true },
  { login: "n.lanskaya", role: "student", firstName: "Ника", lastName: "Ланская", faculty: "Факультет международного бизнеса", program: "Маркетинг", course: 1, groupName: "МК-26-1", avatar: "lilac", onboardingDone: false },
  { login: "e.petrova", role: "teacher", firstName: "Елена", middleName: "Андреевна", lastName: "Петрова", faculty: "Кафедра экономики", position: "Преподаватель", avatar: "peach", onboardingDone: true },
  { login: "office", role: "staff", firstName: "Ирина", lastName: "Смирнова", position: "Учебный офис", avatar: "stone", onboardingDone: true },
];


// ---------- Пользователи (хеши пересчитываются; логика прежняя) ----------
const stats: Record<string, { courseRank: number; courseSize: number; creditsEarned: number }> = {
  "a.vorontsova": { courseRank: 12, courseSize: 184, creditsEarned: 26 },
  "m.orlov": { courseRank: 31, courseSize: 142, creditsEarned: 24 },
  "n.lanskaya": { courseRank: 57, courseSize: 210, creditsEarned: 6 },
};
for (const u of users) {
  const passwordHash = await hashPassword(PASSWORD);
  const data = { ...u, passwordHash, pepperVersion: PEPPER_VERSION, ...(stats[u.login] ?? { courseRank: null, courseSize: null, creditsEarned: null }) };
  await db.user.upsert({ where: { login: u.login }, create: data, update: data });
}
const userId = async (login: string) => (await db.user.findUniqueOrThrow({ where: { login } })).id;

// ---------- Учёба: полная пересборка академических таблиц ----------
await db.notification.deleteMany();
await db.scheduleEvent.deleteMany();
await db.studentWork.deleteMany();
await db.onlineProgress.deleteMany();
await db.enrollment.deleteMany();
await db.gradeComponent.deleteMany();
await db.course.deleteMany();

const at = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00+03:00` : `${iso}:00+03:00`);

type Work = { s: string; score?: number; fb?: string; g?: string; sent?: string };
interface Comp {
  t: string;
  short?: string;
  sub?: string;
  kind: string;
  w: number;
  due?: string;
  room?: string;
  work: Work;
}
interface CourseDef {
  slug: string;
  title: string;
  color: string;
  assessment: "exam" | "credit";
  credits: number;
  kinds?: string;
  teacher: string;
  avatar: string;
  teacherLogin?: string;
  online?: { total: number; provider: string; done: number; next: string; minutes: number };
  comps?: Comp[];
}
interface Ev {
  course?: string;
  user?: string;
  kind: string;
  d: string;
  s: string;
  e: string;
  room: string;
  teacher?: string;
  title?: string;
  topic?: string;
  from?: string;
  comp?: string;
}
interface Note {
  kind: string;
  title: string;
  body: string;
  actor?: string;
  avatar?: string;
  at: string;
  read?: boolean;
}
interface Person {
  login: string;
  courses: CourseDef[];
  events: Ev[];
  notes: Note[];
}

const ALISA: Person = {
  login: "a.vorontsova",
  courses: [
    {
      slug: "micro-24", title: "Микроэкономика", color: "micro", assessment: "exam", credits: 6, kinds: "Семинар · лекция",
      teacher: "Петрова Е. А.", avatar: "peach", teacherLogin: "e.petrova",
      comps: [
        { t: "Контрольная №1", kind: "test", w: 20, due: "2026-11-10T11:00", work: { s: "graded", score: 8, g: "2026-11-10T16:00", fb: "Хорошо с графиками. В задаче 3 не учтены постоянные издержки." } },
        { t: "Работа на семинарах", kind: "participation", w: 20, work: { s: "graded", score: 8.2, g: "2026-11-14T12:00" } },
        { t: "Problem set 6", kind: "homework", w: 20, due: "2026-11-21T18:00", sub: "домашнее задание", work: { s: "submitted", sent: "2026-11-18T21:10" } },
        { t: "Экзамен", kind: "exam", w: 40, due: "2026-12-22T10:00", room: "101", work: { s: "upcoming" } },
      ],
    },
    {
      slug: "econometrics-24", title: "Эконометрика", color: "econ", assessment: "exam", credits: 6, kinds: "Лекция · консультации",
      teacher: "Соколов Д. В.", avatar: "sand",
      comps: [
        { t: "Работа на практикумах", kind: "participation", w: 20, work: { s: "graded", score: 7, g: "2026-11-12T12:00" } },
        { t: "Расчётные работы", kind: "participation", w: 20, work: { s: "reviewing" } },
        { t: "Лабораторные работы", kind: "participation", w: 20, work: { s: "graded", score: 7.8, g: "2026-11-13T12:00" } },
        { t: "Контрольная №2", kind: "test", w: 20, due: "2026-11-23T09:30", room: "1201", sub: "аудитория 1201", work: { s: "upcoming" } },
        { t: "Экзамен", kind: "exam", w: 20, due: "2026-12-25T10:00", room: "1201", work: { s: "upcoming" } },
      ],
    },
    {
      slug: "world-economy-24", title: "Мировая экономика", color: "world", assessment: "exam", credits: 4, kinds: "Семинар",
      teacher: "Ким А. С.", avatar: "lilac",
      comps: [
        { t: "Семинарские доклады", kind: "participation", w: 25, work: { s: "graded", score: 9, g: "2026-11-11T12:00" } },
        { t: "Эссе «Глобальные цепочки поставок»", short: "Эссе", kind: "essay", w: 15, due: "2026-11-19T23:59", sub: "15% оценки", work: { s: "draft" } },
        { t: "Практические задания", kind: "participation", w: 20, work: { s: "graded", score: 8.1, g: "2026-11-13T12:00" } },
        { t: "Экзамен", kind: "exam", w: 40, due: "2026-12-28T12:00", room: "2302", work: { s: "upcoming" } },
      ],
    },
    {
      slug: "english-b2", title: "Английский язык B2", color: "eng", assessment: "exam", credits: 3, kinds: "Практика",
      teacher: "Morgan K.", avatar: "mist",
      comps: [
        { t: "Essay: Remote work", kind: "essay", w: 30, due: "2026-11-06T23:59", work: { s: "graded", score: 9, g: "2026-11-06T18:00", fb: "Strong structure. Watch the articles." } },
        { t: "Speaking", kind: "participation", w: 30, work: { s: "graded", score: 9, g: "2026-11-12T12:00" } },
        { t: "Case study: Tesla in China", short: "Case study", kind: "essay", w: 10, due: "2026-11-22T23:59", sub: "письменная работа", work: { s: "reviewing", sent: "2026-11-18T22:00" } },
        { t: "Экзамен", kind: "exam", w: 30, due: "2027-01-13T09:30", room: "4105", work: { s: "upcoming" } },
      ],
    },
    {
      slug: "intl-law-24", title: "Международное право", color: "law", assessment: "exam", credits: 4, kinds: "Лекция · семинар",
      teacher: "Орлова М. И.", avatar: "stone",
      comps: [
        { t: "Тест по источникам права", kind: "test", w: 10, due: "2026-11-03T11:00", work: { s: "graded", score: 6, g: "2026-11-03T17:00" } },
        { t: "Коллоквиум", kind: "participation", w: 20, work: { s: "graded", score: 8.7, g: "2026-11-10T12:00" } },
        { t: "Анализ договора поставки", short: "Анализ договора", kind: "homework", w: 30, due: "2026-11-24T23:59", sub: "домашнее задание", work: { s: "in_progress" } },
        { t: "Экзамен", kind: "exam", w: 40, work: { s: "upcoming" } },
      ],
    },
    {
      slug: "diplomacy-history-24", title: "История дипломатии", color: "hist", assessment: "credit", credits: 3, kinds: "Семинар",
      teacher: "Белов Г. Н.", avatar: "sand",
      comps: [
        { t: "Работа на семинарах", kind: "participation", w: 25, work: { s: "graded", score: 8, g: "2026-11-12T12:00" } },
        { t: "Контрольные опросы", kind: "participation", w: 25, work: { s: "graded", score: 8, g: "2026-11-13T12:00" } },
        { t: "Доклад", kind: "project", w: 30, due: "2026-12-03T23:59", work: { s: "upcoming" } },
        { t: "Итоговое собеседование", kind: "exam", w: 20, work: { s: "upcoming" } },
      ],
    },
    { slug: "python-data", title: "Python для анализа данных", color: "py", assessment: "credit", credits: 0, teacher: "Цифровая кафедра", avatar: "sand",
      online: { total: 12, provider: "Цифровая кафедра", done: 6, next: "Урок 7 · pandas", minutes: 18 } },
    { slug: "academic-writing", title: "Академическое письмо", color: "econ", assessment: "credit", credits: 0, teacher: "Центр академического письма", avatar: "sand",
      online: { total: 8, provider: "Центр академического письма", done: 2, next: "Урок 3 · Аргумент", minutes: 12 } },
  ],
  events: [
    // Пн 16
    { course: "econometrics-24", kind: "lecture", d: "2026-11-16", s: "09:30", e: "11:00", room: "1201" },
    { course: "world-economy-24", kind: "seminar", d: "2026-11-16", s: "11:40", e: "13:10", room: "2302" },
    { course: "intl-law-24", kind: "lecture", d: "2026-11-16", s: "13:50", e: "15:20", room: "3301" },
    // Вт 17
    { course: "diplomacy-history-24", kind: "seminar", d: "2026-11-17", s: "11:40", e: "13:10", room: "3204" },
    { course: "english-b2", kind: "practice", d: "2026-11-17", s: "13:50", e: "15:20", room: "4105" },
    // Ср 18
    { course: "world-economy-24", kind: "lecture", d: "2026-11-18", s: "09:30", e: "11:00", room: "2302" },
    { course: "intl-law-24", kind: "seminar", d: "2026-11-18", s: "11:40", e: "13:10", room: "3301" },
    { course: "micro-24", kind: "seminar", d: "2026-11-18", s: "13:50", e: "15:20", room: "3108" },
    // Чт 19
    { course: "econometrics-24", kind: "lecture", d: "2026-11-19", s: "09:30", e: "11:00", room: "1201" },
    { course: "micro-24", kind: "seminar", d: "2026-11-19", s: "11:40", e: "13:10", room: "3108", topic: "Олигополия" },
    { course: "english-b2", kind: "practice", d: "2026-11-19", s: "13:50", e: "15:20", room: "4105", from: "2214" },
    { course: "econometrics-24", user: "a.vorontsova", kind: "consultation", d: "2026-11-19", s: "15:30", e: "16:15", room: "518", teacher: "Соколов Д. В.", title: "Консультация по эконометрике" },
    // Пт 20
    { course: "micro-24", kind: "lecture", d: "2026-11-20", s: "09:30", e: "11:00", room: "2201" },
    { course: "world-economy-24", kind: "seminar", d: "2026-11-20", s: "11:40", e: "13:10", room: "2302" },
    { course: "english-b2", kind: "practice", d: "2026-11-20", s: "13:50", e: "15:20", room: "4105" },
    // Сб 21
    { course: "diplomacy-history-24", kind: "seminar", d: "2026-11-21", s: "10:00", e: "11:30", room: "3204" },
    // Следующая неделя
    { course: "econometrics-24", kind: "test", d: "2026-11-23", s: "09:30", e: "11:00", room: "1201", title: "Контрольная №2", comp: "Контрольная №2" },
    { course: "micro-24", kind: "lecture", d: "2026-11-24", s: "09:30", e: "11:00", room: "2201" },
    { course: "intl-law-24", kind: "lecture", d: "2026-11-24", s: "13:50", e: "15:20", room: "3301" },
  ],
  notes: [
    { kind: "grade", title: "Контрольная №1 проверена", body: "Микроэкономика · **8 из 10** · «Хорошо с графиками»", actor: "Петрова Е. А.", avatar: "peach", at: "2026-11-19T10:05" },
    { kind: "document", title: "Справка об обучении готова", body: "PDF с QR-кодом уже в «Офисе»", at: "2026-11-18T15:00" },
    { kind: "announcement", title: "Открыта запись на элективы", body: "Учебный офис · до 30 ноября", at: "2026-11-17T11:00", read: true },
  ],
};

const MAXIM: Person = {
  login: "m.orlov",
  courses: [
    {
      slug: "ir-theory-22", title: "Теория международных отношений", color: "econ", assessment: "exam", credits: 5, kinds: "Лекция · семинар",
      teacher: "Громов В. П.", avatar: "mist",
      comps: [
        { t: "Коллоквиум 1", kind: "test", w: 20, due: "2026-11-09T11:00", work: { s: "graded", score: 7, g: "2026-11-09T18:00", fb: "Неплохо по реализму, слабее — неореализм и либерализм." } },
        { t: "Работа на семинарах", kind: "participation", w: 20, work: { s: "graded", score: 7.4, g: "2026-11-13T12:00" } },
        { t: "Эссе «Баланс сил в XXI веке»", short: "Эссе", kind: "essay", w: 20, due: "2026-11-26T23:59", sub: "письменная работа", work: { s: "in_progress" } },
        { t: "Экзамен", kind: "exam", w: 40, due: "2026-12-23T10:00", room: "5101", work: { s: "upcoming" } },
      ],
    },
    {
      slug: "russia-foreign-policy-22", title: "Внешняя политика России", color: "hist", assessment: "exam", credits: 4, kinds: "Лекция · семинар",
      teacher: "Зайцева Л. К.", avatar: "peach",
      comps: [
        { t: "Аналитическая записка", kind: "essay", w: 25, due: "2026-11-12T23:59", work: { s: "graded", score: 8.4, g: "2026-11-18T09:00", fb: "Сильная аргументация, добавьте больше первичных источников." } },
        { t: "Участие в семинарах", kind: "participation", w: 15, work: { s: "graded", score: 7.4, g: "2026-11-13T12:00" } },
        { t: "Доклад", kind: "project", w: 20, due: "2026-11-20T23:59", sub: "выступление на семинаре", work: { s: "submitted", sent: "2026-11-17T20:30" } },
        { t: "Экзамен", kind: "exam", w: 40, due: "2026-12-26T12:00", room: "5201", work: { s: "upcoming" } },
      ],
    },
    {
      slug: "conflictology-22", title: "Конфликтология", color: "world", assessment: "exam", credits: 4, kinds: "Семинар",
      teacher: "Рябов Н. Т.", avatar: "lilac",
      comps: [
        { t: "Кейс-анализ №1", kind: "homework", w: 20, due: "2026-11-04T23:59", work: { s: "graded", score: 7, g: "2026-11-09T12:00", fb: "Хорошая структура, мало сравнений между случаями." } },
        { t: "Тест 1", kind: "test", w: 20, due: "2026-11-11T11:40", work: { s: "graded", score: 8, g: "2026-11-11T17:00" } },
        { t: "Кейс-анализ №2", kind: "homework", w: 20, due: "2026-11-20T23:59", sub: "домашнее задание", work: { s: "draft" } },
        { t: "Экзамен", kind: "exam", w: 40, due: "2026-12-24T10:00", room: "5102", work: { s: "upcoming" } },
      ],
    },
    {
      slug: "intl-security-22", title: "Международная безопасность", color: "micro", assessment: "exam", credits: 3, kinds: "Лекция",
      teacher: "Фролов И. С.", avatar: "stone",
      comps: [
        { t: "Реферат", kind: "essay", w: 30, due: "2026-11-05T23:59", work: { s: "graded", score: 8, g: "2026-11-09T14:00", fb: "Чёткая постановка проблемы. Список литературы оформите по ГОСТу." } },
        { t: "Тест", kind: "test", w: 20, due: "2026-11-12T13:50", work: { s: "graded", score: 7.3, g: "2026-11-12T18:00" } },
        { t: "Практическая работа", kind: "project", w: 20, due: "2026-11-25T23:59", sub: "практическая работа", work: { s: "upcoming" } },
        { t: "Экзамен", kind: "exam", w: 30, due: "2026-12-29T10:00", room: "5301", work: { s: "upcoming" } },
      ],
    },
    {
      slug: "english-c1", title: "Английский язык C1", color: "eng", assessment: "credit", credits: 3, kinds: "Практика",
      teacher: "Hughes P.", avatar: "sand",
      comps: [
        { t: "Debate: climate policy", kind: "participation", w: 40, work: { s: "graded", score: 8, g: "2026-11-12T12:00" } },
        { t: "Policy brief", kind: "essay", w: 30, due: "2026-11-23T23:59", sub: "письменная работа", work: { s: "in_progress" } },
        { t: "Итоговое собеседование", kind: "exam", w: 30, work: { s: "upcoming" } },
      ],
    },
    { slug: "political-data", title: "Анализ данных в политологии", color: "py", assessment: "credit", credits: 0, teacher: "Школа политических данных", avatar: "sand",
      online: { total: 10, provider: "Школа политических данных", done: 4, next: "Урок 5 · Визуализация", minutes: 15 } },
  ],
  events: [
    { course: "russia-foreign-policy-22", kind: "lecture", d: "2026-11-16", s: "11:40", e: "13:10", room: "5201" },
    { course: "intl-security-22", kind: "lecture", d: "2026-11-16", s: "13:50", e: "15:20", room: "5301" },
    { course: "ir-theory-22", kind: "seminar", d: "2026-11-17", s: "09:30", e: "11:00", room: "5101" },
    { course: "english-c1", kind: "practice", d: "2026-11-17", s: "11:40", e: "13:10", room: "4207" },
    { course: "conflictology-22", kind: "seminar", d: "2026-11-18", s: "11:40", e: "13:10", room: "5102" },
    { course: "russia-foreign-policy-22", kind: "seminar", d: "2026-11-18", s: "13:50", e: "15:20", room: "5201" },
    { course: "ir-theory-22", kind: "lecture", d: "2026-11-19", s: "09:30", e: "11:00", room: "5101" },
    { course: "conflictology-22", kind: "seminar", d: "2026-11-19", s: "13:50", e: "15:20", room: "5102", from: "5008", topic: "Посредничество в конфликтах" },
    { course: "english-c1", kind: "practice", d: "2026-11-19", s: "15:30", e: "17:00", room: "4207" },
    { course: "intl-security-22", user: "m.orlov", kind: "consultation", d: "2026-11-19", s: "17:10", e: "17:50", room: "412", teacher: "Фролов И. С.", title: "Консультация по реферату" },
    { course: "russia-foreign-policy-22", kind: "seminar", d: "2026-11-20", s: "11:40", e: "13:10", room: "5201" },
    { course: "intl-security-22", kind: "lecture", d: "2026-11-20", s: "13:50", e: "15:20", room: "5301" },
    { course: "ir-theory-22", kind: "lecture", d: "2026-11-23", s: "09:30", e: "11:00", room: "5101" },
    { course: "conflictology-22", kind: "seminar", d: "2026-11-24", s: "11:40", e: "13:10", room: "5102" },
  ],
  notes: [
    { kind: "grade", title: "Аналитическая записка проверена", body: "Внешняя политика России · **8,4 из 10** · «Сильная аргументация»", actor: "Зайцева Л. К.", avatar: "peach", at: "2026-11-19T09:12" },
    { kind: "schedule", title: "Конфликтология: новая аудитория", body: "Четверг · **ауд. 5102** вместо 5008", at: "2026-11-18T18:40" },
    { kind: "announcement", title: "Открыта запись на элективы", body: "Учебный офис · до 30 ноября", at: "2026-11-17T11:00", read: true },
  ],
};

const NIKA: Person = {
  login: "n.lanskaya",
  courses: [
    {
      slug: "marketing-intro-26", title: "Введение в маркетинг", color: "micro", assessment: "exam", credits: 4, kinds: "Лекция · семинар",
      teacher: "Лебедева Т. Р.", avatar: "peach",
      comps: [
        { t: "Тест 1", kind: "test", w: 20, due: "2026-11-12T11:40", work: { s: "graded", score: 8.5, g: "2026-11-12T16:00", fb: "Отличный старт. Повторите сегментирование." } },
        { t: "Мини-кейс", kind: "homework", w: 20, due: "2026-11-22T23:59", sub: "домашнее задание", work: { s: "in_progress" } },
        { t: "Экзамен", kind: "exam", w: 60, due: "2027-01-15T10:00", room: "1105", work: { s: "upcoming" } },
      ],
    },
    {
      slug: "economics-basics-26", title: "Основы экономики", color: "econ", assessment: "exam", credits: 4, kinds: "Лекция",
      teacher: "Дроздов А. М.", avatar: "mist",
      comps: [
        { t: "Домашнее задание 2", kind: "homework", w: 20, due: "2026-11-20T23:59", sub: "домашнее задание", work: { s: "draft" } },
        { t: "Экзамен", kind: "exam", w: 80, due: "2027-01-18T10:00", room: "1201", work: { s: "upcoming" } },
      ],
    },
    {
      slug: "english-b1", title: "Английский язык B1", color: "eng", assessment: "credit", credits: 2, kinds: "Практика",
      teacher: "Walker J.", avatar: "sand",
      comps: [
        { t: "Speaking", kind: "participation", w: 50, work: { s: "graded", score: 8, g: "2026-11-13T12:00" } },
        { t: "Final test", kind: "exam", w: 50, work: { s: "upcoming" } },
      ],
    },
  ],
  events: [
    { course: "marketing-intro-26", kind: "lecture", d: "2026-11-19", s: "11:40", e: "13:10", room: "1105" },
    { course: "english-b1", kind: "practice", d: "2026-11-19", s: "13:50", e: "15:20", room: "4102" },
    { course: "economics-basics-26", kind: "lecture", d: "2026-11-20", s: "11:40", e: "13:10", room: "1201" },
    { course: "marketing-intro-26", kind: "seminar", d: "2026-11-20", s: "13:50", e: "15:20", room: "1105" },
  ],
  notes: [
    { kind: "grade", title: "Тест 1 проверен", body: "Введение в маркетинг · **8,5 из 10**", actor: "Лебедева Т. Р.", avatar: "peach", at: "2026-11-12T16:05", read: true },
    { kind: "announcement", title: "Добро пожаловать в Орбиту", body: "Учебный офис · первый курс", at: "2026-11-16T09:00" },
  ],
};

for (const person of [ALISA, MAXIM, NIKA]) {
  const uid = await userId(person.login);
  const courseIds = new Map<string, string>();
  const compIds = new Map<string, string>(); // `${slug}|${title}`

  for (const [order, c] of person.courses.entries()) {
    const course = await db.course.create({
      data: {
        slug: c.slug, title: c.title, color: c.color, format: c.online ? "online" : "offline", assessment: c.assessment,
        credits: c.credits, kindsLabel: c.kinds ?? "", teacherName: c.teacher, teacherAvatar: c.avatar,
        teacherId: c.teacherLogin ? await userId(c.teacherLogin) : null,
        lessonsTotal: c.online?.total, providerName: c.online?.provider,
      },
    });
    courseIds.set(c.slug, course.id);
    await db.enrollment.create({ data: { userId: uid, courseId: course.id, order } });
    if (c.online) {
      await db.onlineProgress.create({
        data: { userId: uid, courseId: course.id, lessonsDone: c.online.done, nextLessonTitle: c.online.next, nextLessonMinutes: c.online.minutes },
      });
    }
    for (const [i, k] of (c.comps ?? []).entries()) {
      const comp = await db.gradeComponent.create({
        data: { courseId: course.id, title: k.t, shortTitle: k.short, subtitle: k.sub, kind: k.kind, weight: k.w, dueAt: k.due ? at(k.due) : null, room: k.room, order: i },
      });
      compIds.set(`${c.slug}|${k.t}`, comp.id);
      await db.studentWork.create({
        data: {
          userId: uid, componentId: comp.id, status: k.work.s, score: k.work.score, feedback: k.work.fb,
          feedbackAuthor: k.work.fb ? c.teacher : null, gradedAt: k.work.g ? at(k.work.g) : null, submittedAt: k.work.sent ? at(k.work.sent) : null,
        },
      });
    }
  }

  const teacherOf = (slug: string) => person.courses.find((c) => c.slug === slug)!.teacher;
  for (const e of person.events) {
    await db.scheduleEvent.create({
      data: {
        courseId: e.course ? courseIds.get(e.course) : null,
        userId: e.user ? uid : null,
        componentId: e.comp && e.course ? compIds.get(`${e.course}|${e.comp}`) : null,
        kind: e.kind, title: e.title, startsAt: at(`${e.d}T${e.s}`), endsAt: at(`${e.d}T${e.e}`), room: e.room,
        teacherName: e.teacher ?? teacherOf(e.course!), roomChangedFrom: e.from, topic: e.topic,
      },
    });
  }

  for (const n of person.notes) {
    await db.notification.create({
      data: { userId: uid, kind: n.kind, title: n.title, body: n.body, actorName: n.actor, actorAvatar: n.avatar, createdAt: at(n.at), readAt: n.read ? at(n.at) : null },
    });
  }
}

console.log(`Seeded ${users.length} users, ${await db.course.count()} courses, ${await db.gradeComponent.count()} components, ${await db.scheduleEvent.count()} events`);
await db.$disconnect();
