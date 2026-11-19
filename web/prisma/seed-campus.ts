// Кампус: клубы, библиотека, печать. Все люди, книги и клубы вымышленные.

export interface ClubDef {
  slug: string;
  title: string;
  category: "sport" | "mind" | "tech" | "creative" | "career" | "community";
  color: string;
  short: string;
  description: string;
  schedule: string;
  place: string;
  members: number;
  join: "open" | "apply";
  tags: string[];
  highlights: string[];
  leader: { name: string; role: string; avatar: string; tg: string; email: string };
}

export const CLUBS: ClubDef[] = [
  {
    slug: "cycling", title: "Велоклуб «Кольцо»", category: "sport", color: "micro",
    short: "Субботние выезды по городу и за город, от 30 до 100 км",
    description: "Катаемся каждую субботу с весны до первого снега, зимой — сайкл-тренировки в спортзале.\n\nЕсть группы для новичков: темп спокойный, никого не бросаем. Велосипед можно взять в прокате университета по Орбита ID.",
    schedule: "Сб, 10:00", place: "Главный вход, велопарковка", members: 64, join: "open",
    tags: ["выезды", "новичкам можно", "прокат велосипедов"],
    highlights: ["Ночной заезд по набережным — 300 участников", "Велопоход «Золотое кольцо» летом 2026 года"],
    leader: { name: "Тимофей Гаранин", role: "Президент клуба, 4 курс", avatar: "sand", tg: "garanin_ride", email: "t.garanin@orbita.edu" },
  },
  {
    slug: "chess", title: "Шахматный клуб «Эндшпиль»", category: "mind", color: "hist",
    short: "Турниры по рапиду и блицу, разборы партий с мастером",
    description: "Играем очно и онлайн. Раз в месяц — университетский турнир по рапиду с рейтингом клуба, по четвергам — разбор партий с тренером.\n\nПодходит любой уровень: от «знаю, как ходит конь» до кандидатов в мастера.",
    schedule: "Вт и Чт, 18:10", place: "Ауд. 2108", members: 41, join: "open",
    tags: ["турниры", "любой уровень"],
    highlights: ["Сборная университета — 2 место на межвузовском турнире 2026 года", "Сеанс одновременной игры с гроссмейстером в октябре"],
    leader: { name: "Арина Белозёрова", role: "Капитан сборной, 3 курс", avatar: "lilac", tg: "belozerova_chess", email: "a.belozerova@orbita.edu" },
  },
  {
    slug: "byte", title: "Клуб спортивного программирования «Байт»", category: "tech", color: "py",
    short: "Алгоритмы, олимпиады и командные контесты",
    description: "Готовимся к студенческим олимпиадам по программированию: алгоритмы, структуры данных, командная игра. Каждую среду — тренировка с разбором задач, раз в месяц — внутренний контест.\n\nНужно уверенно знать один язык (Python, C++ или Java). Отбор — небольшая задача на входе.",
    schedule: "Ср, 18:10", place: "Ауд. 1312, компьютерный класс", members: 28, join: "apply",
    tags: ["алгоритмы", "олимпиады", "C++ и Python"],
    highlights: ["Две команды в полуфинале студенческого чемпионата 2026 года", "Спецкурс по алгоритмам засчитывается как электив"],
    leader: { name: "Глеб Северинов", role: "Тренер клуба, магистратура 1 курс", avatar: "mist", tg: "severinov_algo", email: "g.severinov@orbita.edu" },
  },
  {
    slug: "debate", title: "Дебатный клуб «Аргумент»", category: "mind", color: "law",
    short: "Британский парламентский формат, на русском и английском",
    description: "Учимся спорить по правилам: строить аргумент за 15 минут, слушать оппонента и отвечать по существу. Тренировки дважды в неделю, турниры — почти каждый месяц.\n\nНовичков ждём в начале каждого семестра: первые четыре встречи — школа дебатов.",
    schedule: "Пн, 19:40 и Сб, 12:00", place: "Ауд. 3315", members: 52, join: "apply",
    tags: ["турниры", "английский", "публичные выступления"],
    highlights: ["Финал открытого кубка вузов по дебатам 2026 года", "Еженедельные дебаты на английском с иностранными студентами"],
    leader: { name: "Вероника Ласточкина", role: "Президент клуба, 3 курс", avatar: "peach", tg: "lastochkina_debate", email: "v.lastochkina@orbita.edu" },
  },
  {
    slug: "mun", title: "Модель ООН", category: "community", color: "world",
    short: "Конференции в ролях делегатов, переговоры и резолюции",
    description: "Готовим делегации на конференции модели ООН в других вузах и проводим свою — весной. Учимся писать позиционные документы, вести переговоры и голосовать за резолюции.\n\nНабор — дважды в год, по короткому письму о мотивации.",
    schedule: "Чт, 19:40", place: "Ауд. 5101", members: 47, join: "apply",
    tags: ["переговоры", "международные отношения", "английский"],
    highlights: ["Своя конференция — 250 делегатов из 14 городов", "Лучшая делегация на трёх конференциях 2026 года"],
    leader: { name: "Ярослав Миронов", role: "Генеральный секретарь, 4 курс", avatar: "mist", tg: "mironov_mun", email: "y.mironov@orbita.edu" },
  },
  {
    slug: "football", title: "Футбольная команда университета", category: "sport", color: "eng",
    short: "Мини-футбол, студенческая лига, отбор в сборную",
    description: "Играем в студенческой лиге по мини-футболу. Тренировки три раза в неделю, игры — по выходным.\n\nОтбор в сборную — в сентябре и феврале, остальные могут приходить на открытые тренировки по пятницам.",
    schedule: "Пн, Ср, Пт, 20:00", place: "Спортзал корпуса Б", members: 23, join: "apply",
    tags: ["сборная", "лига", "открытые тренировки"],
    highlights: ["Бронза студенческой лиги сезона 2025/26"],
    leader: { name: "Руслан Тагиров", role: "Капитан команды, 3 курс", avatar: "sand", tg: "tagirov_10", email: "r.tagirov@orbita.edu" },
  },
  {
    slug: "running", title: "Клуб бега «Первый круг»", category: "sport", color: "econ",
    short: "Утренние пробежки и подготовка к полумарафону",
    description: "Бегаем по утрам до пар вокруг кампуса — 5–8 км в разговорном темпе. По выходным — длинные пробежки в парке, весной вместе готовимся к полумарафону.\n\nВстроенная запись тренировок в Орбите — скоро.",
    schedule: "Вт и Пт, 07:30", place: "Главный вход", members: 89, join: "open",
    tags: ["утро", "новичкам можно", "полумарафон"],
    highlights: ["32 человека пробежали полумарафон в 2026 году"],
    leader: { name: "Полина Корнеева", role: "Тренер-волонтёр, 2 курс", avatar: "peach", tg: "korneeva_run", email: "p.korneeva@orbita.edu" },
  },
  {
    slug: "consulting", title: "Клуб консалтинга «Кейс»", category: "career", color: "econ",
    short: "Решаем бизнес-кейсы, готовимся к собеседованиям в консалтинг",
    description: "Разбираем кейсы компаний, тренируем кейс-интервью и ездим на чемпионаты. Встречи с выпускниками из консалтинга и банков — каждый месяц.\n\nВступление — через решение отборочного кейса в команде.",
    schedule: "Чт, 18:10", place: "Ауд. 1105", members: 36, join: "apply",
    tags: ["кейсы", "карьера", "чемпионаты"],
    highlights: ["Победа в чемпионате по решению бизнес-кейсов 2026 года", "Стажировки для участников у партнёров клуба"],
    leader: { name: "Даниил Воскресенский", role: "Президент клуба, 4 курс", avatar: "lilac", tg: "voskresensky_case", email: "d.voskresensky@orbita.edu" },
  },
  {
    slug: "theatre", title: "Студенческий театр «Антракт»", category: "creative", color: "hist",
    short: "Два спектакля в год, актёрский тренинг и закулисье",
    description: "Ставим два спектакля в год на сцене актового зала. Нужны не только актёры: художники, звукорежиссёры, костюмеры и те, кто хочет попробовать себя в режиссуре.\n\nПрослушивание — в начале семестра.",
    schedule: "Ср и Сб, 17:00", place: "Актовый зал", members: 34, join: "apply",
    tags: ["сцена", "закулисье"],
    highlights: ["Премьера «Ревизора» в новой постановке — апрель 2026 года"],
    leader: { name: "Мирон Шестаков", role: "Режиссёр, 4 курс", avatar: "sand", tg: "shestakov_stage", email: "m.shestakov@orbita.edu" },
  },
  {
    slug: "media", title: "Студенческое медиа «Орбита.Live»", category: "creative", color: "micro",
    short: "Тексты, подкасты и видео о жизни университета",
    description: "Пишем, снимаем и записываем подкасты о том, что происходит в университете. Редакционная встреча — раз в неделю, задания — по желанию и в своём темпе.\n\nНаучим работать с текстом, камерой и звуком.",
    schedule: "Пн, 18:10", place: "Медиацентр, корпус А", members: 58, join: "open",
    tags: ["тексты", "подкасты", "видео"],
    highlights: ["Подкаст «Между парами» — 40 выпусков"],
    leader: { name: "Ульяна Громова", role: "Главный редактор, 3 курс", avatar: "lilac", tg: "gromova_live", email: "u.gromova@orbita.edu" },
  },
  {
    slug: "moot", title: "Клуб моделирования судебных процессов", category: "career", color: "law",
    short: "Мут-корты по международному праву и арбитражу",
    description: "Готовим команды к мут-кортам по международному праву и коммерческому арбитражу: письменные меморандумы и устные раунды. Куратор — Шевченко А. В., кафедра международного права.\n\nПодходит не только юристам: экономисты в команде очень нужны.",
    schedule: "Вт, 18:10", place: "Ауд. 703", members: 19, join: "apply",
    tags: ["право", "арбитраж", "английский"],
    highlights: ["Четвертьфинал международного мут-корта по арбитражу 2026 года"],
    leader: { name: "Елизавета Корф", role: "Капитан команды, 4 курс", avatar: "peach", tg: "korf_moot", email: "e.korf@orbita.edu" },
  },
  {
    slug: "volunteer", title: "Волонтёрский центр", category: "community", color: "py",
    short: "Помощь на мероприятиях, экологические и социальные проекты",
    description: "Помогаем на днях открытых дверей, конференциях и спортивных событиях университета, ведём экологические проекты — от раздельного сбора на кампусе до субботников.\n\nЧасы волонтёрства видны в профиле и идут в портфолио.",
    schedule: "По проектам", place: "Корпус А, каб. 118", members: 140, join: "open",
    tags: ["мероприятия", "экология", "портфолио"],
    highlights: ["2 400 часов волонтёрства в 2025/26 учебном году"],
    leader: { name: "Святослав Ершов", role: "Координатор центра, 3 курс", avatar: "mist", tg: "ershov_volunteer", email: "s.ershov@orbita.edu" },
  },
];

