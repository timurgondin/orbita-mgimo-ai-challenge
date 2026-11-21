// Значения-перечисления: в БД лежат строками, типы — здесь.

export interface PersonRef {
  name: string;
  initials: string;
  avatar: string;
}

export interface ProfileView {
  /** карточка старосты в поиске людей */
  headmanHref: string | null;
  login: string;
  /** приватность в поиске людей */
  showPhone: boolean;
  showTelegram: boolean;
  student: boolean;
  email: string;
  phone: string | null;
  telegram: string | null;
  faculty: string | null;
  position: string | null;
  program: string | null;
  programSub: string | null;
  group: string | null;
  studyForm: string | null;
  recordBook: string | null;
  curator: PersonRef | null;
  headman: PersonRef | null;
  hasCard: boolean;
  /** сводка архива: сколько семестров позади и средний балл; null — архив пуст */
  archive: { semesters: number; average: string | null } | null;
}

export interface StudentCardView {
  name: string;
  meta: string;
  number: string;
  validUntil: string;
  /** своё фото или null (монограмма) */
  photo: string | null;
  initials: string;
  avatar: string;
  /** SVG QR-кода (генерирует сервер библиотекой qrcode; ведёт на /verify/<токен>?c=<подписанный код на 10 с>) */
  qr: string;
  /** Сколько мс QR ещё действует до смены */
  ttl: number;
}
export type CourseFormat = "offline" | "online";
export type Assessment = "exam" | "credit";
export type ComponentKind = "test" | "homework" | "essay" | "project" | "exam" | "participation";
export type WorkStatus = "upcoming" | "draft" | "in_progress" | "submitted" | "reviewing" | "graded" | "returned";
export type EventKind = "lecture" | "seminar" | "practice" | "consultation" | "test";
export type NotificationKind = "grade" | "document" | "announcement" | "schedule" | "library" | "material" | "security" | "office" | "deadline" | "coffee";
export type NotificationCategory = "study" | "schedule" | "office" | "library" | "announcement" | "security";
export type NotificationLevel = "action" | "important" | "info";

/** Компоненты, которые студент сдаёт как задания (не участие и не экзамен). */
export const TASK_KINDS: ComponentKind[] = ["test", "homework", "essay", "project"];

export interface Lesson {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  start: string;
  end: string;
  title: string;
  format?: string;
  place: { label: "ауд." | "каб." | ""; number: string };
  teacher: string;
  note?: { kind: "flag" | "ok"; text: string };
}

export interface SoonItem {
  id: string;
  /** куда ведёт строка: окно задания или контрольная в расписании */
  href: string;
  title: string;
  course: string;
  /** ключ цвета курса */
  color: string;
  /** «черновик», «на проверке» или «20% оценки» */
  note: string;
  /** Метка срока */
  due: string;
  today: boolean;
}

export type NewsAvatar =
  | { kind: "initials"; text: string; gradient: string }
  | { kind: "icon"; icon: NotificationKind };

/** Уведомление для центра и «Нового». Правила — docs/notifications.md. */
export interface NewsItem {
  id: string;
  /** тип — подпись и значок: «Оценка», «Расписание», «Безопасность» */
  kind: NotificationKind;
  category: NotificationCategory;
  level: NotificationLevel;
  title: string;
  subtitle: { before?: string; emphasis?: string; after?: string };
  /** «10:05», «Вчера», «Пн», «12 ноября» */
  time: string;
  group: "Сегодня" | "Вчера" | "Ранее";
  unread: boolean;
  /** action, который ещё не решён */
  pending: boolean;
  /** срок для action: «До завтра, 10:00» */
  due?: string;
  /** срок ближе суток — полоса наверху «Сегодня» */
  urgent: boolean;
  href: string | null;
  action?: { label: string; kind: "resolve" | "link" };
  avatar: NewsAvatar;
}

export interface NotificationCenterData {
  items: NewsItem[];
  /** число на колокольчике: нерешённые «нужно действие» */
  actions: number;
  /** точка на колокольчике: есть непрочитанное важное */
  dot: boolean;
}

