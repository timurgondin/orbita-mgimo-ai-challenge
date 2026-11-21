import "server-only";
import { avatarGradient, initials, photoUrl } from "@/lib/user-view";
import { requireUser } from "@/server/auth/session";
import { cardQr } from "@/server/profile/card-code";
import { getArchive } from "./archive";
import { avatarGradientByKey } from "./shared";
import type { PersonRef, ProfileView, StudentCardView } from "./types";

const EMAIL_DOMAIN = "orbita.edu";

const fmtDate = (d: Date) =>
  d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Moscow" });

/** «Петрова Елена Андреевна» → «Елена Андреевна Петрова», инициалы «ЕП». */
function person(fio: string | null, avatar: string): PersonRef | null {
  if (!fio) return null;
  const [last = "", ...rest] = fio.split(" ");
  return {
    name: [...rest, last].join(" "),
    initials: `${rest[0]?.[0] ?? ""}${last[0] ?? ""}`.toUpperCase(),
    avatar: avatarGradientByKey(avatar),
  };
}

/** Профиль текущего пользователя (только из сессии). */
export async function getProfile(): Promise<ProfileView> {
  const u = await requireUser();
  const student = u.role === "student";
  const archive = student ? await getArchive() : null;
  return {
    student,
    email: `${u.login}@${EMAIL_DOMAIN}`,
    phone: u.phone,
    telegram: u.telegram,
    faculty: u.faculty,
    position: u.position,
    program: u.program,
    // «Бакалавриат, выпуск в 2029»
    programSub: u.degree ? (u.graduationYear ? `${u.degree}, выпуск в ${u.graduationYear}` : u.degree) : null,
    group: u.groupName,
    studyForm: u.studyForm,
    recordBook: u.recordBook,
    curator: person(u.curatorName, "peach"),
    headman: person(u.headmanName, "mist"),
    hasCard: student && !!u.cardToken,
    archive: archive?.semesters.length ? { semesters: archive.semesters.length, average: archive.average } : null,
  };
}

/** Студенческий билет текущего пользователя: минимум данных и QR на публичную проверку. */
export async function getStudentCard(): Promise<StudentCardView | null> {
  const u = await requireUser();
  if (u.role !== "student" || !u.cardToken || !u.cardNumber || !u.cardValidUntil) return null;
  return {
    name: `${u.firstName} ${u.lastName}`,
    meta: u.groupName ? `${u.program}, группа ${u.groupName}` : (u.program ?? ""),
    number: u.cardNumber,
    validUntil: fmtDate(u.cardValidUntil),
    photo: photoUrl(u),
    initials: initials(u),
    avatar: avatarGradient(u),
    ...(await cardQr(u.cardToken)),
  };
}
