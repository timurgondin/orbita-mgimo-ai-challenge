import { PrismaClient } from "@prisma/client";
import { hashPassword, PEPPER_VERSION } from "../src/server/auth/password";
import { BELLS } from "../src/lib/bells";
import { randomBytes } from "node:crypto";

const db = new PrismaClient();
const PASSWORD = "orbita-demo";

const users = [
  { login: "a.vorontsova", role: "student", firstName: "Алиса", middleName: "Сергеевна", lastName: "Воронцова", faculty: "Факультет международного бизнеса", program: "Международный бизнес", course: 2, groupName: "МБ-24-1", avatar: "sand", onboardingDone: true },
  { login: "m.orlov", role: "student", firstName: "Максим", middleName: "Андреевич", lastName: "Орлов", faculty: "Факультет международных отношений", program: "Мировая политика", course: 4, groupName: "МП-22-2", avatar: "mist", onboardingDone: true },
  { login: "n.lanskaya", role: "student", firstName: "Ника", middleName: "Игоревна", lastName: "Ланская", faculty: "Факультет международного бизнеса", program: "Маркетинг", course: 1, groupName: "МК-26-1", avatar: "lilac", onboardingDone: false },
  { login: "e.petrova", role: "teacher", firstName: "Елена", middleName: "Андреевна", lastName: "Петрова", faculty: "Кафедра экономики", position: "Преподаватель", avatar: "peach", onboardingDone: true },
  { login: "office", role: "staff", firstName: "Ирина", lastName: "Смирнова", position: "Учебный офис", avatar: "stone", onboardingDone: true },
];


// ---------- Пользователи (хеши пересчитываются; логика прежняя) ----------
const stats: Record<string, { courseRank: number; courseSize: number; creditsEarned: number }> = {
  "a.vorontsova": { courseRank: 12, courseSize: 184, creditsEarned: 26 },
  "m.orlov": { courseRank: 31, courseSize: 142, creditsEarned: 24 },
  "n.lanskaya": { courseRank: 57, courseSize: 210, creditsEarned: 6 },
};
// Профиль (вымышленные данные). Токен студенческого — новый при каждом сиде.
const profiles: Record<string, Record<string, unknown>> = {
  "a.vorontsova": { degree: "Бакалавриат", studyForm: "Очная, бюджет", admissionYear: 2025, graduationYear: 2029, recordBook: "25-МБ-0412", curatorName: "Петрова Елена Андреевна", headmanName: "Беляева Дарья", phone: "+7 900 000-12-34", telegram: "@alisa_vrn", cardNumber: "250412", cardValidUntil: new Date("2029-08-31T00:00:00+03:00") },
  "m.orlov": { degree: "Бакалавриат", studyForm: "Очная, контракт", admissionYear: 2023, graduationYear: 2027, recordBook: "23-МП-0178", curatorName: "Ким Андрей Сергеевич", headmanName: "Жуков Матвей", phone: "+7 900 000-56-78", telegram: "@orlov_m", cardNumber: "230178", cardValidUntil: new Date("2027-08-31T00:00:00+03:00") },
  "n.lanskaya": { degree: "Бакалавриат", studyForm: "Очная, бюджет", admissionYear: 2026, graduationYear: 2030, recordBook: "26-МК-0931", curatorName: "Петрова Елена Андреевна", headmanName: null, phone: null, telegram: null, cardNumber: "260931", cardValidUntil: new Date("2030-08-31T00:00:00+03:00") },
  "e.petrova": { phone: "+7 900 000-90-12", telegram: "@petrova_econ" },
};
for (const u of users) {
  const passwordHash = await hashPassword(PASSWORD);
  const prof = profiles[u.login] ?? {};
  const card = prof.cardNumber ? { cardToken: randomBytes(32).toString("base64url") } : { cardToken: null };
  const data = { ...u, ...prof, ...card, passwordHash, pepperVersion: PEPPER_VERSION, ...(stats[u.login] ?? { courseRank: null, courseSize: null, creditsEarned: null }) };
  await db.user.upsert({ where: { login: u.login }, create: data, update: data });
}
// Вымышленные однокурсники для счётчиков записи на консультации. Входа нет: пароль случайный и нигде не хранится.
const POOL = [
  ["Беляева", "Дарья"], ["Громова", "Алина"], ["Дьяков", "Артём"], ["Ермолаева", "Полина"], ["Жуков", "Матвей"], ["Захарова", "Вера"],
  ["Исаев", "Тимур"], ["Кузьмина", "София"], ["Лазарев", "Кирилл"], ["Мельникова", "Анна"], ["Назаров", "Глеб"], ["Осипова", "Мария"],
] as const;
const poolIds: string[] = [];
for (const [i, [lastName, firstName]] of POOL.entries()) {
  const data = {
    login: `seed.student${String(i + 1).padStart(2, "0")}`, passwordHash: await hashPassword(randomBytes(24).toString("base64url")), pepperVersion: PEPPER_VERSION, role: "student",
    firstName, lastName, faculty: "Факультет международного бизнеса", program: "Международный бизнес", course: 2, groupName: "МБ-24-2",
    avatar: ["sand", "mist", "lilac", "peach"][i % 4], onboardingDone: true,
  };
  poolIds.push((await db.user.upsert({ where: { login: data.login }, create: data, update: data })).id);
}
const userId = async (login: string) => (await db.user.findUniqueOrThrow({ where: { login } })).id;