export interface FormulaSegment {
  weight: number;
  state: "done" | "pending" | "empty";
}

export interface CourseCardData {
  id: string;
  /** адрес страницы курса: /study/<slug> */
  slug: string;
  color: string;
  kindLabel: string;
  title: string;
  teacher: string;
  /** Крупное значение: «8,1», «Зачёт», «6» */
  score: string;
  /** Мелкое: «из 10», «из 12» */
  scoreSuffix: string;
  formula: FormulaSegment[];
  /** Для онлайн-курса: доля пройденных уроков, % */
  progress?: number;
}

export type TagKind = "upcoming" | "draft" | "in_progress" | "submitted" | "reviewing" | "returned";

/** Этап задания для трекера «как у посылки»: начато → сдано → проверка → оценка. */
export interface TaskStep {
  label: string;
  when: string;
  state: "fin" | "cur" | "todo";
}

export type AssignmentKind = "homework" | "essay" | "project";

/** Задание курса со всем, что нужно для строки списка и окна. */
export interface TaskDetail {
  /** id задания */
  id: string;
  courseSlug: string;
  courseTitle: string;
  color: string;
  kind: AssignmentKind;
  /** «Домашнее задание», «Эссе», «Для практики» */
  kindLabel: string;
  title: string;
  /** куда идёт балл: «В «Домашние задания» — 20% оценки»; null — не входит в оценку */
  counts: string | null;
  /** статус для тега; null — тег не нужен (впереди или уже проверено) */
  tag: TagKind | null;
  /** «Четверг, 19 ноября, 23:59» */
  dueLong: string | null;
  /** «Сегодня, 23:59» / «Сб, 18:00» / «3 декабря» */
  dueShort: string | null;
  /** «23:59» */
  dueTime: string | null;
  /** для блока даты слева: «19» и «чт» / «дек» */
  dueDay: string | null;
  dueSub: string | null;
  /** до срока меньше суток */
  dueHot: boolean;
  /** сколько осталось: «2 дня 6 ч», «5 ч»; null — уже сдано или проверено */
  left: string | null;
  room: string | null;
  /** пара в расписании, где пишется работа: /time?open=<id> */
  eventId: string | null;
  description: string | null;
  /** «8», «8,2»; null — без балла */
  score: string | null;
  /** проверено (с баллом или без) */
  done: boolean;
  gradedAt: string | null;
  /** «Ноябрь» — для группировки проверенных по месяцам */
  gradedMonth: string | null;
  submittedAt: string | null;
  feedback: string | null;
  teacher: { name: string; initials: string; gradient: string };
  /** трекер этапов; null — задание не сдаётся */
  steps: TaskStep[] | null;
  upload: boolean;
  file: { name: string; size: string } | null;
  /** можно прикрепить или заменить файл (черновик) */
  canAttach: boolean;
  /** файл прикреплён — можно отправить на проверку */
  canSubmit: boolean;
  /** отправлено, но проверять ещё не начали */
  canWithdraw: boolean;
}

/** Элемент формулы оценки на странице курса. */
export interface FormulaItem {
  id: string;
  title: string;
  kindLabel: string;
  weight: number;
  state: FormulaSegment["state"];
  score: string | null;
  /** «проверено 5 из 7», «28 ноября», «по занятиям» */
  sub: string;
  hot: boolean;
  description: string | null;
  dueLong: string | null;
  room: string | null;
  eventId: string | null;
  /** балл — среднее по заданиям */
  aggregate: boolean;
  tasks: { id: string; title: string; score: string | null; status: string }[];
  /** контрольные и экзамены: формат, темы, демоверсия */
  prepare: ComponentPrepare | null;
}

/** Подготовка к контролю (GradeComponent.prepare, JSON). */
export interface ComponentPrepare {
  format?: string;
  /** что можно взять с собой */
  allowed?: string;
  topics: string[];
  demo?: { minutes: number; tasks: { text: string; points: number }[] };
  /** где ещё материалы: «Задачи для самопроверки — в материалах курса» */
  materials?: string;
}

export interface PerfRowData {
  id: string;
  slug: string;
  color: string;
  title: string;
  sub: string;
  fill: number;
  value: string;
  valueMuted: boolean;
  forecast: string;
}

