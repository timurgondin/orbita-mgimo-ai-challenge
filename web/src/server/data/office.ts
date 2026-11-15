import "server-only";
import { DEMO_NOW, daysBetween, formatDayMonth, formatMonthShort, mskDate, mskMinutes } from "@/lib/demo-clock";
import { ACTIVE_STATUSES, getType, paramsSubtitle } from "@/lib/office-catalog";
import { db } from "@/server/db/client";
import { headingFor, paragraphsOf, qrSvg, verifyUrl } from "@/server/office/documents";
import { getStudent } from "./shared";
import type { OfficeData, OfficeDocView, OfficeEvent, OfficeRequestView, OfficeStep } from "./types";

const short = (d: Date) => `${Number(mskDate(d).slice(8))} ${formatMonthShort(d)}`;
const shortTime = (d: Date) => `${short(d)}, ${new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Moscow" }).format(d)}`;
const initials = (name: string) => {
  const [a = "", b = ""] = name.split(" ");
  return `${b[0] ?? ""}${a[0] ?? ""}`.toUpperCase();
};

function docWhen(d: Date): string {
  const diff = daysBetween(DEMO_NOW, d);
  return diff === 0 ? "Сегодня" : diff === -1 ? "Вчера" : formatDayMonth(d);
}

const ddmmyyyy = (d: Date) => mskDate(d).split("-").reverse().join(".");

/** Заявки и документы текущего студента (userId — только из сессии). */
export async function getOfficeData(): Promise<OfficeData | null> {
  const user = await getStudent();
  if (!user) return null;

  const [reqs, docs] = await Promise.all([
    db.officeRequest.findMany({
      where: { userId: user.id, status: { in: [...ACTIVE_STATUSES] } },
      orderBy: { createdAt: "desc" },
      include: { events: { orderBy: { order: "asc" } }, messages: { orderBy: { createdAt: "asc" } } },
    }),
    db.document.findMany({ where: { userId: user.id }, orderBy: { issuedAt: "desc" } }),
  ]);

  const requests: OfficeRequestView[] = reqs.flatMap((r) => {
    const type = getType(r.typeId);
    if (!type) return [];
    const state = (i: number) => (i < r.stage ? "fin" : i === r.stage ? "cur" : "todo") as "fin" | "cur" | "todo";
    const steps: OfficeStep[] = type.steps.map((label, i) => {
      const at = r.events[i]?.at;
      return { label, state: state(i), when: state(i) === "cur" ? "сейчас" : state(i) === "fin" && at ? short(at) : "" };
    });
    const events: OfficeEvent[] = r.events.map((e, i) => ({
      state: state(i),
      title: e.title,
      small: e.note ?? e.actorName,
      at: state(i) === "cur" ? "сейчас" : state(i) === "fin" && e.at ? shortTime(e.at) : i === r.events.length - 1 && r.eta ? `~${short(r.eta)}` : "",
    }));
    const etaText = r.eta ? `${type.kind === "cert" ? "Будет готова" : "Решение до"} ${formatDayMonth(r.eta)}` : "";
    let params: unknown = {};
    try {
      params = JSON.parse(r.params);
    } catch {}
    return [
      {
        id: r.id,
        number: r.number,
        typeId: r.typeId,
        title: type.title,
        subtitle: paramsSubtitle(type, params),
        status: r.status,
        eta: etaText,
        steps,
        events,
        messages: r.messages.map((m) => ({ id: m.id, authorName: m.authorName, initials: initials(m.authorName), staff: m.authorRole === "staff", body: m.body })),
        canWithdraw: true,
      },
    ];
  });

  const documents: OfficeDocView[] = await Promise.all(
    docs.map(async (d) => {
      const url = verifyUrl(d.verifyToken);
      return {
        id: d.id,
        number: d.number,
        title: d.title,
        subtitle: d.subtitle,
        status: d.status,
        when: docWhen(d.issuedAt),
        heading: headingFor(d.typeId),
        issuedDate: ddmmyyyy(d.issuedAt),
        issuedTime: new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Moscow" }).format(d.issuedAt),
        paragraphs: paragraphsOf(d.paragraphs),
        signedBy: d.signedBy,
        verifyUrl: url,
        qrSvg: await qrSvg(url),
      };
    }),
  );

  const m = mskMinutes(DEMO_NOW);
  const weekday = new Date(`${mskDate(DEMO_NOW)}T12:00:00+03:00`).getUTCDay();
  const open = weekday >= 1 && weekday <= 5 && m >= 600 && m < 1080;
  return { requests, documents, open };
}
