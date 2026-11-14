export interface Student {
  firstName: string;
  fullName: string;
  initials: string;
  program: string;
  course: number;
  group: string;
  unreadNotifications: number;
}

export const student: Student = {
  firstName: "Алиса",
  fullName: "Алиса Воронцова",
  initials: "АВ",
  program: "Международный бизнес",
  course: 2,
  group: "МБ-24-1",
  unreadNotifications: 3,
};