export interface ExamData {
  id: string;
  slug: string;
  day: string;
  month: string;
  title: string;
  time: string;
  room: string | null;
}

export interface StudyData {
  courses: CourseCardData[];
  online: CourseCardData[];
  /** срок в ближайшие 10 дней */
  upcoming: TaskDetail[];
  /** срок дальше */
  later: TaskDetail[];
  /** сданы и ждут проверки */
  waiting: TaskDetail[];
  /** подготовка к занятиям: не сдаётся и не оценивается */
  checked: TaskDetail[];
  perf: {
    average: string;
    rank: number | null;
    size: number | null;
    /** «топ-N%» по накопленному рейтингу */
    top: number | null;
    credits: number | null;
    creditsPlan: number;
    rows: PerfRowData[];
    exams: ExamData[];
  };
}

// ---- Время ----
export interface TimeLesson {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  pair: number;
  start: string;
  end: string;
  color: string;
  courseTitle: string;
  /** Название строки: предмет или «Контрольная №2» */
  title: string;
  isTest: boolean;
  kind: EventKind;
  kindLabel: string;
  topic?: string;
  room: string;
  roomFrom?: string;
  teacher: string;
  teacherInitials: string;
  teacherGradient: string;
  /** карточка преподавателя /people/<slug> */
  teacherSlug: string | null;
  courseSlug: string;
  /** что сделать к занятию */
  prep: string | null;
  /** контрольная: вес, текущий балл, сколько тем и есть ли демоверсия (открываются на странице курса, ?comp=) */
  test?: { weight: number; score: string | null; componentId: string; topics: number; demo: boolean };
}

export interface TimeConsultation {
  id: string;
  date: string;
  pair: number;
  start: string;
  end: string;
  color: string;
  courseId: string;
  courseTitle: string;
  teacher: string;
  teacherInitials: string;
  teacherGradient: string;
  place: string;
  online: boolean;
  count: number;
  capacity: number;
  /** Сколько записавшихся уже прислали вопрос */
  questions: number;
  going: boolean;
  myQuestion: string;
  past: boolean;
}

export interface TimeData {
  /** Понедельник текущей недели, YYYY-MM-DD */
  baseMonday: string;
  lessons: TimeLesson[];
  consultations: TimeConsultation[];
  syncLink: string;
}

// ---- Офис ----
export interface OfficeStep {
  label: string;
  /** «18 нояб», «сейчас» или пусто */
  when: string;
  state: "fin" | "cur" | "todo";
  /** этап на паузе: офис ждёт документ от студента */
  wait?: boolean;
}
export interface OfficeEvent {
  state: "fin" | "cur" | "todo";
  title: string;
  small: string;
  at: string;
}
export interface OfficeMessage {
  id: string;
  authorName: string;
  initials: string;
  staff: boolean;
  body: string;
}
export interface OfficeRequestView {
  id: string;
  number: string;
  typeId: string;
  title: string;
  subtitle: string;
  status: string;
  eta: string;
  steps: OfficeStep[];
  events: OfficeEvent[];
  messages: OfficeMessage[];
  canWithdraw: boolean;
  /** офис ждёт документ от студента */
  waiting: { doc: string; due: string | null } | null;
  files: { id: string; label: string; name: string; size: string; at: string }[];
}
export interface OfficeDocView {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  status: string;
  /** «Вчера», «2 октября» */
  when: string;
  heading: string;
  issuedDate: string; // 18.11.2026
  issuedTime: string; // 16:41
  paragraphs: string[];
  signedBy: string;
  verifyUrl: string;
  qrSvg: string;
}
export interface OfficeData {
  requests: OfficeRequestView[];
  documents: OfficeDocView[];
  open: boolean;
}

// ---- Архив: прошлые семестры ----
export interface ArchiveCourse {
  id: string;
  title: string;
  color: string;
  assessment: Assessment;
  credits: number;
  /** «9» или «Зачёт» */
  grade: string;
  /** «отлично»; у зачёта — пусто */
  gradeWord: string;
  passed: boolean;
  teacher: string;
  teacherInitials: string;
  teacherGradient: string;
  /** «22 декабря 2025» */
  closedAt: string;
  /** взвешенная сумма до округления: «8,7» */
  total: string;
  components: { title: string; weight: number; score: string }[];
}

