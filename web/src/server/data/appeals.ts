import "server-only";
import { db } from "@/server/db/client";
import { requireUser } from "@/server/auth/session";
import { ANSWER_DAYS, RECTOR_OFFICE, STAFF, UNITS, unitById, type AppealKind, type AppealStatus, type TargetKind } from "@/lib/appeals";
import { formatDayMonth, mskTime } from "@/lib/demo-clock";
import { AVATAR_GRADIENTS, avatarGradient, initials, photoUrl, subtitle } from "@/lib/user-view";
import { avatarGradientByKey } from "./shared";

/** Кому можно адресовать: преподаватель (из БД), сотрудник или служба (константы), без адресата. */
export interface AppealTarget {
  kind: Exclude<TargetKind, "none">;
  id: string;
  name: string;
  line: string;
  gradient?: string; // монограмма человека
  icon?: string; // значок службы
  mine?: boolean; // преподаватель моих курсов — наверху списка
}

export interface AppealStep {
  title: string;
  small: string;
  at: string;
  state: "fin" | "cur" | "todo";
}

export interface AppealView {
  id: string;
  number: number;
  kind: AppealKind;
  status: AppealStatus;
  target: { kind: TargetKind; name: string; line: string | null; gradient?: string; icon?: string };
  text: string;
  anonymous: boolean;
  when: string;
  eta: string | null;
  steps: AppealStep[];
  answer: { text: string; by: string; at: string } | null;
}

export interface AppealsData {
  me: { name: string; line: string; initials: string; gradient: string; photo: string | null };
  targets: AppealTarget[];
  appeals: AppealView[];
}

const day = (d: Date) => formatDayMonth(d);
const stamp = (d: Date) => `${formatDayMonth(d)}, ${mskTime(d)}`;

type Row = Awaited<ReturnType<typeof db.appeal.findMany>>[number];

/** Этапы «как у посылки»: отправлено → у ректора → передано → ответ. */
function steps(a: Row): AppealStep[] {
  const fin = (d: Date | null) => (d ? "fin" : "todo");
  const list: AppealStep[] = [
    { title: "Отправлено", small: a.anonymous ? "Анонимно" : "От вашего имени", at: stamp(a.createdAt), state: "fin" },
    { title: RECTOR_OFFICE, small: a.reviewAt ? "Принято в работу" : "Регистрирует обращение", at: a.reviewAt ? stamp(a.reviewAt) : "", state: a.reviewAt ? "fin" : "cur" },
    {
      title: a.forwardedTo ? `Передано: ${a.forwardedTo}` : "Передано ответственным",
      small: a.forwardedAt ? (a.kind === "thanks" ? "Благодарность передана" : "Разбираются") : "",
      at: a.forwardedAt ? stamp(a.forwardedAt) : "",
      state: fin(a.forwardedAt),
    },
    { title: "Ответ", small: a.answeredAt ? (a.answerBy ?? RECTOR_OFFICE) : "", at: a.answeredAt ? stamp(a.answeredAt) : "", state: fin(a.answeredAt) },
  ];
  const cur = list.findIndex((s) => s.state !== "fin");
  if (cur > 0) list[cur].state = "cur";
  return list;
}

/** Обращения текущего пользователя (только свои) и справочник адресатов. */
export async function getAppeals(): Promise<AppealsData> {
  const user = await requireUser();
  const [teachers, mineIds, rows] = await Promise.all([
    db.teacher.findMany({ select: { id: true, slug: true, lastName: true, firstName: true, middleName: true, avatar: true, position: true, department: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    db.courseTeacher.findMany({ where: { course: { enrollments: { some: { userId: user.id } } } }, select: { teacherId: true } }),
    db.appeal.findMany({ where: { userId: user.id }, orderBy: [{ createdAt: "desc" }, { number: "desc" }] }),
  ]);
  const mine = new Set(mineIds.map((m) => m.teacherId));
  const fio = (t: (typeof teachers)[number]) => [t.lastName, t.firstName, t.middleName].filter(Boolean).join(" ");
  teachers.sort((a, b) => fio(a).localeCompare(fio(b), "ru"));
  const teacherBySlug = new Map(teachers.map((t) => [t.slug, t]));

  const targets: AppealTarget[] = [
    ...teachers.map((t) => ({
      kind: "teacher" as const,
      id: t.slug,
      name: [t.lastName, t.firstName, t.middleName].filter(Boolean).join(" "),
      line: `${t.position}, ${t.department.charAt(0).toLowerCase()}${t.department.slice(1)}`,
      gradient: avatarGradientByKey(t.avatar),
      mine: mine.has(t.id) || undefined,
    })),
    ...STAFF.map((s) => ({ kind: "staff" as const, id: s.id, name: s.name, line: s.position, gradient: AVATAR_GRADIENTS[s.avatar] })),
    ...UNITS.map((u) => ({ kind: "unit" as const, id: u.id, name: u.name, line: "Служба", icon: u.icon })),
  ];

  const appeals: AppealView[] = rows.map((a) => {
    const kind = a.targetKind as TargetKind;
    const t = kind === "teacher" ? teacherBySlug.get(a.targetId ?? "") : undefined;
    const staff = kind === "staff" ? STAFF.find((s) => s.id === a.targetId) : undefined;
    const unit = kind === "unit" ? unitById(a.targetId) : undefined;
    const due = new Date(a.createdAt.getTime() + ANSWER_DAYS * 86_400_000);
    return {
      id: a.id,
      number: a.number,
      kind: a.kind as AppealKind,
      status: a.status as AppealStatus,
      target: {
        kind,
        name: a.targetName,
        line: a.targetLine,
        gradient: t ? avatarGradientByKey(t.avatar) : staff ? AVATAR_GRADIENTS[staff.avatar] : undefined,
        icon: unit?.icon ?? (kind === "none" ? "rector" : undefined),
      },
      text: a.text,
      anonymous: a.anonymous,
      when: day(a.createdAt),
      eta: a.answeredAt ? null : `Ответ до ${day(due)}`,
      steps: steps(a),
      answer: a.answer && a.answeredAt ? { text: a.answer, by: a.answerBy ?? RECTOR_OFFICE, at: stamp(a.answeredAt) } : null,
    };
  });

  return {
    me: { name: `${user.firstName} ${user.lastName}`, line: subtitle(user), initials: initials(user), gradient: avatarGradient(user), photo: photoUrl(user) },
    targets,
    appeals,
  };
}