/** Членство демо-студентов: [логин, клуб, статус]. */
export const CLUB_MEMBERS: [string, string, "member" | "pending"][] = [
  ["a.vorontsova", "debate", "member"],
  ["a.vorontsova", "cycling", "member"],
  ["a.vorontsova", "consulting", "pending"],
  ["m.orlov", "mun", "member"],
  ["m.orlov", "chess", "member"],
];

// ---------- Библиотека ----------
export interface BookDef {
  slug: string;
  title: string;
  author: string;
  year: number;
  publisher: string;
  pages: number;
  color: string;
  format: "print" | "ebook" | "both";
  shelf: string;
  course?: string;
  copies: number;
  available: number;
}

const UP = "Издательство Университета Будущего";
export const BOOKS: BookDef[] = [
  { slug: "economix", title: "Экономикс", author: "Ричардс Л., Брэдли Т.", year: 2022, publisher: "Деловая книга", pages: 980, color: "micro", format: "both", shelf: "Экономика", course: "micro-24", copies: 14, available: 3 },
  { slug: "micro-textbook", title: "Микроэкономика: учебник для бакалавров", author: "Петрова Е. А.", year: 2024, publisher: UP, pages: 512, color: "micro", format: "both", shelf: "Экономика", course: "micro-24", copies: 180, available: 22 },
  { slug: "micro-problems", title: "Задачи по микроэкономике с решениями", author: "Ларионов П. О.", year: 2023, publisher: UP, pages: 184, color: "micro", format: "ebook", shelf: "Экономика", course: "micro-24", copies: 0, available: 0 },
  { slug: "econometrics", title: "Эконометрика для бакалавров: от регрессии к причинности", author: "Соколов Д. В.", year: 2023, publisher: UP, pages: 436, color: "econ", format: "both", shelf: "Анализ данных", course: "econometrics-24", copies: 150, available: 9 },
  { slug: "econometrics-r", title: "Практикум по эконометрике в R и Python", author: "Ахмедова Л. Р.", year: 2025, publisher: UP, pages: 220, color: "econ", format: "ebook", shelf: "Анализ данных", course: "econometrics-24", copies: 0, available: 0 },
  { slug: "supply-chains", title: "Глобальные цепочки поставок после 2022 года", author: "Ким А. С.", year: 2024, publisher: UP, pages: 296, color: "world", format: "both", shelf: "Мировая экономика", course: "world-economy-24", copies: 40, available: 6 },
  { slug: "trade-reviews", title: "Обзоры мировой торговли: сборник", author: "Под ред. Ким А. С.", year: 2025, publisher: UP, pages: 160, color: "world", format: "ebook", shelf: "Мировая экономика", course: "world-economy-24", copies: 0, available: 0 },
  { slug: "case-book", title: "Business English Case Book B2", author: "Morgan K.", year: 2022, publisher: "Orbita University Press", pages: 208, color: "eng", format: "print", shelf: "Иностранные языки", course: "english-b2", copies: 120, available: 14 },
  { slug: "vienna", title: "Венская конвенция 1980 года: комментарий для практиков", author: "Орлова М. И.", year: 2023, publisher: UP, pages: 388, color: "law", format: "print", shelf: "Право", course: "intl-law-24", copies: 12, available: 2 },
  { slug: "law-cases", title: "Сборник казусов по международному праву", author: "Шевченко А. В.", year: 2024, publisher: UP, pages: 144, color: "law", format: "ebook", shelf: "Право", course: "intl-law-24", copies: 0, available: 0 },
  { slug: "protocol", title: "Протокол и власть: церемониал на конференциях XIX века", author: "Белов Г. Н.", year: 2022, publisher: UP, pages: 264, color: "hist", format: "both", shelf: "История", course: "diplomacy-history-24", copies: 8, available: 0 },
  { slug: "diplomacy-reader", title: "Хрестоматия по истории дипломатии", author: "Сост. Белов Г. Н.", year: 2021, publisher: UP, pages: 610, color: "hist", format: "ebook", shelf: "История", course: "diplomacy-history-24", copies: 0, available: 0 },
  { slug: "world-politics", title: "Мировая политика: учебник", author: "Ланской Р. Д.", year: 2021, publisher: "Аспект", pages: 540, color: "world", format: "print", shelf: "Международные отношения", course: "ir-theory-22", copies: 25, available: 0 },
  { slug: "ir-theory", title: "Теория международных отношений: учебник", author: "Громов В. П.", year: 2022, publisher: UP, pages: 470, color: "econ", format: "both", shelf: "Международные отношения", course: "ir-theory-22", copies: 90, available: 11 },
  { slug: "marketing-basics", title: "Маркетинг: первые шаги", author: "Лебедева Т. Р.", year: 2025, publisher: UP, pages: 240, color: "micro", format: "both", shelf: "Маркетинг", course: "marketing-intro-26", copies: 160, available: 31 },
  { slug: "academic-writing", title: "Как писать академические тексты", author: "Центр академического письма", year: 2025, publisher: UP, pages: 128, color: "econ", format: "ebook", shelf: "Навыки", copies: 0, available: 0 },
  { slug: "data-python", title: "Python для анализа данных: практикум", author: "Цифровая кафедра", year: 2025, publisher: UP, pages: 310, color: "py", format: "ebook", shelf: "Анализ данных", copies: 0, available: 0 },
  { slug: "stats-intro", title: "Статистика: просто о сложном", author: "Соколов Д. В.", year: 2021, publisher: UP, pages: 350, color: "econ", format: "both", shelf: "Анализ данных", copies: 60, available: 17 },
  { slug: "management", title: "Теория менеджмента", author: "Захарова О. В.", year: 2020, publisher: UP, pages: 400, color: "world", format: "print", shelf: "Менеджмент", copies: 70, available: 25 },
  { slug: "linear-algebra", title: "Линейная алгебра для экономистов", author: "Гончаров П. И.", year: 2019, publisher: UP, pages: 330, color: "micro", format: "print", shelf: "Математика", copies: 110, available: 40 },
];

