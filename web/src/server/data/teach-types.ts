// Типы кабинета преподавателя: общие для сервера и клиента (без server-only).

export interface TeachLesson {
  id: string;
  date: string;
  start: string;
  end: string;
  pair: number;
  title: string;
  /** «Семинар», «Лекция» */
  kindLabel: string;
  group: string;
  room: string;
  color: string;
  /** курс в Орбите (у чужих групп без курса — null) */
  slug: string | null;
  students: number | null;
}

export interface TeachConsultation {
  id: string;
  date: string;
  start: string;
  end: string;
  pair: number;
  courseTitle: string;
  color: string;
  place: string;
  count: number;
  capacity: number;
  questions: { name: string; text: string }[];
}

export interface ReviewItem {
  id: string;
  student: string;
  login: string;
  initials: string;
  gradient: string;
  group: string;
  task: string;
  course: string;
  color: string;
  slug: string;
  /** «вчера в 21:10» */
  sent: string;
  late: boolean;
  status: string;
  file: { name: string; size: string } | null;
  score: number | null;
  feedback: string | null;
  due: string | null;
}

export interface TeachCourseCard {
  slug: string;
  title: string;
  color: string;
  kindLabel: string;
  groups: string;
  students: number;
  toReview: number;
  /** средний текущий балл */
  average: string | null;
  /** «22 декабря» — дата экзамена или зачёта */
  exam: string | null;
  /** доля пройденных пар семестра, % */
  progress: number;
}

export interface GradeColumn {
  id: string;
  title: string;
  short: string;
  weight: number;
  /** среднее по заданиям — считается само */
  aggregate: boolean;
}
export interface GradeRow {
  id: string;
  name: string;
  login: string;
  initials: string;
  gradient: string;
  group: string;
  cells: Record<string, number | null>;
  total: number | null;
}
export interface Gradebook {
  slug: string;
  title: string;
  color: string;
  columns: GradeColumn[];
  rows: GradeRow[];
  canEdit: boolean;
}

export interface TeamMember {
  id: string;
  name: string;
  initials: string;
  gradient: string;
  role: string;
  href: string | null;
  assistant?: { canReview: boolean; canGrade: boolean; since: string };
}

export interface TeachCoursePage {
  slug: string;
  title: string;
  color: string;
  kindLabel: string;
  groups: string;
  students: number;
  credits: number;
  assessment: string;
  formula: { title: string; weight: number }[];
  tasks: { id: string; title: string; due: string | null; sent: number; graded: number; total: number; open: boolean }[];
  team: TeamMember[];
  materials: { title: string; items: string[] }[];
  toReview: number;
}

export interface Candidate {
  id: string;
  name: string;
  initials: string;
  gradient: string;
  line: string;
}