// ---------- Учёба: полная пересборка академических таблиц ----------
await db.notification.deleteMany();
await db.consultationSignup.deleteMany();
await db.consultation.deleteMany();
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
  course: string;
  kind: string;
  d: string;
  p: number; // пара по сетке звонков
  room: string;
  title?: string;
  topic?: string;
  from?: string;
  comp?: string;
}
// Групповая консультация. others — сколько вымышленных студентов уже записано, qs — у скольких из них есть вопрос
interface ConsDef {
  course: string;
  d: string;
  p: number;
  place: string;
  online?: boolean;
  cap: number;
  others: number;
  qs: number;
  mine?: string; // вопрос владельца (если записан)
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
  cons: ConsDef[];
  notes: Note[];
}

const ALISA: Person = {
  login: "a.vorontsova",
  courses: [
    {
      slug: "micro-24", title: "Микроэкономика", color: "micro", assessment: "exam", credits: 6, kinds: "Лекции и семинары",
      teacher: "Петрова Е. А.", avatar: "peach", teacherLogin: "e.petrova",
      comps: [
        { t: "Контрольная №1", kind: "test", w: 20, due: "2026-11-10T11:00", work: { s: "graded", score: 8, g: "2026-11-10T16:00", fb: "Хорошо с графиками. В задаче 3 не учтены постоянные издержки." } },
        { t: "Работа на семинарах", kind: "participation", w: 20, work: { s: "graded", score: 8.2, g: "2026-11-14T12:00" } },
        { t: "Problem set 6", kind: "homework", w: 20, due: "2026-11-21T18:00", sub: "домашнее задание", work: { s: "submitted", sent: "2026-11-18T21:10" } },
        { t: "Экзамен", kind: "exam", w: 40, due: "2026-12-22T10:00", room: "101", work: { s: "upcoming" } },
      ],
    },
    {
      slug: "econometrics-24", title: "Эконометрика", color: "econ", assessment: "exam", credits: 6, kinds: "Лекции и консультации",
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
      slug: "world-economy-24", title: "Мировая экономика", color: "world", assessment: "exam", credits: 4, kinds: "Семинары",
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
      slug: "intl-law-24", title: "Международное право", color: "law", assessment: "exam", credits: 4, kinds: "Лекции и семинары",
      teacher: "Орлова М. И.", avatar: "mist",
      comps: [
        { t: "Тест по источникам права", kind: "test", w: 10, due: "2026-11-03T11:00", work: { s: "graded", score: 6, g: "2026-11-03T17:00" } },
        { t: "Коллоквиум", kind: "participation", w: 20, work: { s: "graded", score: 8.7, g: "2026-11-10T12:00" } },
        { t: "Анализ договора поставки", short: "Анализ договора", kind: "homework", w: 30, due: "2026-11-24T23:59", sub: "домашнее задание", work: { s: "in_progress" } },
        { t: "Экзамен", kind: "exam", w: 40, work: { s: "upcoming" } },
      ],
    },
    {
      slug: "diplomacy-history-24", title: "История дипломатии", color: "hist", assessment: "credit", credits: 3, kinds: "Семинары",
      teacher: "Белов Г. Н.", avatar: "sand",
      comps: [
        { t: "Работа на семинарах", kind: "participation", w: 25, work: { s: "graded", score: 8, g: "2026-11-12T12:00" } },
        { t: "Контрольные опросы", kind: "participation", w: 25, work: { s: "graded", score: 8, g: "2026-11-13T12:00" } },
        { t: "Доклад", kind: "project", w: 30, due: "2026-12-03T23:59", work: { s: "upcoming" } },
        { t: "Итоговое собеседование", kind: "exam", w: 20, work: { s: "upcoming" } },
      ],
    },
    { slug: "python-data", title: "Python для анализа данных", color: "py", assessment: "credit", credits: 0, teacher: "Цифровая кафедра", avatar: "sand",
      online: { total: 12, provider: "Цифровая кафедра", done: 6, next: "Pandas", minutes: 18 } },
    { slug: "academic-writing", title: "Академическое письмо", color: "econ", assessment: "credit", credits: 0, teacher: "Центр академического письма", avatar: "sand",
      online: { total: 8, provider: "Центр академического письма", done: 2, next: "Структура аргумента", minutes: 12 } },
  ],
  events: [
    // Пн 16
    { course: "econometrics-24", kind: "lecture", d: "2026-11-16", p: 2, room: "1201" },
    { course: "world-economy-24", kind: "seminar", d: "2026-11-16", p: 3, room: "2302" },
    { course: "english-b2", kind: "practice", d: "2026-11-16", p: 5, room: "2214" },
    // Вт 17
    { course: "intl-law-24", kind: "lecture", d: "2026-11-17", p: 2, room: "101" },
    { course: "micro-24", kind: "lecture", d: "2026-11-17", p: 3, room: "101" },
    { course: "diplomacy-history-24", kind: "seminar", d: "2026-11-17", p: 6, room: "3315" },
    // Ср 18
    { course: "intl-law-24", kind: "seminar", d: "2026-11-18", p: 3, room: "2410" },
    { course: "english-b2", kind: "practice", d: "2026-11-18", p: 5, room: "2214" },
    // Чт 19
    { course: "econometrics-24", kind: "lecture", d: "2026-11-19", p: 2, room: "1201" },
    { course: "micro-24", kind: "seminar", d: "2026-11-19", p: 3, room: "3108", topic: "Олигополия" },
    { course: "english-b2", kind: "practice", d: "2026-11-19", p: 5, room: "4105", from: "2214" },
    // Пт 20
    { course: "micro-24", kind: "lecture", d: "2026-11-20", p: 2, room: "101" },
    { course: "world-economy-24", kind: "seminar", d: "2026-11-20", p: 3, room: "2302" },
    // Сб 21
    { course: "english-b2", kind: "practice", d: "2026-11-21", p: 3, room: "4105" },
    // Следующая неделя
    { course: "econometrics-24", kind: "test", d: "2026-11-23", p: 2, room: "1201", title: "Контрольная №2", comp: "Контрольная №2" },
    { course: "world-economy-24", kind: "seminar", d: "2026-11-23", p: 3, room: "2302" },
    { course: "english-b2", kind: "practice", d: "2026-11-23", p: 5, room: "4105" },
    { course: "intl-law-24", kind: "lecture", d: "2026-11-24", p: 2, room: "101" },
    { course: "micro-24", kind: "lecture", d: "2026-11-24", p: 3, room: "101" },
    { course: "diplomacy-history-24", kind: "seminar", d: "2026-11-24", p: 6, room: "3315" },
    { course: "intl-law-24", kind: "seminar", d: "2026-11-25", p: 3, room: "2410" },
    { course: "english-b2", kind: "practice", d: "2026-11-25", p: 5, room: "4105" },
    { course: "econometrics-24", kind: "lecture", d: "2026-11-26", p: 2, room: "1201" },
    { course: "micro-24", kind: "seminar", d: "2026-11-26", p: 3, room: "3108" },
    { course: "micro-24", kind: "lecture", d: "2026-11-27", p: 2, room: "101" },
    { course: "world-economy-24", kind: "seminar", d: "2026-11-27", p: 3, room: "2302" },
  ],
  cons: [
    { course: "econometrics-24", d: "2026-11-19", p: 6, place: "Каб. 518", cap: 15, others: 6, qs: 4, mine: "Тест Уайта на гетероскедастичность" },
    { course: "english-b2", d: "2026-11-20", p: 5, place: "Ауд. 4105", cap: 15, others: 9, qs: 3 },
    { course: "world-economy-24", d: "2026-11-23", p: 7, place: "Ауд. 2302", cap: 12, others: 12, qs: 8 },
    { course: "micro-24", d: "2026-11-24", p: 1, place: "Онлайн", online: true, cap: 30, others: 4, qs: 2 },
    { course: "intl-law-24", d: "2026-11-25", p: 4, place: "Онлайн", online: true, cap: 25, others: 11, qs: 6 },
  ],
  notes: [
    { kind: "grade", title: "8 из 10 за контрольную по микроэкономике", body: "«Хорошо с графиками»", actor: "Петрова Е. А.", avatar: "peach", at: "2026-11-19T10:05" },
    { kind: "document", title: "Справка об обучении готова", body: "PDF с QR-кодом уже в «Офисе»", at: "2026-11-18T15:00" },
    { kind: "announcement", title: "Открыта запись на элективы", body: "Запись идёт до 30 ноября", at: "2026-11-17T11:00", read: true },
  ],
};