export interface ArchiveSemester {
  /** номер семестра обучения: 1 — осень первого курса */
  n: number;
  /** курс обучения */
  year: number;
  /** «1 курс, 1 семестр» */
  title: string;
  /** «1 семестр» — когда курс уже выбран переключателем */
  short: string;
  /** «осень 2025» */
  season: string;
  /** средний балл по экзаменам, взвешен по кредитам */
  average: string | null;
  credits: number;
  courses: ArchiveCourse[];
}

export interface ArchiveData {
  average: string | null;
  credits: number;
  creditsPlan: number;
  passed: number;
  /** от новых к старым */
  semesters: ArchiveSemester[];
}


// ---- Страница курса ----
export interface CourseNavItem {
  slug: string;
  title: string;
  color: string;
  online: boolean;
}

export interface CourseLesson {
  id: string;
  day: string;
  /** «пн», «вт» */
  weekday: string;
  /** «Семинар «Олигополия»» */
  title: string;
  start: string;
  end: string;
  room: string;
  /** сегодня */
  today: boolean;
  /** что сделать к занятию */
  prep: string | null;
}

export interface StaffRef {
  slug: string;
  name: string;
  initials: string;
  gradient: string;
  /** «Лекции», «Семинары» */
  role: string;
  position: string;
}

/** Программа дисциплины (JSON в Course.syllabus). */
export interface Syllabus {
  code: string;
  hours: { lectures: number; seminars: number; self: number };
  annotation: string;
  outcomes: string[];
  topics: string[];
  literature: { main: string[]; extra: string[] };
  questions: string[];
  approved: string;
}

export interface CoursePageData {
  nav: CourseNavItem[];
  slug: string;
  title: string;
  color: string;
  kindLabel: string;
  online: boolean;
  /** онлайн-курс: кто ведёт */
  provider: string | null;
  staff: StaffRef[];
  credits: number;
  assessment: Assessment;
  /** «Экзамен», «Зачёт» */
  finalLabel: string;
  /** «8,1» */
  score: string | null;
  /** «8» — округлённый прогноз */
  forecast: string | null;
  /** доля формулы, по которой уже есть оценки, % */
  doneWeight: number;
  formula: FormulaSegment[];
  components: FormulaItem[];
  tasks: TaskDetail[];
  /** для калькулятора: Σ балл·вес по оценённым и вес ещё не оценённых */
  calc: { gradedSum: number; remainingWeight: number; examOnly: boolean } | null;
  autoPass: { from: string; rule: string; ok: boolean; gap: string | null } | null;
  lessons: CourseLesson[];
  consultation: { id: string; when: string; place: string } | null;
  syllabus: Syllabus | null;
  /** шапка документов: «Факультет международного бизнеса», «Международный бизнес», «3 семестр» */
  docMeta: { faculty: string; program: string; semester: string; exam: string };
  lessonsDone?: number;
  lessonsTotal?: number;
  nextLesson?: { title: string; minutes: number } | null;
}

/** Страница преподавателя /people/<slug>. */
export interface TeacherPageData {
  slug: string;
  name: string;
  initials: string;
  gradient: string;
  position: string;
  department: string;
  degree: string | null;
  email: string;
  office: string | null;
  bio: string | null;
  interests: string[];
  publications: { title: string; venue: string; year: number }[];
  /** профили в наукометрических базах: «ORCID», «Google Scholar» + метрика */
  links: { kind: string; label: string; value: string; metric: string | null; href: string }[];
  /** пар на неделе и групп */
  load: { pairs: number; groups: number };
  /** курсы текущего студента у этого преподавателя */
  mine: { slug: string; title: string; color: string; role: string }[];
  /** занятия выбранной недели по дням */
  week: WeekDay[];
  nav: WeekNav;
  consultation: { id: string; when: string; place: string; course: string } | null;
}