/** Выдачи: [логин, книга, вид, взята, срок, вернул?, продлений, инв. номер]. Срок «Экономикса» совпадает с уведомлением. */
export const LOANS: [string, string, "semester" | "short" | "hold", string, string, string | null, number, string][] = [
  ["a.vorontsova", "economix", "short", "2026-11-06T14:20", "2026-11-20T10:00", null, 0, "УБ-104512"],
  ["a.vorontsova", "micro-textbook", "semester", "2026-09-02T12:00", "2027-06-30T18:00", null, 0, "УБ-221087"],
  ["a.vorontsova", "econometrics", "semester", "2026-09-02T12:05", "2027-06-30T18:00", null, 0, "УБ-219340"],
  ["a.vorontsova", "case-book", "semester", "2026-09-03T15:40", "2027-06-30T18:00", null, 0, "УБ-301776"],
  ["a.vorontsova", "supply-chains", "short", "2026-11-12T16:10", "2026-11-26T18:00", null, 0, "УБ-118204"],
  ["a.vorontsova", "stats-intro", "semester", "2026-02-10T12:00", "2026-06-30T18:00", "2026-06-24T13:10", 0, "УБ-098311"],
  ["a.vorontsova", "linear-algebra", "semester", "2026-02-10T12:02", "2026-06-30T18:00", "2026-06-24T13:12", 0, "УБ-077520"],
  ["a.vorontsova", "management", "short", "2026-03-15T11:00", "2026-03-29T18:00", "2026-04-08T10:30", 1, "УБ-145002"],
  ["a.vorontsova", "vienna", "short", "2026-10-05T12:30", "2026-10-19T18:00", "2026-10-17T12:00", 0, "УБ-160233"],
  ["m.orlov", "world-politics", "short", "2026-11-12T13:00", "2026-11-26T18:00", null, 1, "УБ-087199"],
  ["m.orlov", "ir-theory", "semester", "2026-09-01T12:00", "2027-06-30T18:00", null, 0, "УБ-240558"],
  ["n.lanskaya", "marketing-basics", "semester", "2026-09-04T12:00", "2027-06-30T18:00", null, 0, "УБ-330145"],
];

