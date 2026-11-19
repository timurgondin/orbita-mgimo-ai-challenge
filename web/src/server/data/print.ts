import "server-only";
import { DEMO_NOW, daysBetween, formatDayMonth, mskDate, mskTime } from "@/lib/demo-clock";
import { PRINTERS, QUOTA, printerById, printerName } from "@/lib/printers";
import { db } from "@/server/db/client";
import { getStudent } from "./shared";
import type { PrintData } from "./types";

const fileSize = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} КБ` : `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} МБ`);
const when = (d: Date) => {
  const diff = daysBetween(d, DEMO_NOW);
  return diff <= 0 ? `сегодня в ${mskTime(d)}` : diff === 1 ? `вчера в ${mskTime(d)}` : `${formatDayMonth(d)}, ${mskTime(d)}`;
};
export const monthStart = () => new Date(`${mskDate(DEMO_NOW).slice(0, 8)}01T00:00:00+03:00`);

/** Расход квоты за месяц: напечатанное и ожидающее (ожидающее уже зарезервировано). */
export async function quotaUsed(userId: string) {
  const jobs = await db.printJob.findMany({ where: { userId, createdAt: { gte: monthStart() }, status: { in: ["printed", "held"] } }, select: { pages: true, copies: true, color: true } });
  return {
    bw: jobs.filter((j) => !j.color).reduce((s, j) => s + j.pages * j.copies, 0),
    color: jobs.filter((j) => j.color).reduce((s, j) => s + j.pages * j.copies, 0),
  };
}

/** Печать текущего студента: очередь, история, сканы, квота и принтеры. Принтер у следующей пары — первым. */
export async function getPrint(): Promise<PrintData | null> {
  const user = await getStudent();
  if (!user) return null;
  const [jobs, scans, used, next] = await Promise.all([
    db.printJob.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.scan.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    quotaUsed(user.id),
    db.scheduleEvent.findFirst({
      where: { course: { enrollments: { some: { userId: user.id } } }, startsAt: { gt: DEMO_NOW }, pair: { not: null } },
      orderBy: { startsAt: "asc" },
      select: { room: true, startsAt: true, course: { select: { title: true } } },
    }),
  ]);
  const nb = next && /^\d{4}$/.test(next.room) ? Number(next.room[0]) : null;
  const nf = next && /^\d{4}$/.test(next.room) ? Number(next.room[1]) : null;
  const near = PRINTERS.filter((p) => p.status !== "offline" && p.building === nb).sort((a, b) => Math.abs(a.floor - (nf ?? 1)) - Math.abs(b.floor - (nf ?? 1)))[0];
  const printers = [...PRINTERS].sort((a, b) => (a.id === near?.id ? -1 : b.id === near?.id ? 1 : a.building - b.building || a.floor - b.floor));
  const held = jobs.filter((j) => j.status === "held" && j.expiresAt > DEMO_NOW);
  const printed = jobs.filter((j) => j.status === "printed");
  const saved = printed.filter((j) => j.duplex && j.createdAt >= monthStart()).reduce((s, j) => s + Math.floor(j.pages / 2) * j.copies, 0);
  return {
    held: held.map((j) => ({
      id: j.id,
      name: j.fileName,
      pages: j.pages,
      copies: j.copies,
      color: j.color,
      duplex: j.duplex,
      sheets: (j.duplex ? Math.ceil(j.pages / 2) : j.pages) * j.copies,
      expires: `Ждёт до ${daysBetween(DEMO_NOW, j.expiresAt) === 0 ? "" : "завтра, "}${mskTime(j.expiresAt)}`,
    })),
    history: printed.slice(0, 6).map((j) => {
      const p = printerById(j.printerId);
      return { id: j.id, name: j.fileName, pages: j.pages * j.copies, color: j.color, where: p ? printerName(p) : "", when: when(j.printedAt ?? j.createdAt) };
    }),
    scans: scans.map((s) => {
      const p = printerById(s.printerId);
      return { id: s.id, name: s.fileName, pages: s.pages, size: fileSize(s.size), where: p ? printerName(p) : "", when: when(s.createdAt) };
    }),
    quota: { bw: { used: used.bw, total: QUOTA.bw }, color: { used: used.color, total: QUOTA.color }, month: new Intl.DateTimeFormat("ru-RU", { month: "long", timeZone: "Europe/Moscow" }).format(DEMO_NOW) },
    saved,
    nearId: near?.id ?? null,
    nearReason: near && next ? `Рядом со следующей парой: ${next.course?.title ?? ""}, ауд. ${next.room}` : null,
    printers: printers.map((p) => ({ ...p, name: printerName(p) })),
  };
}