/** Пройденный курс (/study/past/<id>): итог, из чего сложился, куда пошёл в диплом. */
export interface PastCoursePage {
  id: string;
  title: string;
  color: string;
  /** «1 курс, 1 семестр» */
  semester: string;
  season: string;
  year: number;
  assessment: Assessment;
  credits: number;
  grade: string;
  gradeWord: string;
  passed: boolean;
  total: string;
  closedAt: string;
  teacher: string;
  teacherInitials: string;
  teacherGradient: string;
  /** карточка преподавателя, если он есть в базе */
  teacherSlug: string | null;
  components: { title: string; weight: number; score: string }[];
  /** строка в дипломе и что там будет */
  diploma: { title: string; note: string };
  /** остальные дисциплины того же семестра — боковой список */
  nav: { id: string; title: string; color: string }[];
  /** номер семестра обучения — ссылка назад на страницу семестра */
  semesterN: number;
  annotation: string | null;
  topics: string[];
  materials: PastMaterialView[];
  works: PastWorkView[];
  exam: { title: string; questions: string[]; note: string } | null;
  /** отзыв преподавателя по итогам */
  review: string | null;
}

/** Материал пройденного курса. n — номер для скачивания (/study/past/<id>/files/<n>), у видео скачивания нет. */
export interface PastMaterialView {
  n: number;
  title: string;
  kind: "slides" | "pdf" | "video" | "doc" | "data";
  meta: string;
  size: string | null;
  group: string;
  download: boolean;
}

export interface PastWorkView {
  title: string;
  kind: string;
  score: string | null;
  date: string;
  feedback: string | null;
  file: string | null;
}

/** «Диплом»: что уже в приложении к диплому, что идёт, что впереди. */
export interface DiplomaRow {
  title: string;
  credits: number;
  /** «9», «Зачёт», «—» */
  grade: string;
  /** «отлично», «зачтено» */
  word: string;
  /** «1–2 семестры», «3 семестр» */
  when: string;
  /** оценки по семестрам для многосеместровых: «9, 9» */
  parts?: string;
  /** ссылка: пройденный курс или текущий */
  href?: string;
  color?: string;
}

export interface DiplomaData {
  done: DiplomaRow[];
  /** закончатся в эту сессию — оценка уйдёт в диплом */
  closing: DiplomaRow[];
  /** идут несколько семестров: часть позади */
  ongoing: (DiplomaRow & { progress: string })[];
  planned: { semester: number; label: string; items: { title: string; credits: number; assessment: Assessment }[] }[];
  stats: { inDiploma: number; total: number; average: string | null; excellentShare: number | null };
  /** диплом с отличием: ≥ 75% «отлично» и нет «удовлетворительно» */
  honors: { ok: boolean; text: string } | null;
}

// ---- Хранимый JSON пройденного курса (PastCourse.content), заполняется сидом ----
export interface PastMaterial {
  title: string;
  kind: "slides" | "pdf" | "video" | "doc" | "data";
  /** «24 слайда», «18 стр.», «1 ч 20 мин» */
  meta: string;
  /** размер в байтах (у видео — нет) */
  size?: number;
  /** раздел: «Лекции», «Семинары», «К экзамену» */
  group: string;
  /** пункты плана — уходят в PDF */
  plan?: string[];
}
export interface PastWork {
  title: string;
  kind: string;
  score: number | null;
  date: string; // YYYY-MM-DD
  feedback?: string;
  file?: string;
}
export interface PastContent {
  annotation: string;
  topics: string[];
  materials: PastMaterial[];
  works: PastWork[];
  exam?: { title: string; ticket: number; questions: string[]; note: string };
  review: string;
}

// ---- Рейтинг ----
export interface RatingPeriod {
  /** накопленный (все сессии до этой) или только этот семестр */
  kind: "cumulative" | "semester";
  semester: number;
  title: string;
  gpa: string;
  rank: number;
  /** «топ-N%» */
  top: number;
  median: string;
  /** распределение однокурсников по среднему баллу, mine — твой столбец */
  bins: { label: string; from: number; count: number; mine: boolean }[];
  /** балл, с которого начинается топ-N% */
  cutoffs: { top: number; gpa: number }[];
  mine: number;
}

