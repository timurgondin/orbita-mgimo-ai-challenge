export type NewsAvatar =
  | { kind: "initials"; text: string; gradient: string }
  | { kind: "icon"; icon: "file-check-2" | "megaphone" };

export interface NewsItem {
  id: string;
  title: string;
  /** Подзаголовок; выделенный фрагмент — в `emphasis` */
  subtitle: { before?: string; emphasis?: string; after?: string };
  time: string;
  unread: boolean;
  avatar: NewsAvatar;
}

export const news: NewsItem[] = [
  {
    id: "test-1-checked",
    title: "Контрольная №1 проверена",
    subtitle: { before: "Микроэкономика · ", emphasis: "8 из 10", after: " · «Хорошо с графиками»" },
    time: "10:05",
    unread: true,
    avatar: { kind: "initials", text: "ЕП", gradient: "linear-gradient(140deg,#E7CDB4,#A88A70)" },
  },
  {
    id: "certificate-ready",
    title: "Справка об обучении готова",
    subtitle: { before: "PDF с QR-кодом уже в «Офисе»" },
    time: "Вчера",
    unread: true,
    avatar: { kind: "icon", icon: "file-check-2" },
  },
  {
    id: "electives-open",
    title: "Открыта запись на элективы",
    subtitle: { before: "Учебный офис · до 30 ноября" },
    time: "Вт",
    unread: false,
    avatar: { kind: "icon", icon: "megaphone" },
  },
];