/** Электронные книги, которые читают: [логин, книга, страница, когда]. */
export const READINGS: [string, string, number, string][] = [
  ["a.vorontsova", "micro-problems", 42, "2026-11-18T22:10"],
  ["a.vorontsova", "supply-chains", 118, "2026-11-17T20:40"],
  ["a.vorontsova", "academic-writing", 12, "2026-11-10T19:00"],
  ["m.orlov", "diplomacy-reader", 210, "2026-11-16T21:00"],
];

// ---------- Печать ----------
/** [логин, файл, страниц, копий, цвет, двусторонняя, статус, принтер, когда отправлен] */
export const PRINT_JOBS: [string, string, number, number, boolean, boolean, "held" | "printed", string | null, string][] = [
  ["a.vorontsova", "Эссе_цепочки_поставок_черновик.pdf", 7, 1, false, true, "held", null, "2026-11-19T10:52"],
  ["a.vorontsova", "Problem_set_6_условия.pdf", 3, 1, false, true, "printed", "p-c1", "2026-11-17T09:12"],
  ["a.vorontsova", "Слайды_лекция_11_эконометрика.pdf", 18, 1, false, true, "printed", "p-a1", "2026-11-12T13:40"],
  ["a.vorontsova", "Постер_дебатного_турнира.png", 1, 4, true, false, "printed", "p-b2", "2026-11-10T17:05"],
  ["a.vorontsova", "Венская_конвенция_ст_1-34.pdf", 12, 1, false, true, "printed", "p-lib", "2026-11-05T15:20"],
  ["m.orlov", "Доклад_внешняя_политика.pdf", 9, 2, false, true, "held", null, "2026-11-19T09:40"],
  ["m.orlov", "Аналитическая_записка.pdf", 6, 1, false, true, "printed", "p-a3", "2026-11-11T12:00"],
];
/** [логин, файл, страниц, размер, принтер, когда] */
export const SCANS: [string, string, number, number, string, string][] = [
  ["a.vorontsova", "Скан 18-11-21-04.pdf", 2, 610_000, "p-c1", "2026-11-18T21:04"],
  ["a.vorontsova", "Скан 03-11-12-40.pdf", 5, 1_540_000, "p-lib", "2026-11-03T12:40"],
];