const MAXIM: Person = {
  login: "m.orlov",
  courses: [
    {
      slug: "ir-theory-22", title: "Теория международных отношений", color: "econ", assessment: "exam", credits: 5, kinds: "Лекции и семинары",
      teacher: "Громов В. П.", avatar: "mist",
      comps: [
        { t: "Коллоквиум 1", kind: "test", w: 20, due: "2026-11-09T11:00", work: { s: "graded", score: 7, g: "2026-11-09T18:00", fb: "Неплохо по реализму, слабее — неореализм и либерализм." } },
        { t: "Работа на семинарах", kind: "participation", w: 20, work: { s: "graded", score: 7.4, g: "2026-11-13T12:00" } },
        { t: "Эссе «Баланс сил в XXI веке»", short: "Эссе", kind: "essay", w: 20, due: "2026-11-26T23:59", sub: "письменная работа", work: { s: "in_progress" } },
        { t: "Экзамен", kind: "exam", w: 40, due: "2026-12-23T10:00", room: "5101", work: { s: "upcoming" } },
      ],
    },
    {
      slug: "russia-foreign-policy-22", title: "Внешняя политика России", color: "hist", assessment: "exam", credits: 4, kinds: "Лекции и семинары",
      teacher: "Зайцева Л. К.", avatar: "peach",
      comps: [
        { t: "Аналитическая записка", kind: "essay", w: 25, due: "2026-11-12T23:59", work: { s: "graded", score: 8.4, g: "2026-11-18T09:00", fb: "Сильная аргументация, добавьте больше первичных источников." } },
        { t: "Участие в семинарах", kind: "participation", w: 15, work: { s: "graded", score: 7.4, g: "2026-11-13T12:00" } },
        { t: "Доклад", kind: "project", w: 20, due: "2026-11-20T23:59", sub: "выступление на семинаре", work: { s: "submitted", sent: "2026-11-17T20:30" } },
        { t: "Экзамен", kind: "exam", w: 40, due: "2026-12-26T12:00", room: "5201", work: { s: "upcoming" } },
      ],
    },
    {
      slug: "conflictology-22", title: "Конфликтология", color: "world", assessment: "exam", credits: 4, kinds: "Семинары",
      teacher: "Рябов Н. Т.", avatar: "lilac",
      comps: [
        { t: "Кейс-анализ №1", kind: "homework", w: 20, due: "2026-11-04T23:59", work: { s: "graded", score: 7, g: "2026-11-09T12:00", fb: "Хорошая структура, мало сравнений между случаями." } },
        { t: "Тест 1", kind: "test", w: 20, due: "2026-11-11T11:40", work: { s: "graded", score: 8, g: "2026-11-11T17:00" } },
        { t: "Кейс-анализ №2", kind: "homework", w: 20, due: "2026-11-20T23:59", sub: "домашнее задание", work: { s: "draft" } },
        { t: "Экзамен", kind: "exam", w: 40, due: "2026-12-24T10:00", room: "5102", work: { s: "upcoming" } },
      ],
    },
    {
      slug: "intl-security-22", title: "Международная безопасность", color: "micro", assessment: "exam", credits: 3, kinds: "Лекции",
      teacher: "Фролов И. С.", avatar: "sand",
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
      online: { total: 10, provider: "Школа политических данных", done: 4, next: "Визуализация", minutes: 15 } },
  ],
  events: [
    { course: "russia-foreign-policy-22", kind: "lecture", d: "2026-11-16", p: 3, room: "5201" },
    { course: "intl-security-22", kind: "lecture", d: "2026-11-16", p: 4, room: "5301" },
    { course: "ir-theory-22", kind: "seminar", d: "2026-11-17", p: 2, room: "5101" },
    { course: "english-c1", kind: "practice", d: "2026-11-17", p: 3, room: "4207" },
    { course: "conflictology-22", kind: "seminar", d: "2026-11-18", p: 3, room: "5102" },
    { course: "russia-foreign-policy-22", kind: "seminar", d: "2026-11-18", p: 4, room: "5201" },
    { course: "ir-theory-22", kind: "lecture", d: "2026-11-19", p: 2, room: "5101" },
    { course: "conflictology-22", kind: "seminar", d: "2026-11-19", p: 4, room: "5102", from: "5008", topic: "Посредничество в конфликтах" },
    { course: "english-c1", kind: "practice", d: "2026-11-19", p: 5, room: "4207" },
    { course: "russia-foreign-policy-22", kind: "seminar", d: "2026-11-20", p: 3, room: "5201" },
    { course: "intl-security-22", kind: "lecture", d: "2026-11-20", p: 4, room: "5301" },
    { course: "ir-theory-22", kind: "lecture", d: "2026-11-23", p: 2, room: "5101" },
    { course: "conflictology-22", kind: "seminar", d: "2026-11-24", p: 3, room: "5102" },
  ],
  cons: [
    { course: "intl-security-22", d: "2026-11-19", p: 7, place: "Каб. 412", cap: 20, others: 6, qs: 3, mine: "Оформление списка литературы по ГОСТу" },
    { course: "russia-foreign-policy-22", d: "2026-11-20", p: 5, place: "Онлайн", online: true, cap: 20, others: 3, qs: 1, mine: "Какие первичные источники брать для доклада" },
    { course: "ir-theory-22", d: "2026-11-24", p: 4, place: "Ауд. 5101", cap: 15, others: 5, qs: 2 },
  ],
  notes: [
    { kind: "grade", title: "8,4 из 10 за записку по внешней политике", body: "«Сильная аргументация»", actor: "Зайцева Л. К.", avatar: "peach", at: "2026-11-19T09:12" },
    { kind: "schedule", title: "Конфликтология переехала", body: "В четверг в **ауд. 5102** вместо 5008", at: "2026-11-18T18:40" },
    { kind: "announcement", title: "Открыта запись на элективы", body: "Запись идёт до 30 ноября", at: "2026-11-17T11:00", read: true },
  ],
};