export interface RatingData {
  program: string;
  course: number;
  size: number;
  periods: RatingPeriod[];
  perks: { title: string; top: number; note: string; ok: boolean; status: string }[];
}

// ---- Объявления ----
export interface MobilityPage {
  /** требования, сверенные с данными студента: id из MOBILITY.requirements */
  checks: Record<string, { ok: boolean; note: string }>;
  eligible: boolean;
  /** приём заявок ещё идёт */
  open: boolean;
  /** «16 дней» до конца приёма */
  left: string;
  /** своя активная заявка */
  application: { number: string; priorities: string[] } | null;
}

// ---- Клубы ----
export type ClubCategory = "sport" | "mind" | "tech" | "creative" | "career" | "community";
export interface ClubView {
  id: string;
  slug: string;
  title: string;
  category: ClubCategory;
  color: string;
  short: string;
  description: string;
  schedule: string;
  place: string;
  members: number;
  joinMode: "open" | "apply";
  tags: string[];
  highlights: string[];
  leader: { name: string; role: string; initials: string; gradient: string; telegram: string; email: string };
  /** моё участие: состою, заявка у руководителя или нет */
  mine: "member" | "pending" | null;
}

// ---- Библиотека ----
export interface BookCard {
  id: string;
  slug: string;
  title: string;
  author: string;
  year: number;
  publisher: string;
  color: string;
  pages: number;
  shelf: string;
  /** есть печатные экземпляры */
  print: boolean;
  /** есть электронная версия */
  ebook: boolean;
  copies: number;
  available: number;
}

/** Книга в каталоге: что с ней у меня и когда освободится, если все на руках */
export interface CatalogBook extends BookCard {
  about: string | null;
  /** к какому моему курсу (название и цвет), если учебник курса */
  course: { title: string; color: string } | null;
  mine: "loan" | "order" | null;
  reading: boolean;
  /** «Вернут 26 ноября» — ближайший срок возврата, когда свободных нет */
  back: string | null;
}

export interface LoanView {
  id: string;
  book: BookCard;
  kind: "semester" | "short";
  kindLabel: string;
  inventory: string;
  /** «Завтра до 10:00», «До 30 июня» */
  due: string;
  /** срок сегодня или завтра */
  hot: boolean;
  /** сколько срока прошло, % */
  elapsed: number;
  canRenew: boolean;
  renewNote: string;
  renewals: number;
}

/** Заказ из каталога — трекер «как у посылки» */
export interface OrderView {
  id: string;
  book: BookCard;
  status: "packing" | "transit" | "ready";
  steps: { label: string; when: string; state: "fin" | "cur" | "todo" }[];
  point: { id: string; kind: "locker" | "station"; name: string; place: string; hours: string };
  /** «Привезём завтра к 12:00» / «Ячейка 14, заберите до 22 ноября» */
  line: string;
  cell: string | null;
  canCancel: boolean;
}

export interface HistoryItem {
  id: string;
  book: BookCard;
  /** «5 – 17 октября» */
  span: string;
  /** «12 дней» */
  kept: string;
  /** «на 10 дней позже» или null — вовремя */
  late: string | null;
}

export interface PointOption {
  id: string;
  kind: "locker" | "station";
  name: string;
  place: string;
  hours: string;
  /** «Завтра к 12:00» */
  eta: string;
}

export interface LibraryData {
  orders: OrderView[];
  onHand: LoanView[];
  reading: { book: BookCard; page: number; percent: number; last: string }[];
  /** книги к текущим курсам — первой полкой каталога */
  courseBooks: CatalogBook[];
  catalog: CatalogBook[];
  shelves: string[];
  points: PointOption[];
  /** история по семестрам: «Осень 2026», «Весна 2026» */
  history: { title: string; items: HistoryItem[] }[];
  stats: { year: number; pages: number; onTime: string | null; days: number | null };
}

export interface ReaderData {
  book: BookCard;
  page: number;
  pages: number;
  chapter: string;
  chapterStart: boolean;
  paragraphs: string[];
  toc: { title: string; page: number }[];
}

