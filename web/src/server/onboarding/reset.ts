import "server-only";
import { DEMO_NOW } from "@/lib/demo-clock";
import { db } from "@/server/db/client";

/** Демо-первокурсница: при каждом входе онбординг и «Первые шаги» начинаются заново (жюри смотрит по очереди). */
export const DEMO_FRESHMAN = "n.lanskaya";
const FRESHMAN_REQUEST = "R-2490";

export async function resetDemoFreshman(userId: string): Promise<void> {
  const req = await db.officeRequest.findUnique({ where: { number: FRESHMAN_REQUEST } });
  const extra = await db.officeRequest.findMany({ where: { userId, number: { not: FRESHMAN_REQUEST } }, select: { number: true } });
  const ownReq = req?.userId === userId ? req : null;
  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { onboardingDone: false, dataConfirmedAt: null, photoAt: null, phone: null, telegram: null, tiles: null },
    }),
    db.userPhoto.deleteMany({ where: { userId } }),
    // заявки, поданные в прошлых показах (в т. ч. «Есть ошибка» из онбординга)
    db.notification.deleteMany({ where: { userId, refId: { in: extra.map((r) => r.number) } } }),
    db.officeRequest.deleteMany({ where: { userId, number: { not: FRESHMAN_REQUEST } } }),
    // медсправка снова ждёт загрузки
    ...(ownReq
      ? [
          db.requestFile.deleteMany({ where: { requestId: ownReq.id } }),
          db.requestMessage.deleteMany({ where: { requestId: ownReq.id, authorRole: "student" } }),
          db.officeRequest.update({ where: { id: ownReq.id }, data: { status: "work", stage: 1, docReceivedAt: null } }),
          db.notification.updateMany({ where: { userId, refId: FRESHMAN_REQUEST }, data: { resolvedAt: null, readAt: null } }),
        ]
      : []),
    // учебник снова в постамате: выдачу отменяем, заказы из прошлых показов убираем
    db.loan.deleteMany({ where: { userId, takenAt: DEMO_NOW } }),
    db.bookOrder.deleteMany({ where: { userId, createdAt: DEMO_NOW } }),
    db.bookOrder.updateMany({ where: { userId, status: "picked", closedAt: DEMO_NOW }, data: { status: "ready", closedAt: null } }),
  ]);
}
