/**
 * «Красная кнопка» — обращения в приёмную ректора: жалоба, благодарность, предложение.
 * Сотрудники и службы вымышленные. Общая константа клиента и сервера; проверки — в src/server/appeals/actions.ts.
 */
export type AppealKind = "complaint" | "thanks" | "idea";
export type TargetKind = "teacher" | "staff" | "unit" | "none";
export type AppealStatus = "sent" | "review" | "forwarded" | "answered";

export const KINDS: { id: AppealKind; label: string; short: string; color: string; field: string }[] = [
  { id: "complaint", label: "Жалоба", short: "Жалоба", color: "var(--st-red)", field: "Что случилось" },
  { id: "thanks", label: "Благодарность", short: "Спасибо", color: "var(--st-green)", field: "За что спасибо" },
  { id: "idea", label: "Предложение", short: "Идея", color: "var(--st-yellow)", field: "Что предлагаете" },
];
export const kindOf = (id: string) => KINDS.find((k) => k.id === id) ?? KINDS[0];

export interface Unit {
  id: string;
  name: string;
  icon: string; // ключ значка в components/appeals
}

export const UNITS: Unit[] = [
  { id: "office", name: "Учебный офис", icon: "office" },
  { id: "schedule", name: "Расписание", icon: "schedule" },
  { id: "library", name: "Библиотека", icon: "library" },
  { id: "campus", name: "Кампус и аудитории", icon: "campus" },
  { id: "canteen", name: "Столовая и кафе", icon: "canteen" },
  { id: "it", name: "IT-поддержка", icon: "it" },
  { id: "dorm", name: "Общежития", icon: "dorm" },
  { id: "security", name: "Охрана и пропуска", icon: "security" },
  { id: "sport", name: "Спорткомплекс", icon: "sport" },
  { id: "medical", name: "Медпункт", icon: "medical" },
];
export const unitById = (id: unknown) => UNITS.find((u) => u.id === id);

export interface Staff {
  id: string;
  name: string;
  position: string;
  unit: string; // Unit.id
  avatar: string;
}

export const STAFF: Staff[] = [
  { id: "smirnova-i", name: "Смирнова Ирина Олеговна", position: "Менеджер учебного офиса", unit: "office", avatar: "mint" },
  { id: "polyakova-n", name: "Полякова Наталья Юрьевна", position: "Диспетчер расписания", unit: "schedule", avatar: "lilac" },
  { id: "kovaleva-m", name: "Ковалёва Марина Сергеевна", position: "Заведующая абонементом", unit: "library", avatar: "peach" },
  { id: "golubev-a", name: "Голубев Артур Маратович", position: "Управляющий столовой", unit: "canteen", avatar: "sand" },
  { id: "rakhimov-t", name: "Рахимов Тимур Ильдарович", position: "Инженер IT-поддержки", unit: "it", avatar: "mist" },
  { id: "zaitseva-o", name: "Зайцева Ольга Павловна", position: "Комендант общежития № 2", unit: "dorm", avatar: "peach" },
  { id: "frolov-s", name: "Фролов Сергей Николаевич", position: "Начальник смены охраны", unit: "security", avatar: "sand" },
  { id: "demidov-i", name: "Демидов Игорь Алексеевич", position: "Тренер спорткомплекса", unit: "sport", avatar: "mist" },
  { id: "belkina-a", name: "Белкина Анна Викторовна", position: "Фельдшер медпункта", unit: "medical", avatar: "lilac" },
];
export const staffById = (id: unknown) => STAFF.find((s) => s.id === id);

export const STATUS: Record<AppealStatus, { label: string; color: string }> = {
  sent: { label: "Отправлено", color: "var(--st-violet)" },
  review: { label: "У ректора", color: "var(--st-blue)" },
  forwarded: { label: "Передано", color: "var(--st-yellow)" },
  answered: { label: "Есть ответ", color: "var(--st-green)" },
};

export const RECTOR_OFFICE = "Приёмная ректора";
export const TEXT_MIN = 20;
export const TEXT_MAX = 2000;
export const PER_DAY = 5;
/** Срок ответа, дней. */
export const ANSWER_DAYS = 5;
