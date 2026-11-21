// Справочник «Университета Будущего»: вымышленные факультеты, потоки, группы, студенты и преподаватели — чтобы поиск людей
// выглядел как в настоящем вузе. Имена — случайные сочетания частых имён и фамилий (не реальные люди). Входа у этих
// аккаунтов нет: у каждого своя случайная строка в формате Argon2id, которой не соответствует ни один пароль. Генерация детерминированная (свой ГПСЧ),
// поэтому логины и адреса карточек от сида к сиду не меняются.
//
// Расписание — одинаковые недели с 26 октября по 12 декабря 2026 (демо-неделя ±3): лекции потоку, семинары группе, курсы по выбору — сборным группам.
// Личное расписание студента = пары курсов, на которые он записан (src/server/data/directory.ts).
import { randomBytes, randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { BELLS } from "../src/lib/bells";
import { addDays } from "../src/lib/demo-clock";

type Rng = () => number;
function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(r: Rng, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
const int = (r: Rng, min: number, max: number) => min + Math.floor(r() * (max - min + 1));
function shuffle<T>(r: Rng, xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const TRANSLIT: Record<string, string> = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya" };
export const translit = (s: string) => [...s.toLowerCase()].map((c) => TRANSLIT[c] ?? c).join("").replace(/[^a-z]/g, "");

const MALE = ["Александр", "Алексей", "Андрей", "Артём", "Борис", "Вадим", "Василий", "Виктор", "Владимир", "Георгий", "Григорий", "Даниил", "Денис", "Дмитрий", "Евгений", "Егор", "Иван", "Игорь", "Илья", "Кирилл", "Константин", "Лев", "Леонид", "Марк", "Михаил", "Никита", "Николай", "Олег", "Павел", "Пётр", "Роман", "Сергей", "Степан", "Тимофей", "Фёдор", "Юрий", "Ярослав"];
const FEMALE = ["Алина", "Алёна", "Анастасия", "Ангелина", "Анна", "Арина", "Валерия", "Варвара", "Вероника", "Виктория", "Дарья", "Диана", "Ева", "Екатерина", "Елизавета", "Злата", "Ирина", "Кира", "Ксения", "Лидия", "Любовь", "Маргарита", "Марина", "Милана", "Надежда", "Наталья", "Ольга", "Полина", "Светлана", "Софья", "Таисия", "Ульяна", "Юлия", "Яна"];
// мужская форма; женская — по окончанию (-ов → -ова, -ин → -ина, -ий → -ая), несклоняемые не меняются
const SURNAMES = ["Абрамов", "Аксёнов", "Алексеев", "Андреев", "Афанасьев", "Баранов", "Белкин", "Беспалов", "Блинов", "Богданов", "Борисов", "Быков", "Васильев", "Веселов", "Виноградов", "Власов", "Волков", "Воробьёв", "Гаврилов", "Голубев", "Гончаров", "Горбунов", "Гришин", "Гусев", "Давыдов", "Денисов", "Дорофеев", "Евдокимов", "Егоров", "Ершов", "Ефимов", "Жданов", "Зайцев", "Зимин", "Зуев", "Иванов", "Игнатьев", "Ильин", "Казаков", "Калинин", "Карпов", "Киселёв", "Ковалёв", "Колесников", "Комаров", "Кондратьев", "Копылов", "Корнилов", "Королёв", "Котов", "Крылов", "Кудрявцев", "Кулагин", "Лапин", "Лебедев", "Логинов", "Лукин", "Макаров", "Максимов", "Медведев", "Миронов", "Михайлов", "Морозов", "Муравьёв", "Наумов", "Никитин", "Новиков", "Овчинников", "Павлов", "Панов", "Пестов", "Покровский", "Поляков", "Пономарёв", "Попов", "Прохоров", "Родионов", "Романов", "Русаков", "Рыбаков", "Савельев", "Сазонов", "Селезнёв", "Семёнов", "Сидоров", "Симонов", "Смирнов", "Соловьёв", "Сорокин", "Степанов", "Суворов", "Тарасов", "Тихонов", "Третьяков", "Трофимов", "Уваров", "Ульянов", "Устинов", "Фадеев", "Федосеев", "Филатов", "Фомин", "Фролов", "Харитонов", "Цветков", "Чернов", "Шаров", "Широков", "Щербаков", "Юдин", "Яковлев", "Ястребов", "Ким", "Ли", "Пак", "Шевчук", "Бондаренко", "Мельник", "Левченко"];
const female = (s: string) => (/(ов|ев|ёв|ин|ын)$/.test(s) ? s + "а" : /ский$/.test(s) ? s.replace(/ий$/, "ая") : s);
const PATRONYMIC: Record<string, [string, string]> = Object.fromEntries(
  ["Александр", "Алексей", "Андрей", "Борис", "Вадим", "Виктор", "Владимир", "Георгий", "Григорий", "Денис", "Дмитрий", "Евгений", "Иван", "Игорь", "Кирилл", "Константин", "Леонид", "Михаил", "Николай", "Олег", "Павел", "Пётр", "Роман", "Сергей", "Юрий"].map((n) => {
    const base = n === "Пётр" ? "Петр" : n;
    if (/ий$/.test(n)) return [n, [base.replace(/ий$/, "иевич"), base.replace(/ий$/, "иевна")]];
    if (/ей$/.test(n)) return [n, [base.replace(/ей$/, "еевич"), base.replace(/ей$/, "еевна")]];
    if (/ай$/.test(n)) return [n, [base.replace(/ай$/, "аевич"), base.replace(/ай$/, "аевна")]];
    if (n === "Михаил") return [n, ["Михайлович", "Михайловна"]];
    if (n === "Павел") return [n, ["Павлович", "Павловна"]];
    if (n === "Пётр") return [n, ["Петрович", "Петровна"]];
    return [n, [base + "ович", base + "овна"]];
  }),
);
const FATHERS = Object.keys(PATRONYMIC);

interface Faculty {
  name: string;
  science: string; // «экономических» — для учёной степени
  departments: string[];
  interests: string[];
  programs: { title: string; code: string; subjects: string[] }[];
}
const FACULTIES: Faculty[] = [
  {
    name: "Факультет международного бизнеса", science: "экономических",
    departments: ["Кафедра международного менеджмента", "Кафедра маркетинга", "Кафедра логистики и цепей поставок"],
    interests: ["Международный менеджмент", "Цепи поставок", "Поведение потребителей", "Стратегия", "Корпоративные финансы", "ESG"],
    programs: [
      { title: "Международный бизнес", code: "МБ", subjects: ["Основы менеджмента", "Международный маркетинг", "Корпоративные финансы", "Стратегический менеджмент", "Кросс-культурный менеджмент", "Международная торговля", "Управление проектами", "Бизнес-аналитика", "Деловые переговоры", "Международное налогообложение"] },
      { title: "Маркетинг", code: "МК", subjects: ["Основы маркетинга", "Поведение потребителей", "Маркетинговые исследования", "Бренд-менеджмент", "Цифровой маркетинг", "Ценообразование", "Интегрированные коммуникации", "Аналитика продаж", "Маркетинг услуг", "Управление продуктом"] },
      { title: "Логистика", code: "ЛГ", subjects: ["Введение в логистику", "Управление запасами", "Транспортная логистика", "Складская логистика", "Таможенное дело", "Цепи поставок", "Исследование операций", "Закупки", "ВЭД", "Логистический аудит"] },
    ],
  },
  {
    name: "Факультет международных отношений", science: "политических",
    departments: ["Кафедра мировой политики", "Кафедра востоковедения", "Кафедра дипломатии"],
    interests: ["Мировая политика", "Восточная Азия", "Дипломатия", "Конфликты", "Регионоведение", "Международная безопасность"],
    programs: [
      { title: "Мировая политика", code: "МП", subjects: ["Теория международных отношений", "История международных отношений", "Мировая политика", "Внешняя политика России", "Международные организации", "Политическая география", "Конфликтология", "Международная безопасность", "Дипломатический протокол", "Сравнительная политология"] },
      { title: "Востоковедение", code: "ВВ", subjects: ["Китайский язык", "История Китая", "Политика стран Азии", "Экономика Восточной Азии", "Культура Японии", "Религии Востока", "Корейский язык", "Регионоведение АТР", "Классическая литература Востока", "Деловая культура Азии"] },
    ],
  },
  {
    name: "Факультет экономики", science: "экономических",
    departments: ["Кафедра экономической теории", "Кафедра анализа данных", "Кафедра финансов"],
    interests: ["Макроэкономика", "Эконометрика", "Машинное обучение", "Финансовые рынки", "Поведенческая экономика", "Банки"],
    programs: [
      { title: "Экономика и данные", code: "ЭД", subjects: ["Микроэкономика", "Макроэкономика", "Математический анализ", "Линейная алгебра", "Теория вероятностей", "Эконометрика", "Машинное обучение", "Базы данных", "Анализ временных рядов", "Визуализация данных"] },
      { title: "Финансы", code: "ФН", subjects: ["Финансовые рынки", "Корпоративные финансы", "Бухгалтерский учёт", "Денежно-кредитная политика", "Инвестиционный анализ", "Банковское дело", "Страхование", "Финансовая математика", "Оценка бизнеса", "Риск-менеджмент"] },
    ],
  },
  {
    name: "Факультет права", science: "юридических",
    departments: ["Кафедра международного права", "Кафедра гражданского права", "Кафедра права и технологий"],
    interests: ["Международное публичное право", "Арбитраж", "Права человека", "Право ИИ", "Защита данных", "Корпоративное право"],
    programs: [
      { title: "Международное право", code: "МПР", subjects: ["Теория государства и права", "Международное публичное право", "Международное частное право", "Конституционное право", "Право ВТО", "Права человека", "Международный арбитраж", "Право ЕАЭС", "Морское право", "Дипломатическое право"] },
      { title: "Право и технологии", code: "ПТ", subjects: ["Теория государства и права", "Гражданское право", "Право интеллектуальной собственности", "Защита персональных данных", "Право и искусственный интеллект", "Цифровые платформы", "Кибербезопасность", "Договорное право", "Финтех и право", "Юридическая техника"] },
    ],
  },
  {
    name: "Факультет медиакоммуникаций", science: "филологических",
    departments: ["Кафедра медиаменеджмента", "Кафедра рекламы и PR"],
    interests: ["Медиаэкономика", "Креативные индустрии", "PR", "Медиаграмотность", "Визуальные коммуникации", "Платформы"],
    programs: [
      { title: "Медиаменеджмент", code: "ММ", subjects: ["Теория коммуникации", "Медиаэкономика", "История медиа", "Управление редакцией", "Мультимедийная журналистика", "Медиаправо", "Аудитория и метрики", "Продюсирование", "Платформы и алгоритмы", "Медиапроект"] },
      { title: "Реклама и связи с общественностью", code: "РС", subjects: ["Основы рекламы", "Связи с общественностью", "Копирайтинг", "Визуальные коммуникации", "Медиапланирование", "Кризисные коммуникации", "Event-менеджмент", "Социология массовых коммуникаций", "Брендинг", "Корпоративные коммуникации"] },
    ],
  },
];
const ELECTIVES = ["Публичные выступления", "Анализ данных в Excel", "Китайский язык A1", "Испанский язык A2", "Финансовая грамотность", "Дизайн-мышление", "Устойчивое развитие", "Психология переговоров", "Python для начинающих", "История искусств", "Критическое мышление", "Предпринимательство"];
const COLORS = ["micro", "econ", "world", "eng", "law", "hist", "py"];
const AVATARS = ["sand", "mist", "lilac", "peach", "mint"];
// курс → год в шифре группы (как у демо-групп: МК-26 — 1 курс, МБ-24 — 2, МП-22 — 4)
const YEAR: Record<number, number> = { 1: 26, 2: 24, 3: 23, 4: 22 };
// потоки демо-студентов уже есть в основном сиде
const DEMO_STREAMS = new Set(["МБ-24", "МП-22", "МК-26"]);
const WEEKS = 3;
const DAYS = ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21"];
const at = (date: string, time: string) => new Date(`${date}T${time}:00+03:00`);

/**
 * «Хеш» аккаунта без пароля: строка в формате Argon2id (PHC) со своей случайной солью и случайными байтами вместо хеша.
 * Пароля, который бы с ней совпал, не существует — войти нельзя. Argon2 на 1800 аккаунтов не считаем: сид шёл бы минутами.
 */
const b64 = (n: number) => randomBytes(n).toString("base64").replace(/=+$/, "");
const noPassword = (params: string) => `${params}${b64(16)}$${b64(32)}`;

export async function seedDirectory(db: PrismaClient, sampleHash: string, pepperVersion: number) {
  // параметры «$argon2id$v=19$m=65536,t=4,p=1$» — как у настоящих хешей (всё до соли)
  const params = sampleHash.split("$").slice(0, 4).join("$") + "$";
  const r = mulberry32(20261121);
  const taken = new Set((await db.user.findMany({ select: { login: true } })).map((u) => u.login));
  const takenSlugs = new Set((await db.teacher.findMany({ select: { slug: true, short: true, email: true } })).flatMap((t) => [t.slug, t.short, t.email.split("@")[0]]));
  const uniq = (base: string, set: Set<string>) => {
    let s = base;
    for (let i = 2; set.has(s); i++) s = `${base}${i}`;
    set.add(s);
    return s;
  };

  // ---------- Преподаватели: по 12–16 на факультет ----------
  type T = { id: string; short: string; full: string; avatar: string; faculty: number; senior: boolean };
  const teachers: T[] = [];
  const teacherRows = [];
  for (const [fi, f] of FACULTIES.entries()) {
    const n = int(r, 12, 16);
    for (let i = 0; i < n; i++) {
      const isMale = r() < 0.5;
      const first = isMale ? pick(r, MALE) : pick(r, FEMALE);
      const lastM = pick(r, SURNAMES);
      const last = isMale ? lastM : female(lastM);
      const middle = PATRONYMIC[pick(r, FATHERS)][isMale ? 0 : 1];
      const short = uniq(`${last} ${first[0]}. ${middle[0]}.`, takenSlugs);
      const slug = uniq(`${translit(last)}-${translit(first)[0]}${translit(middle)[0]}`, takenSlugs);
      const mail = uniq(`${translit(first)[0]}.${translit(last)}`, taken);
      const position = pick(r, ["Ассистент", "Старший преподаватель", "Старший преподаватель", "Доцент", "Доцент", "Доцент", "Профессор"]);
      const degree = position === "Профессор" ? `Доктор ${f.science} наук` : position === "Доцент" ? `Кандидат ${f.science} наук` : null;
      const id = randomUUID();
      const avatar = pick(r, AVATARS);
      teachers.push({ id, short, full: `${last} ${first} ${middle}`, avatar, faculty: fi, senior: position === "Доцент" || position === "Профессор" });
      teacherRows.push({
        id, slug, short, lastName: last, firstName: first, middleName: middle, avatar, position, degree,
        department: pick(r, f.departments), email: `${mail}@orbita.edu`, office: `Каб. ${int(r, 2, 6)}${int(r, 0, 3)}${int(r, 0, 9)}`,
        interests: JSON.stringify(shuffle(r, f.interests).slice(0, int(r, 2, 4))),
      });
    }
  }
  await db.teacher.createMany({ data: teacherRows });

  // занятость преподавателя по слотам — чтобы у него не было двух пар одновременно
  const busy = new Set<string>();
  const slotKey = (t: T, d: number, p: number) => `${t.id}|${d}|${p}`;
  function freeTeacher(pool: T[], d: number, p: number, prefer?: T): T {
    if (prefer && !busy.has(slotKey(prefer, d, p))) return prefer;
    return shuffle(r, pool).find((t) => !busy.has(slotKey(t, d, p))) ?? pool[0];
  }

  const courses: { id: string; slug: string; title: string; color: string; format: string; assessment: string; credits: number; teacherName: string; teacherAvatar: string }[] = [];
  const staff: { courseId: string; teacherId: string; role: string; order: number }[] = [];
  const events: { courseId: string; kind: string; pair: number; startsAt: Date; endsAt: Date; room: string; teacherName: string; groupName: string }[] = [];
  const staffSeen = new Set<string>();
  const addStaff = (courseId: string, t: T, role: string) => {
    if (staffSeen.has(`${courseId}|${t.id}`)) return;
    staffSeen.add(`${courseId}|${t.id}`);
    staff.push({ courseId, teacherId: t.id, role, order: role === "Лекции" ? 0 : 1 });
  };
  const room = () => `${int(r, 1, 5)}${int(r, 1, 4)}${int(r, 0, 2)}${int(r, 1, 9)}`;
  const addEvent = (courseId: string, kind: string, d: number, p: number, t: T, groupName: string) => {
    busy.add(slotKey(t, d, p));
    const [from, to] = BELLS[p];
    const where = room();
    // одна и та же пара каждую неделю, ±3 недели от демо-недели (как листает «Время»)
    for (let w = -WEEKS; w <= WEEKS; w++) {
      const date = addDays(DAYS[d], 7 * w);
      events.push({ courseId, kind, pair: p, startsAt: at(date, from), endsAt: at(date, to), room: where, teacherName: t.short, groupName });
    }
  };

  // ---------- Курсы по выбору: по 12 на каждый год, вечером и в субботу, сборные группы ----------
  const electives: Record<number, { id: string; day: number }[]> = {};
  let slugN = 0;
  for (const year of [1, 2, 3, 4]) {
    electives[year] = [];
    for (const [i, title] of ELECTIVES.entries()) {
      const id = randomUUID();
      const t = pick(r, teachers);
      const d = i % 6;
      const p = d === 5 ? 3 + (i % 2) : 7;
      courses.push({ id, slug: `dir-${++slugN}`, title, color: COLORS[i % COLORS.length], format: "offline", assessment: "credit", credits: 3, teacherName: t.short, teacherAvatar: t.avatar });
      addStaff(id, t, "Занятия");
      addEvent(id, "seminar", d, p, freeTeacher(teachers, d, p, t), "Сборная группа");
      electives[year].push({ id, day: d });
    }
  }

  // ---------- Потоки, группы, студенты ----------
  const students = [];
  const enroll: { userId: string; courseId: string; order: number }[] = [];
  const slots = DAYS.slice(0, 5).flatMap((_, d) => [2, 3, 4, 5, 6].map((p) => [d, p] as const));

  for (const [fi, f] of FACULTIES.entries()) {
    const pool = teachers.filter((t) => t.faculty === fi);
    const seniors = pool.filter((t) => t.senior).length ? pool.filter((t) => t.senior) : pool;
    for (const prog of f.programs) {
      for (const year of [1, 2, 3, 4]) {
        const stream = `${prog.code}-${YEAR[year]}`;
        if (DEMO_STREAMS.has(stream)) continue;
        const groups = Array.from({ length: r() < 0.35 ? 3 : 2 }, (_, i) => `${stream}-${i + 1}`);
        // 5 дисциплин потока: лекция всему потоку, семинар — каждой группе
        const titles = shuffle(r, prog.subjects).slice(0, 5);
        const free = shuffle(r, [...slots]);
        const lectureSlots = free.splice(0, 5);
        const streamCourses = titles.map((title, i) => {
          const id = randomUUID();
          const [d, p] = lectureSlots[i];
          const lecturer = freeTeacher(seniors, d, p);
          const seminarist = pick(r, pool);
          courses.push({
            id, slug: `dir-${++slugN}`, title, color: COLORS[(i + year) % COLORS.length], format: "offline",
            assessment: r() < 0.6 ? "exam" : "credit", credits: int(r, 3, 6), teacherName: lecturer.short, teacherAvatar: lecturer.avatar,
          });
          addStaff(id, lecturer, "Лекции");
          addEvent(id, "lecture", d, p, lecturer, `Поток ${stream}`);
          return { id, seminarist };
        });
        for (const g of groups) {
          // семинары группы — в свободные от лекций слоты, у каждой группы свои
          const own = shuffle(r, free).slice(0, 5);
          const curator = pick(r, pool);
          const size = int(r, 14, 20);
          const people: { id: string; name: string }[] = [];
          for (let i = 0; i < size; i++) {
            const isMale = r() < 0.45;
            const first = isMale ? pick(r, MALE) : pick(r, FEMALE);
            const lastM = pick(r, SURNAMES);
            const last = isMale ? lastM : female(lastM);
            const login = uniq(`${translit(first)[0]}.${translit(last)}`, taken);
            const hasTg = r() < 0.65;
            const hasPhone = r() < 0.4;
            const id = randomUUID();
            people.push({ id, name: `${last} ${first}` });
            students.push({
              id, login, passwordHash: noPassword(params), pepperVersion, role: "student", firstName: first, lastName: last,
              middleName: PATRONYMIC[pick(r, FATHERS)][isMale ? 0 : 1],
              faculty: f.name, program: prog.title, course: year, groupName: g, avatar: pick(r, AVATARS), onboardingDone: true,
              degree: "Бакалавриат", studyForm: r() < 0.7 ? "Очная, бюджет" : "Очная, контракт", admissionYear: 2027 - year, graduationYear: 2031 - year,
              curatorName: curator.full, headmanName: null as string | null,
              telegram: hasTg ? `@${login.replace(".", "_")}` : null, showTelegram: hasTg && r() < 0.6,
              phone: hasPhone ? `+7 9${int(r, 10, 99)} ${int(r, 100, 999)}-${int(r, 10, 99)}-${int(r, 10, 99)}` : null, showPhone: hasPhone && r() < 0.35,
            });
            for (const [o, c] of streamCourses.entries()) enroll.push({ userId: id, courseId: c.id, order: o });
            // 1–2 курса по выбору в разные дни — у каждого своё расписание
            const pickE = shuffle(r, electives[year]);
            const chosen = [pickE[0], pickE.find((e) => e.day !== pickE[0].day)!].slice(0, r() < 0.3 ? 1 : 2);
            for (const [o, e] of chosen.entries()) enroll.push({ userId: id, courseId: e.id, order: 10 + o });
          }
          const headman = people[int(r, 0, people.length - 1)].name;
          for (const s of students.slice(-size)) s.headmanName = headman;
          streamCourses.forEach((c, i) => {
            const [d, p] = own[i];
            const t = freeTeacher(pool, d, p, c.seminarist);
            addStaff(c.id, t, "Семинары");
            addEvent(c.id, "seminar", d, p, t, g);
          });
        }
      }
    }
  }

  const chunk = async <X,>(xs: X[], fn: (part: X[]) => Promise<unknown>) => {
    for (let i = 0; i < xs.length; i += 500) await fn(xs.slice(i, i + 500));
  };
  await chunk(courses, (data) => db.course.createMany({ data }));
  await chunk(staff, (data) => db.courseTeacher.createMany({ data }));
  await chunk(events, (data) => db.scheduleEvent.createMany({ data }));
  await chunk(students, (data) => db.user.createMany({ data }));
  await chunk(enroll, (data) => db.enrollment.createMany({ data }));
  return { teachers: teachers.length, students: students.length, courses: courses.length, events: events.length };
}

/**
 * Студенты из основного сида без своих курсов (однокурсники Алисы, участники Random Coffee) — в группы и на курсы:
 * у каждого в карточке должно быть личное расписание. Без группы — первая группа своей программы и курса.
 */
export async function attachToGroups(db: PrismaClient, logins: string[]) {
  const users = await db.user.findMany({ where: { login: { in: logins }, role: "student" }, select: { id: true, program: true, course: true, groupName: true } });
  for (const u of users) {
    let group = u.groupName;
    if (!group) {
      const prog = FACULTIES.flatMap((f) => f.programs).find((p) => p.title === u.program);
      if (!prog || !u.course) continue;
      group = `${prog.code}-${YEAR[u.course]}-1`;
      await db.user.update({ where: { id: u.id }, data: { groupName: group } });
    }
    const stream = `Поток ${group.replace(/-\d+$/, "")}`;
    const courses = await db.course.findMany({ where: { events: { some: { groupName: { in: [group, stream] } } } }, select: { id: true } });
    for (const [order, c] of courses.entries())
      await db.enrollment.upsert({ where: { userId_courseId: { userId: u.id, courseId: c.id } }, create: { userId: u.id, courseId: c.id, order }, update: {} });
  }
}
