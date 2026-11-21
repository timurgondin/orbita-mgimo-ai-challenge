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
  about: string;
}

const UP = "Издательство Университета Будущего";
const OUP = "Orbita University Press";
export const BOOKS: BookDef[] = [
  { slug: "economix", title: "Экономикс", author: "Ричардс Л., Брэдли Т.", year: 2022, publisher: "Деловая книга", pages: 980, color: "micro", format: "both", shelf: "Экономика", course: "micro-24", copies: 14, available: 3, about: "Классический вводный курс: от спроса и предложения до макроэкономической политики, с кейсами и графиками в каждой главе." },
  { slug: "micro-textbook", title: "Микроэкономика: учебник для бакалавров", author: "Петрова Е. А.", year: 2024, publisher: UP, pages: 512, color: "micro", format: "both", shelf: "Экономика", course: "micro-24", copies: 180, available: 22, about: "Основной учебник курса: теория потребителя и фирмы, рыночные структуры, провалы рынка. Задачи в конце каждой главы." },
  { slug: "micro-problems", title: "Задачи по микроэкономике с решениями", author: "Ларионов П. О.", year: 2023, publisher: UP, pages: 184, color: "micro", format: "ebook", shelf: "Экономика", course: "micro-24", copies: 0, available: 0, about: "Двести задач к семинарам с подробными решениями — от эластичности до олигополии." },
  { slug: "econometrics", title: "Эконометрика для бакалавров: от регрессии к причинности", author: "Соколов Д. В.", year: 2023, publisher: UP, pages: 436, color: "econ", format: "both", shelf: "Анализ данных", course: "econometrics-24", copies: 150, available: 9, about: "Регрессия, тесты, инструментальные переменные и разности разностей — на реальных данных и без лишних доказательств." },
  { slug: "econometrics-r", title: "Практикум по эконометрике в R и Python", author: "Ахмедова Л. Р.", year: 2025, publisher: UP, pages: 220, color: "econ", format: "ebook", shelf: "Анализ данных", course: "econometrics-24", copies: 0, available: 0, about: "Код к каждой теме курса: загрузить данные, оценить модель, проверить допущения и нарисовать график." },
  { slug: "supply-chains", title: "Глобальные цепочки поставок после 2022 года", author: "Ким А. С.", year: 2024, publisher: UP, pages: 296, color: "world", format: "both", shelf: "Мировая экономика", course: "world-economy-24", copies: 40, available: 6, about: "Как перестраивается мировая торговля: релокация производств, новые маршруты и роль санкций." },
  { slug: "trade-reviews", title: "Обзоры мировой торговли: сборник", author: "Под ред. Ким А. С.", year: 2025, publisher: UP, pages: 160, color: "world", format: "ebook", shelf: "Мировая экономика", course: "world-economy-24", copies: 0, available: 0, about: "Короткие обзоры по регионам и отраслям — материал для эссе и семинаров." },
  { slug: "case-book", title: "Business English Case Book B2", author: "Morgan K.", year: 2022, publisher: OUP, pages: 208, color: "eng", format: "print", shelf: "Иностранные языки", course: "english-b2", copies: 120, available: 14, about: "Двадцать бизнес-кейсов с лексикой, ролевыми играми и письменными заданиями уровня B2." },
  { slug: "vienna", title: "Венская конвенция 1980 года: комментарий для практиков", author: "Орлова М. И.", year: 2023, publisher: UP, pages: 388, color: "law", format: "print", shelf: "Право", course: "intl-law-24", copies: 12, available: 2, about: "Постатейный комментарий к конвенции о международной купле-продаже с судебной практикой." },
  { slug: "law-cases", title: "Сборник казусов по международному праву", author: "Шевченко А. В.", year: 2024, publisher: UP, pages: 144, color: "law", format: "ebook", shelf: "Право", course: "intl-law-24", copies: 0, available: 0, about: "Казусы к семинарам: условие, вопросы и ссылки на нормы — решения разбираются на занятиях." },
  { slug: "protocol", title: "Протокол и власть: церемониал на конференциях XIX века", author: "Белов Г. Н.", year: 2022, publisher: UP, pages: 264, color: "hist", format: "both", shelf: "История", course: "diplomacy-history-24", copies: 8, available: 0, about: "Как рассадка, порядок речей и титулы влияли на исход переговоров великих держав." },
  { slug: "diplomacy-reader", title: "Хрестоматия по истории дипломатии", author: "Сост. Белов Г. Н.", year: 2021, publisher: UP, pages: 610, color: "hist", format: "ebook", shelf: "История", course: "diplomacy-history-24", copies: 0, available: 0, about: "Договоры, ноты и мемуары от Вестфальского мира до середины XX века с комментариями." },
  { slug: "world-politics", title: "Мировая политика: учебник", author: "Ланской Р. Д.", year: 2021, publisher: "Аспект", pages: 540, color: "world", format: "print", shelf: "Международные отношения", course: "ir-theory-22", copies: 25, available: 0, about: "Акторы, институты и конфликты современного мира — базовый учебник для старших курсов." },
  { slug: "ir-theory", title: "Теория международных отношений: учебник", author: "Громов В. П.", year: 2022, publisher: UP, pages: 470, color: "econ", format: "both", shelf: "Международные отношения", course: "ir-theory-22", copies: 90, available: 11, about: "Реализм, либерализм, конструктивизм и их критики — с примерами из истории и новостей." },
  { slug: "marketing-basics", title: "Маркетинг: первые шаги", author: "Лебедева Т. Р.", year: 2025, publisher: UP, pages: 240, color: "micro", format: "both", shelf: "Маркетинг", course: "marketing-intro-26", copies: 160, available: 31, about: "Сегменты, позиционирование и исследования рынка — для первого курса, с заданиями к каждой теме." },
  { slug: "economics-basics", title: "Основы экономики", author: "Дроздов А. М.", year: 2025, publisher: UP, pages: 368, color: "econ", format: "both", shelf: "Экономика", course: "economics-basics-26", copies: 200, available: 27, about: "Спрос и предложение, рынки, деньги и государство — простым языком и с задачами к каждой лекции первого курса." },
  { slug: "academic-writing", title: "Как писать академические тексты", author: "Центр академического письма", year: 2025, publisher: UP, pages: 128, color: "econ", format: "ebook", shelf: "Навыки", copies: 0, available: 0, about: "Структура эссе и курсовой, аргументация, цитирование и типичные ошибки — коротко и с примерами." },
  { slug: "data-python", title: "Python для анализа данных: практикум", author: "Цифровая кафедра", year: 2025, publisher: UP, pages: 310, color: "py", format: "ebook", shelf: "Анализ данных", copies: 0, available: 0, about: "Pandas, графики и первые модели: тетрадки с заданиями, которые можно запускать сразу." },
  { slug: "stats-intro", title: "Статистика: просто о сложном", author: "Соколов Д. В.", year: 2021, publisher: UP, pages: 350, color: "econ", format: "both", shelf: "Анализ данных", copies: 60, available: 17, about: "Выборки, распределения и проверка гипотез на понятных примерах — без страха перед формулами." },
  { slug: "management", title: "Теория менеджмента", author: "Захарова О. В.", year: 2020, publisher: UP, pages: 400, color: "world", format: "print", shelf: "Менеджмент", copies: 70, available: 25, about: "Школы управления от Тейлора до agile, организационные структуры и мотивация." },
  { slug: "linear-algebra", title: "Линейная алгебра для экономистов", author: "Гончаров П. И.", year: 2019, publisher: UP, pages: 330, color: "micro", format: "print", shelf: "Математика", copies: 110, available: 40, about: "Матрицы, системы уравнений и собственные числа — с приложениями к моделям межотраслевого баланса." },
  { slug: "game-theory", title: "Теория игр для экономистов", author: "Миронова А. Л.", year: 2024, publisher: UP, pages: 320, color: "micro", format: "both", shelf: "Экономика", copies: 30, available: 7, about: "Равновесие Нэша, повторяющиеся игры и аукционы — на примерах из рынков и переговоров." },
  { slug: "behavioral", title: "Поведенческая экономика: почему мы ошибаемся", author: "Ярцева К. М.", year: 2025, publisher: "Деловая книга", pages: 288, color: "micro", format: "both", shelf: "Экономика", copies: 25, available: 0, about: "Эвристики, искажения и подталкивание: что эксперименты говорят о реальных решениях людей." },
  { slug: "negotiations", title: "Переговоры: от позиции к интересам", author: "Остапенко В. Г.", year: 2023, publisher: "Деловая книга", pages: 256, color: "hist", format: "print", shelf: "Международные отношения", copies: 20, available: 3, about: "Подготовка, тактики и разбор известных переговоров — практическое руководство с упражнениями." },
  { slug: "multilateral", title: "Многосторонняя дипломатия в XXI веке", author: "Зорин И. П.", year: 2024, publisher: UP, pages: 352, color: "world", format: "both", shelf: "Международные отношения", copies: 18, available: 5, about: "Как работают международные организации, форумы и коалиции и почему консенсус так сложно достичь." },
  { slug: "history-ir", title: "История международных отношений: 1648–1945", author: "Белов Г. Н.", year: 2023, publisher: UP, pages: 560, color: "hist", format: "both", shelf: "История", copies: 45, available: 6, about: "От Вестфальской системы до конца Второй мировой: союзы, кризисы и мирные конгрессы." },
  { slug: "cold-war", title: "Холодная война: документы и интерпретации", author: "Лаврентьева О. Д.", year: 2021, publisher: UP, pages: 430, color: "hist", format: "ebook", shelf: "История", copies: 0, available: 0, about: "Рассекреченные документы и споры историков о причинах и поворотных точках противостояния." },
  { slug: "integration-law", title: "Право интеграционных объединений", author: "Карпова Н. С.", year: 2022, publisher: UP, pages: 410, color: "law", format: "print", shelf: "Право", copies: 22, available: 7, about: "Учреждение, органы и право региональных объединений: сравнение моделей интеграции." },
  { slug: "contracts", title: "Международные контракты: практикум", author: "Шевченко А. В.", year: 2025, publisher: UP, pages: 196, color: "law", format: "both", shelf: "Право", copies: 35, available: 12, about: "Как составить и проверить внешнеторговый договор: оговорки, риски, споры. Шаблоны в приложении." },
  { slug: "ml-social", title: "Машинное обучение для социальных наук", author: "Белкин Р. А.", year: 2025, publisher: UP, pages: 280, color: "py", format: "both", shelf: "Анализ данных", copies: 15, available: 3, about: "Классификация, кластеризация и тексты как данные — с осторожностью к выводам о причинах." },
  { slug: "sql-basics", title: "SQL и базы данных: с нуля до отчёта", author: "Белкин Р. А.", year: 2024, publisher: UP, pages: 230, color: "py", format: "ebook", shelf: "Анализ данных", copies: 0, available: 0, about: "Запросы, объединения и агрегаты на учебной базе данных — от первого SELECT до дашборда." },
  { slug: "grammar-c1", title: "English Grammar in Practice C1", author: "Hayes J.", year: 2023, publisher: OUP, pages: 320, color: "eng", format: "print", shelf: "Иностранные языки", copies: 60, available: 18, about: "Сложные времена, инверсия и стилистика: упражнения с ключами для самостоятельной работы." },
  { slug: "french-business", title: "Le français des affaires B1", author: "Moreau C.", year: 2022, publisher: OUP, pages: 240, color: "eng", format: "print", shelf: "Иностранные языки", copies: 40, available: 9, about: "Деловой французский: переписка, встречи и презентации. Аудио — по QR в книге." },
  { slug: "digital-marketing", title: "Цифровой маркетинг: метрики и эксперименты", author: "Лебедева Т. Р.", year: 2026, publisher: UP, pages: 260, color: "micro", format: "both", shelf: "Маркетинг", copies: 40, available: 15, about: "Воронки, юнит-экономика и A/B-тесты: как отличить рост от случайности." },
  { slug: "strategy", title: "Стратегия компании: инструменты анализа", author: "Захарова О. В.", year: 2024, publisher: UP, pages: 300, color: "world", format: "both", shelf: "Менеджмент", copies: 30, available: 6, about: "Пять сил, цепочка ценности и сценарии — с кейсами российских и зарубежных компаний." },
  { slug: "calculus", title: "Математический анализ для экономистов", author: "Гончаров П. И.", year: 2021, publisher: UP, pages: 420, color: "micro", format: "print", shelf: "Математика", copies: 120, available: 35, about: "Пределы, производные и оптимизация — всё, что нужно для микро- и макроэкономики." },
  { slug: "probability", title: "Теория вероятностей: задачи и решения", author: "Гончаров П. И.", year: 2022, publisher: UP, pages: 260, color: "econ", format: "both", shelf: "Математика", copies: 80, available: 21, about: "Комбинаторика, случайные величины и предельные теоремы — триста задач с разбором." },
  { slug: "public-speaking", title: "Публичное выступление: как говорить с залом", author: "Савельева Д. А.", year: 2024, publisher: UP, pages: 176, color: "eng", format: "ebook", shelf: "Навыки", copies: 0, available: 0, about: "Структура речи, работа с волнением и вопросами из зала — для защит, конференций и дебатов." },
];

