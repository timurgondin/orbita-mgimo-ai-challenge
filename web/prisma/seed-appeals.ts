// «Красная кнопка»: обращения демо-студентов в приёмную ректора на разных этапах и уведомление об ответе.
import type { PrismaClient } from "@prisma/client";

const at = (s: string) => new Date(`${s}:00+03:00`);

type Seed = {
  login: string; number: number; kind: string; targetKind: string; targetId: string; targetName: string; targetLine: string;
  text: string; anonymous?: boolean; created: string; review?: string; forwarded?: string; forwardedTo: string;
  answered?: string; answer?: string;
};

const APPEALS: Seed[] = [
  {
    login: "a.vorontsova", number: 1037, kind: "complaint", targetKind: "unit", targetId: "campus", targetName: "Кампус и аудитории", targetLine: "Служба",
    text: "В аудитории 3108 третью неделю не работает проектор. На семинарах по микроэкономике смотрим слайды с ноутбука преподавателя, с задних рядов ничего не видно.",
    created: "2026-11-05T10:12", review: "2026-11-05T14:30", forwarded: "2026-11-06T09:40", forwardedTo: "Кампус и аудитории",
    answered: "2026-11-11T16:05", answer: "Проектор в аудитории 3108 заменили 11 ноября, заодно проверили технику на всём третьем этаже. Спасибо, что написали.",
  },
  {
    login: "a.vorontsova", number: 1041, kind: "thanks", targetKind: "teacher", targetId: "akhmedova-lr", targetName: "Ахмедова Лейла Рашидовна", targetLine: "Ассистент, кафедра анализа данных",
    text: "Лейла Рашидовна дважды оставалась после практики и помогла разобраться с pandas перед контрольной. Объясняет так, что хочется заниматься дальше.",
    created: "2026-11-12T18:20", review: "2026-11-13T10:05", forwarded: "2026-11-13T15:30", forwardedTo: "Кафедра анализа данных",
    answered: "2026-11-16T12:00", answer: "Благодарность передана Лейле Рашидовне и заведующему кафедрой анализа данных. Такие письма учитываются в конкурсе «Преподаватель года».",
  },
  {
    login: "a.vorontsova", number: 1046, kind: "idea", targetKind: "unit", targetId: "library", targetName: "Библиотека", targetLine: "Служба", anonymous: true,
    text: "Поставить второй постамат библиотеки во втором корпусе, у коворкинга. За перерыв между парами до первого корпуса не успеть.",
    created: "2026-11-17T13:40", review: "2026-11-17T17:10", forwarded: "2026-11-18T11:25", forwardedTo: "Библиотека",
  },
  {
    login: "m.orlov", number: 1044, kind: "complaint", targetKind: "unit", targetId: "schedule", targetName: "Расписание", targetLine: "Служба",
    text: "Семинар по международному праву 16 ноября перенесли накануне в 23:00. Половина группы узнала об этом уже в университете.",
    created: "2026-11-16T09:15", review: "2026-11-17T11:00", forwardedTo: "Расписание",
  },
];

export async function seedAppeals(db: PrismaClient) {
  await db.appeal.deleteMany();
  for (const a of APPEALS) {
    const user = await db.user.findUniqueOrThrow({ where: { login: a.login }, select: { id: true } });
    const status = a.answered ? "answered" : a.forwarded ? "forwarded" : a.review ? "review" : "sent";
    await db.appeal.create({
      data: {
        number: a.number, userId: user.id, kind: a.kind, targetKind: a.targetKind, targetId: a.targetId, targetName: a.targetName, targetLine: a.targetLine,
        text: a.text, anonymous: a.anonymous ?? false, status, createdAt: at(a.created), reviewAt: a.review ? at(a.review) : null,
        forwardedAt: a.forwarded ? at(a.forwarded) : null, forwardedTo: a.forwardedTo, answeredAt: a.answered ? at(a.answered) : null,
        answer: a.answer ?? null, answerBy: a.answered ? "Приёмная ректора" : null,
      },
    });
    if (a.answered && a.kind !== "thanks") {
      await db.notification.create({
        data: {
          userId: user.id, kind: "office", category: "office", level: "info", title: `Ответ на обращение № ${a.number}`,
          body: `**${a.targetName}**: ${a.answer!.split(".")[0].toLowerCase()}`, link: `/redbutton?appeal=${a.number}`, refId: `appeal-${a.number}`,
          actorName: "Приёмная ректора", createdAt: at(a.answered), readAt: at(a.answered.replace(/T\d\d/, "T18")),
        },
      });
    }
  }
  return APPEALS.length;
}
