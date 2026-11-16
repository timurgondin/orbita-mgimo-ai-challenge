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
export type NotificationKind = "grade" | "document" | "announcement" | "schedule";

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
  | { kind: "icon"; icon: "file-check-2" | "megaphone" | "map-pin" };

export interface NewsItem {
  id: string;
  title: string;
  subtitle: { before?: string; emphasis?: string; after?: string };
  time: string;
  unread: boolean;
  avatar: NewsAvatar;
}

export interface FormulaSegment {
  weight: number;
  state: "done" | "pending" | "empty";
}

export interface CourseCardData {
  id: string;
  color: string;
  kindLabel: string;
  title: string;
  teacher: string;
  /** Крупное значение: «8,1», «Зачёт», «6» */
  score: string;
  /** Мелкое: «из 10», «из 12» */
  scoreSuffix: string;
  nextTitle: string | null;
  nextWhen: string | null;
  formula: FormulaSegment[];
  /** Для онлайн-курса: доля пройденных уроков, % */
  progress?: number;
}

export type TagKind = "upcoming" | "draft" | "in_progress" | "submitted" | "reviewing" | "returned";

export interface TaskItemData {
  id: string;
  color: string;
  title: string;
  course: string;
  /** мелко справа: «ауд. 1201», «15% оценки» или дата проверки */
  note: string;
  due: string;
  dueHot: boolean;
  status: TagKind | null;
  score?: string;
  feedback?: { text: string; initials: string; gradient: string };
}

export interface PerfRowData {
  id: string;
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
  day: string;
  month: string;
  title: string;
  time: string;
  room: string | null;
}

export interface StudyData {
  semester: string;
  courses: CourseCardData[];
  online: CourseCardData[];
  upcoming: TaskItemData[];
  checked: TaskItemData[];
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
