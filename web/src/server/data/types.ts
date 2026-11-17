// Значения-перечисления: в БД лежат строками, типы — здесь.

export interface PersonRef {
  name: string;
  initials: string;
  avatar: string;
}

export interface ProfileView {
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
  /** SVG QR-кода (генерирует сервер библиотекой qrcode; ведёт на /verify/<токен>) */
  qr: string;
}
export type CourseFormat = "offline" | "online";
export type Assessment = "exam" | "credit";
export type ComponentKind = "test" | "homework" | "essay" | "project" | "exam" | "participation";
export type WorkStatus = "upcoming" | "draft" | "in_progress" | "submitted" | "reviewing" | "graded" | "returned";
export type EventKind = "lecture" | "seminar" | "practice" | "consultation" | "test";
export type NotificationKind = "grade" | "document" | "announcement" | "schedule" | "library" | "material" | "security" | "office" | "deadline";
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
  /** элемент оценки: /study?tab=tasks&task=<id> */
  taskId: string;
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

/** Элемент оценки курса со всем, что нужно для строки списка и окна задания. */
export interface TaskDetail {
  /** id элемента оценки */
  id: string;
  courseSlug: string;
  courseTitle: string;
  color: string;
  kind: ComponentKind;
  /** «Эссе», «Контрольная», «Домашнее задание», «Экзамен», «Работа на занятиях» */
  kindLabel: string;
  title: string;
  weight: number;
  /** null — уже оценено */
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
  dueHot: boolean;
  /** «через 2 дня», «сегодня», «срок прошёл» */
  dueLeft: string | null;
  room: string | null;
  /** пара в расписании, где пишется работа: /time?open=<id> */
  eventId: string | null;
  description: string | null;
  /** «8», «8,2» */
  score: string | null;
  /** «10 ноября» */
  gradedAt: string | null;
  /** «18 ноября, 21:10» */
  submittedAt: string | null;
  feedback: string | null;
  teacher: { name: string; initials: string; gradient: string };
  /** только у заданий (не у экзамена и не у работы на занятиях) */
  steps: TaskStep[] | null;
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
  checked: TaskDetail[];
  perf: {
    average: string;
    rank: number | null;
    size: number | null;
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
  test?: { weight: number; score: string | null };
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
  /** «1 курс, осень 2025» */
  title: string;
  /** «Осень 2025» */
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

/** Преподаватель текущих курсов: для окна «Преподаватели» на «Сегодня». */
export interface TeacherView {
  name: string;
  initials: string;
  gradient: string;
  courses: { title: string; color: string }[];
  /** ближайшая групповая консультация по его курсам */
  cons: { id: string; when: string } | null;
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
}

export interface CoursePageData {
  nav: CourseNavItem[];
  slug: string;
  title: string;
  color: string;
  kindLabel: string;
  online: boolean;
  teacher: { name: string; initials: string; gradient: string };
  credits: number;
  assessment: Assessment;
  /** «Экзамен 22 декабря», «Зачёт» */
  finalLabel: string;
  /** «8,1» */
  score: string | null;
  /** «8» — округлённый прогноз */
  forecast: string | null;
  /** доля формулы, по которой уже есть оценки, % */
  doneWeight: number;
  formula: FormulaSegment[];
  components: TaskDetail[];
  /** для калькулятора: Σ балл·вес по оценённым и вес ещё не оценённых */
  calc: { gradedSum: number; remainingWeight: number; examOnly: boolean } | null;
  lessons: CourseLesson[];
  consultation: { id: string; when: string; place: string } | null;
  /** онлайн-курс */
  lessonsDone?: number;
  lessonsTotal?: number;
  nextLesson?: { title: string; minutes: number } | null;
}