/** Выдачи: [логин, книга, вид, взята, срок, вернул?, продлений, инв. номер]. Срок «Экономикса» совпадает с уведомлением. */
export const LOANS: [string, string, "semester" | "short", string, string, string | null, number, string][] = [
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

/** Заказы из каталога: [логин, книга, пункт, этап, оформлен, готов к, забрать до, ячейка]. Экземпляры уже вычтены из available. */
export const ORDERS: [string, string, string, "packing" | "transit" | "ready", string, string, string | null, string | null][] = [
  ["a.vorontsova", "game-theory", "locker-a", "ready", "2026-11-18T13:20", "2026-11-19T09:40", "2026-11-22T21:00", "14"],
  ["a.vorontsova", "negotiations", "locker-b", "transit", "2026-11-19T10:15", "2026-11-20T12:00", null, null],
  ["n.lanskaya", "economics-basics", "locker-a", "ready", "2026-11-17T10:00", "2026-11-18T09:30", "2026-11-25T21:00", "07"],
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

// ---------- Random Coffee: вымышленные студенты других факультетов (входа нет) и встречи демо-студентов ----------
export interface CoffeePersonDef {
  first: string; last: string; faculty: string; program: string; course: number; avatar: string; tg: string; interests: string[]; format: "campus" | "online" | "any";
}
export const COFFEE_PEOPLE: CoffeePersonDef[] = [
  { first: "Егор", last: "Миронов", faculty: "Факультет международных отношений", program: "Мировая политика", course: 3, avatar: "mist", tg: "egor_mrn", interests: ["Кино", "Настолки", "Дебаты", "Стартапы", "Политика"], format: "campus" },
  { first: "Вера", last: "Ткачёва", faculty: "Факультет медиакоммуникаций", program: "Медиаменеджмент", course: 2, avatar: "peach", tg: "vera_tk", interests: ["Фотография", "Кино", "Путешествия", "Книги"], format: "campus" },
  { first: "Илья", last: "Субботин", faculty: "Факультет права", program: "Международное право", course: 3, avatar: "stone", tg: "ilya_sbt", interests: ["Дебаты", "Бег", "Политика", "Финансы"], format: "any" },
  { first: "Ксения", last: "Рябова", faculty: "Факультет экономики", program: "Экономика и данные", course: 4, avatar: "lilac", tg: "ks_ryabova", interests: ["ИИ", "Стартапы", "Йога", "Языки"], format: "campus" },
  { first: "Даниил", last: "Кравец", faculty: "Факультет экономики", program: "Финансы", course: 1, avatar: "sand", tg: "dan_kravets", interests: ["Финансы", "Стартапы", "Бег", "Музыка"], format: "campus" },
  { first: "Ульяна", last: "Зорина", faculty: "Факультет медиакоммуникаций", program: "Реклама и связи с общественностью", course: 3, avatar: "peach", tg: "ulya_zr", interests: ["Дизайн", "Музыка", "Театр", "Кулинария"], format: "any" },
  { first: "Арсений", last: "Гордеев", faculty: "Факультет международных отношений", program: "Востоковедение", course: 2, avatar: "mist", tg: "ars_gordeev", interests: ["Языки", "Путешествия", "Книги", "Настолки"], format: "campus" },
  { first: "Мирослава", last: "Чернова", faculty: "Факультет права", program: "Право и технологии", course: 2, avatar: "lilac", tg: "mira_ch", interests: ["ИИ", "Дебаты", "Театр", "Волонтёрство"], format: "online" },
  { first: "Роман", last: "Белов", faculty: "Факультет международного бизнеса", program: "Логистика", course: 4, avatar: "stone", tg: "roman_belov", interests: ["Бег", "Фотография", "Кулинария", "Путешествия"], format: "campus" },
  { first: "Таисия", last: "Лебедева", faculty: "Факультет экономики", program: "Экономика и данные", course: 1, avatar: "sand", tg: "taya_lbd", interests: ["Кино", "Книги", "Волонтёрство", "Йога"], format: "any" },
];

export const COFFEE_PROFILES: [string, string[], "campus" | "online" | "any"][] = [
  ["a.vorontsova", ["Стартапы", "Кино", "Настолки", "Языки", "Бег"], "campus"],
];

/** [логин, № человека в COFFEE_PEOPLE, неделя (пн), начало, место, ответ студента, ответ пары, состоялась, отменена] */
export const COFFEE_MATCHES: [string, number, string, string, string, "new" | "yes" | "skip", "new" | "yes" | "skip", boolean | null, boolean][] = [
  ["a.vorontsova", 0, "2026-11-16", "2026-11-20T12:30", "Кофейня «Зерно», корпус А", "new", "yes", null, false],
  ["a.vorontsova", 1, "2026-11-09", "2026-11-12T16:00", "Терраса библиотеки, 3 этаж", "yes", "yes", null, false],
  ["a.vorontsova", 2, "2026-11-02", "2026-11-04T12:30", "Кафе в атриуме, корпус Б", "yes", "yes", true, false],
  ["a.vorontsova", 3, "2026-10-26", "2026-10-27T14:20", "Кофейня «Зерно», корпус А", "yes", "yes", true, false],
];