const NIKA: Person = {
  login: "n.lanskaya",
  courses: [
    {
      slug: "marketing-intro-26", title: "Введение в маркетинг", color: "micro", assessment: "exam", credits: 4, kinds: "Лекции и семинары",
      teacher: "Лебедева Т. Р.", avatar: "peach",
      comps: [
        { t: "Тест 1", kind: "test", w: 20, due: "2026-11-12T11:40", work: { s: "graded", score: 8.5, g: "2026-11-12T16:00", fb: "Отличный старт. Повторите сегментирование." } },
        { t: "Мини-кейс", kind: "homework", w: 20, due: "2026-11-22T23:59", sub: "домашнее задание", work: { s: "in_progress" } },
        { t: "Экзамен", kind: "exam", w: 60, due: "2027-01-15T10:00", room: "1105", work: { s: "upcoming" } },
      ],
    },
    {
      slug: "economics-basics-26", title: "Основы экономики", color: "econ", assessment: "exam", credits: 4, kinds: "Лекции",
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
    { course: "marketing-intro-26", kind: "lecture", d: "2026-11-19", p: 3, room: "1105" },
    { course: "english-b1", kind: "practice", d: "2026-11-19", p: 4, room: "4102" },
    { course: "economics-basics-26", kind: "lecture", d: "2026-11-20", p: 3, room: "1201" },
    { course: "marketing-intro-26", kind: "seminar", d: "2026-11-20", p: 4, room: "1105" },
  ],
  cons: [
    { course: "marketing-intro-26", d: "2026-11-23", p: 3, place: "Ауд. 1105", cap: 15, others: 4, qs: 1 },
  ],
  notes: [
    { kind: "grade", title: "8,5 из 10 за тест по маркетингу", body: "«Уверенно, так держать»", actor: "Лебедева Т. Р.", avatar: "peach", at: "2026-11-12T16:05", read: true },
    { kind: "announcement", title: "Добро пожаловать в Орбиту", body: "Письмо от учебного офиса", at: "2026-11-16T09:00" },
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

  const courseOf = (slug: string) => person.courses.find((c) => c.slug === slug)!;
  for (const e of person.events) {
    const [from, to] = BELLS[e.p];
    await db.scheduleEvent.create({
      data: {
        courseId: courseIds.get(e.course),
        componentId: e.comp ? compIds.get(`${e.course}|${e.comp}`) : null,
        kind: e.kind, title: e.title, pair: e.p, startsAt: at(`${e.d}T${from}`), endsAt: at(`${e.d}T${to}`), room: e.room,
        teacherName: courseOf(e.course).teacher, roomChangedFrom: e.from, topic: e.topic,
      },
    });
  }

  const QUESTIONS = [
    "Разобрать задачу из домашнего задания", "Не понял вывод формулы с лекции", "Как готовиться к экзамену", "Критерии оценки итоговой работы",
    "Пример решения типовой задачи", "Какие источники использовать", "Где найти ошибку в расчётах", "Можно ли пересдать контрольную",
  ];
  for (const [ci, c] of person.cons.entries()) {
    const course = courseOf(c.course);
    const [from, to] = BELLS[c.p];
    const cons = await db.consultation.create({
      data: {
        courseId: courseIds.get(c.course)!, teacherName: course.teacher,
        teacherId: course.teacherLogin ? await userId(course.teacherLogin) : null,
        startsAt: at(`${c.d}T${from}`), endsAt: at(`${c.d}T${to}`), pair: c.p, place: c.place, online: !!c.online,
        meetingUrl: c.online ? `https://meet.orbita.future.edu/c/${randomBytes(9).toString("base64url")}` : null, capacity: c.cap,
      },
    });
    for (const [i, pid] of poolIds.slice(0, c.others).entries()) {
      await db.enrollment.upsert({
        where: { userId_courseId: { userId: pid, courseId: cons.courseId } }, create: { userId: pid, courseId: cons.courseId }, update: {},
      });
      await db.consultationSignup.create({
        data: { consultationId: cons.id, userId: pid, question: i < c.qs ? QUESTIONS[(i + ci) % QUESTIONS.length] : null },
      });
    }
    if (c.mine) await db.consultationSignup.create({ data: { consultationId: cons.id, userId: uid, question: c.mine } });
  }

  for (const n of person.notes) {
    await db.notification.create({
      data: { userId: uid, kind: n.kind, title: n.title, body: n.body, actorName: n.actor, actorAvatar: n.avatar, createdAt: at(n.at), readAt: n.read ? at(n.at) : null },
    });
  }
}

// ---------- Офис: заявки и документы. Токены проверки у существующих документов сохраняются (QR в выданных PDF остаются рабочими) ----------
interface SeedEvent { title: string; actor?: string; note?: string; at?: string }
interface SeedReq {
  login: string; number: string; typeId: string; params: object; status: string; stage: number; eta: string; created: string;
  events: SeedEvent[]; messages?: { author: string; role: "student" | "staff"; body: string; at: string }[];
}
interface SeedDoc {
  login: string; number: string; typeId: string; title: string; subtitle: string; issued: string; status: string; request?: string;
}
const PEOPLE: Record<string, { dative: string; mask: string; birth: number; fem: boolean; start: string; end: string; faculty: string; program: string; course: number }> = {
  "a.vorontsova": { dative: "Воронцовой Алисе Сергеевне", mask: "Воронцова А. С.", birth: 2006, fem: true, start: "01.09.2025", end: "30.06.2029", faculty: "международного бизнеса", program: "Международный бизнес", course: 2 },
  "m.orlov": { dative: "Орлову Максиму Андреевичу", mask: "Орлов М. А.", birth: 2004, fem: false, start: "01.09.2023", end: "30.06.2027", faculty: "международных отношений", program: "Мировая политика", course: 4 },
};
const SIGNER = "Смирнова И. А., учебный офис";

const SEED_REQS: SeedReq[] = [
  { login: "a.vorontsova", number: "R-2481", typeId: "visa", params: { purpose: "Посольство", lang: "Английский", format: "Электронная с QR", copies: 1 }, status: "work", stage: 2, eta: "2026-11-21", created: "2026-11-18T14:02",
    events: [{ title: "Заявка подана", actor: "Вы", at: "2026-11-18T14:02" }, { title: "Принята в работу", actor: "Смирнова И. А.", at: "2026-11-18T16:40" }, { title: "Готовится", note: "Перевод на английский" }, { title: "Готова", note: "PDF с QR-кодом" }],
    messages: [{ author: "Смирнова И. А.", role: "staff", body: "Нужна ли апостиль? Обычно консульства Испании принимают без него.", at: "2026-11-18T17:10" }] },
  { login: "a.vorontsova", number: "R-2477", typeId: "credit", params: { subject: "«Python для анализа данных» → «Информатика»", comment: "" }, status: "review", stage: 1, eta: "2026-11-22", created: "2026-11-15T11:20",
    events: [{ title: "Заявление подано", actor: "Вы", at: "2026-11-15T11:20" }, { title: "Проверка программ", note: "Кафедра информатики" }, { title: "Решение" }] },
  { login: "m.orlov", number: "R-2479", typeId: "army", params: { purpose: "Военкомат", lang: "Русский", format: "Бумажная", copies: 1 }, status: "work", stage: 2, eta: "2026-11-20", created: "2026-11-17T10:15",
    events: [{ title: "Заявка подана", actor: "Вы", at: "2026-11-17T10:15" }, { title: "Принята в работу", actor: "Смирнова И. А.", at: "2026-11-17T12:30" }, { title: "Готовится", note: "Печать и подпись" }, { title: "Готова", note: "Бумажная справка" }] },
];
const SEED_DOCS: SeedDoc[] = [
  { login: "a.vorontsova", number: "D-2470", typeId: "study", title: "Справка об обучении", subtitle: "По месту требования", issued: "2026-11-18T16:41", status: "ready" },
  { login: "a.vorontsova", number: "D-2415", typeId: "grades", title: "Выписка оценок за 1 курс", subtitle: "С QR-кодом", issued: "2026-10-02T12:10", status: "done" },
  { login: "a.vorontsova", number: "D-2398", typeId: "study", title: "Справка в банк", subtitle: "Бумажная, получена в офисе", issued: "2026-09-14T15:30", status: "done" },
  { login: "m.orlov", number: "D-2441", typeId: "study", title: "Справка об обучении", subtitle: "По месту требования", issued: "2026-10-05T11:00", status: "done" },
  { login: "m.orlov", number: "D-2402", typeId: "grades", title: "Выписка оценок за 3 курс", subtitle: "С QR-кодом", issued: "2026-09-12T13:20", status: "done" },
];

function paragraphs(d: SeedDoc): string[] {
  const p = PEOPLE[d.login];
  const who = p.fem ? "студенткой" : "студентом";
  const base = `Дана ${p.dative}, ${p.birth} г. р., в том, что ${p.fem ? "она" : "он"} действительно является ${who} ${p.course} курса очной формы обучения факультета ${p.faculty} Университета Будущего по программе бакалавриата «${p.program}».`;
  if (d.typeId === "grades") {
    return [base, `По итогам ${p.course - 1} курса ${p.fem ? "ей" : "ему"} зачтено 60 кредитов, средний балл 8,3 по десятибалльной шкале. Подробная выписка по дисциплинам приложена к электронной версии.`, "Выписка выдана для предоставления по месту требования."];
  }
  return [base, `Срок обучения: ${p.start} — ${p.end}.`, d.subtitle.startsWith("Бумажная") ? "Справка выдана для предоставления в банк." : "Справка выдана для предоставления по месту требования."];
}

const keepReqs = SEED_REQS.map((r) => r.number);
await db.officeRequest.deleteMany({ where: { number: { notIn: keepReqs } } });
await db.document.deleteMany({ where: { number: { notIn: SEED_DOCS.map((d) => d.number) } } });
for (const r of SEED_REQS) {
  const data = {
    userId: await userId(r.login), typeId: r.typeId, params: JSON.stringify(r.params), status: r.status, stage: r.stage, eta: at(r.eta), createdAt: at(r.created),
  };
  const saved = await db.officeRequest.upsert({ where: { number: r.number }, create: { number: r.number, ...data }, update: data });
  await db.requestEvent.deleteMany({ where: { requestId: saved.id } });
  await db.requestMessage.deleteMany({ where: { requestId: saved.id } });
  for (const [order, e] of r.events.entries()) {
    await db.requestEvent.create({ data: { requestId: saved.id, order, title: e.title, actorName: e.actor ?? "", note: e.note, at: e.at ? at(e.at) : null } });
  }
  for (const m of r.messages ?? []) {
    await db.requestMessage.create({ data: { requestId: saved.id, authorName: m.author, authorRole: m.role, body: m.body, createdAt: at(m.at) } });
  }
}
for (const d of SEED_DOCS) {
  const p = PEOPLE[d.login];
  const data = {
    userId: await userId(d.login), typeId: d.typeId, title: d.title, subtitle: d.subtitle, holderDative: p.dative, holderMask: p.mask,
    paragraphs: JSON.stringify(paragraphs(d)), issuedAt: at(d.issued), signedBy: SIGNER, status: d.status,
  };
  const existing = await db.document.findUnique({ where: { number: d.number } });
  if (existing) await db.document.update({ where: { number: d.number }, data });
  else await db.document.create({ data: { number: d.number, verifyToken: randomBytes(32).toString("base64url"), ...data } });
}

console.log(`Seeded ${users.length} users, ${await db.course.count()} courses, ${await db.gradeComponent.count()} components, ${await db.scheduleEvent.count()} events, ${await db.consultation.count()} consultations, ${await db.consultationSignup.count()} signups`);
await db.$disconnect();
