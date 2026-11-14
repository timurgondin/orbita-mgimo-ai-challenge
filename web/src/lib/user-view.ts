// Отображение пользователя; без доступа к БД, можно импортировать из клиентских компонентов.
export interface UserView {
  firstName: string;
  lastName: string;
  middleName: string | null;
  role: string;
  program: string | null;
  course: number | null;
  groupName: string | null;
  position: string | null;
  avatar: string;
}

export const AVATAR_GRADIENTS: Record<string, string> = {
  sand: "linear-gradient(140deg,#D6C3AE,#8F7A68)",
  mist: "linear-gradient(140deg,#C9D3E6,#7F8BA6)",
  lilac: "linear-gradient(140deg,#D9C2E4,#9878A8)",
  peach: "linear-gradient(140deg,#E7CDB4,#A88A70)",
  stone: "linear-gradient(140deg,#2A2A2E,#2A2A2E)",
};

export const initials = (u: UserView) => `${u.firstName[0] ?? ""}${u.lastName[0] ?? ""}`.toUpperCase();
export const fullName = (u: UserView) => `${u.firstName} ${u.lastName}`;
export const avatarGradient = (u: UserView) => AVATAR_GRADIENTS[u.avatar] ?? AVATAR_GRADIENTS.sand;

export function subtitle(u: UserView): string {
  if (u.role === "student") return [u.program, u.course ? `${u.course} курс` : null, u.groupName].filter(Boolean).join(" · ");
  return u.position ?? "";
}
