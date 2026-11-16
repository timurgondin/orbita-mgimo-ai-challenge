import { Suspense } from "react";
import { CircleCheck, CircleX } from "lucide-react";
import { DEMO_NOW, formatDayMonth, mskDate } from "@/lib/demo-clock";
import { db } from "@/server/db/client";

const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-t-[.5px] border-line py-3.5 first:border-t-0">
      <span className="text-sm text-text-3">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}

async function Result({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // Поиск по уникальному индексу; в ответ — только данные документа и маска владельца
  const doc = TOKEN_RE.test(token)
    ? await db.document.findUnique({
        where: { verifyToken: token },
        select: { title: true, number: true, issuedAt: true, signedBy: true, holderMask: true },
      })
    : null;

  // Не документ — возможно, QR студенческого билета. Отдаём только маску имени, группу и срок.
  const card =
    !doc && TOKEN_RE.test(token)
      ? await db.user.findUnique({
          where: { cardToken: token },
          select: { role: true, lastName: true, firstName: true, middleName: true, groupName: true, cardNumber: true, cardValidUntil: true },
        })
      : null;
  if (card?.role === "student" && card.cardNumber && card.cardValidUntil) {
    const valid = card.cardValidUntil.getTime() > DEMO_NOW.getTime(); // демо-часы, как во всём сайте
    const mask = [card.lastName, `${card.firstName[0]}.`, card.middleName ? `${card.middleName[0]}.` : ""].join(" ").trim();
    return (
      <>
        <div className="flex flex-col items-center text-center">
          <span
            className={
              valid
                ? "grid size-[72px] place-items-center rounded-full bg-[color-mix(in_srgb,var(--st-green)_16%,transparent)] text-(--st-green)"
                : "grid size-[72px] place-items-center rounded-full bg-[color-mix(in_srgb,var(--st-red)_16%,transparent)] text-(--st-red)"
            }
          >
            {valid ? <CircleCheck size={34} strokeWidth={2.2} /> : <CircleX size={34} strokeWidth={2} />}
          </span>
          <h1 className="mt-[18px] text-[28px] font-semibold tracking-[-.03em]">
            {valid ? "Студенческий действителен" : "Срок действия истёк"}
          </h1>
        </div>
        <div className="mt-9 rounded-3xl bg-s1 px-6 py-2.5">
          <Row k="Документ" v="Студенческий билет" />
          <Row k="Номер" v={card.cardNumber} />
          <Row k="Студент" v={mask} />
          {card.groupName && <Row k="Группа" v={card.groupName} />}
          <Row k="Действителен до" v={card.cardValidUntil.toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" })} />
        </div>
      </>
    );
  }

  if (!doc) {
    return (
      <div className="flex flex-col items-center text-center">
        <span className="grid size-[72px] place-items-center rounded-full bg-[color-mix(in_srgb,var(--st-red)_16%,transparent)] text-(--st-red)">
          <CircleX size={34} strokeWidth={2} />
        </span>
        <h1 className="mt-[18px] text-[28px] font-semibold tracking-[-.03em]">Документ не найден</h1>
      </div>
    );
  }
  return (
    <>
      <div className="flex flex-col items-center text-center">
        <span className="grid size-[72px] place-items-center rounded-full bg-[color-mix(in_srgb,var(--st-green)_16%,transparent)] text-(--st-green)">
          <CircleCheck size={34} strokeWidth={2.2} />
        </span>
        <h1 className="mt-[18px] text-[28px] font-semibold tracking-[-.03em]">Документ подлинный</h1>
      </div>
      <div className="mt-9 rounded-3xl bg-s1 px-6 py-2.5">
        <Row k="Документ" v={doc.title} />
        <Row k="Номер" v={doc.number} />
        <Row k="Дата выдачи" v={`${formatDayMonth(doc.issuedAt)} ${mskDate(doc.issuedAt).slice(0, 4)}`} />
        <Row k="Подписал" v={doc.signedBy} />
        <Row k="Владелец" v={doc.holderMask} />
      </div>
    </>
  );
}

export default function VerifyPage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={null}>
      <Result params={params} />
    </Suspense>
  );
}