// ---- Печать ----
export interface PrintData {
  held: { id: string; name: string; pages: number; copies: number; color: boolean; duplex: boolean; sheets: number; expires: string }[];
  history: { id: string; name: string; pages: number; color: boolean; where: string; when: string }[];
  scans: { id: string; name: string; pages: number; size: string; where: string; when: string }[];
  quota: { bw: { used: number; total: number }; color: { used: number; total: number }; month: string };
  /** листов сэкономлено двусторонней печатью в этом месяце */
  saved: number;
  /** принтер рядом со следующей парой */
  nearId: string | null;
  nearReason: string | null;
  printers: (import("@/lib/printers").Printer & { name: string })[];
}

// ---- Random Coffee ----

export interface CoffeePerson {
  name: string; // «Егор Миронов»
  initials: string;
  gradient: string;
  study: string; // «Мировая политика, 3 курс»
  faculty: string | null;
  /** карточка в поиске людей */
  href: string;
}

export interface CoffeeSlot {
  startsAt: string; // ISO
  endsAt: string;
}

export interface CoffeeCurrentView {
  id: string;
  partner: CoffeePerson & { interests: string[]; shared: string[]; firstName: string };
  /** Telegram пары — только когда оба согласились */
  telegram: string | null;
  startsAt: string;
  endsAt: string;
  place: string;
  online: boolean;
  mine: "new" | "yes" | "skip";
  theirs: "new" | "yes" | "skip";
  cancelled: boolean;
  alternatives: CoffeeSlot[];
}

export interface CoffeePastView {
  id: string;
  partner: CoffeePerson;
  date: string; // ISO начала
  met: boolean | null;
  cancelled: boolean;
}

export interface CoffeeView {
  profile: { active: boolean; interests: string[]; format: "campus" | "online" | "any" } | null;
  current: CoffeeCurrentView | null;
  nextRound: string; // YYYY-MM-DD
  past: CoffeePastView[];
}

/** Какая неделя открыта в карточке человека и куда можно перейти (понедельники ISO; null — дальше нельзя). */
export interface WeekNav {
  monday: string;
  /** «Эта неделя», «Следующая неделя», «7–12 декабря» */
  label: string;
  /** «16–21 ноября» */
  range: string;
  prev: string | null;
  next: string | null;
}

/** День недели в карточке человека (преподаватель, студент): занятия по порядку, свои — цветом курса. */
export interface WeekDay {
  date: string;
  /** «Пн» */
  dow: string;
  day: string;
  items: { id: string; start: string; end: string; title: string; kind: string; group: string; color: string | null; room: string; teacher: string; mine: boolean }[];
}

/** Строка поиска людей (/people). */
export interface PersonHit {
  kind: "student" | "teacher";
  href: string;
  /** «Беляева Дарья», «Петрова Елена Андреевна» */
  name: string;
  initials: string;
  gradient: string;
  photo: string | null;
  /** студент — «Международный бизнес, 2 курс»; преподаватель — должность */
  sub: string;
  /** группа студента или кафедра преподавателя — справа */
  tag: string | null;
}

/** Круг по умолчанию, пока запрос пуст: своя группа и свои преподаватели. */
export interface PeopleCircle {
  group: string | null;
  classmates: PersonHit[];
  teachers: PersonHit[];
}

/** Карточка студента для других (/people/<логин>): только справочные данные; оценок, рейтинга и формы оплаты нет. */
export interface StudentPageData {
  login: string;
  name: string;
  initials: string;
  gradient: string;
  photo: string | null;
  faculty: string | null;
  program: string | null;
  /** «Бакалавриат, 2 курс» */
  level: string | null;
  group: string | null;
  email: string;
  /** только если студент открыл в профиле */
  telegram: string | null;
  phone: string | null;
  /** своя карточка: так её видят другие; own — свои контакты и настройки для окна «Приватность» */
  me: boolean;
  nav: WeekNav;
  own: { phone: string | null; telegram: string | null; showPhone: boolean; showTelegram: boolean } | null;
  week: WeekDay[];
}
