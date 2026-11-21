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
  /** когда загружено фото; null — монограмма */
  photoAt?: Date | null;
}

export const AVATAR_GRADIENTS: Record<string, string> = {
  // глубокие тона под белые инициалы; блик и кант — класс .mono (globals.css)
  sand: "linear-gradient(160deg,#C9A887,#7E5F45)",
  mist: "linear-gradient(160deg,#9FAAC8,#56627F)",
  lilac: "linear-gradient(160deg,#B79BCC,#6E5287)",
  peach: "linear-gradient(160deg,#D8A889,#8F5F48)",
  mint: "linear-gradient(160deg,#8FC2B2,#4E8574)",
  stone: "linear-gradient(140deg,#2A2A2E,#2A2A2E)",
};

/** Адрес своего фото (только владельцу, см. app/me/photo); версия — для кеша. */
export const photoUrl = (u: { photoAt?: Date | string | null }) => (u.photoAt ? `/me/photo?v=${new Date(u.photoAt).getTime()}` : null);

export const initials = (u: UserView) => `${u.firstName[0] ?? ""}${u.lastName[0] ?? ""}`.toUpperCase();
export const fullName = (u: UserView) => `${u.firstName} ${u.lastName}`;
export const avatarGradient = (u: UserView) => AVATAR_GRADIENTS[u.avatar] ?? AVATAR_GRADIENTS.sand;

export function subtitle(u: UserView): string {
  // «Международный бизнес, 2 курс» — фраза, а не склейка через «·»; группа — в профиле
  if (u.role === "student") return [u.program, u.course ? `${u.course} курс` : null].filter(Boolean).join(", ");
  return u.position ?? "";
}
