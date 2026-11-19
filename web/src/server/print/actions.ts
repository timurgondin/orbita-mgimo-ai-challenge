"use server";

import { revalidatePath } from "next/cache";
import { PDFDocument } from "pdf-lib";
import { DEMO_NOW } from "@/lib/demo-clock";
import { HOLD_HOURS, MAX_COPIES, QUOTA, printerById, printerName } from "@/lib/printers";
import { plural } from "@/lib/phrases";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { quotaUsed } from "@/server/data/print";
import { MAX_UPLOAD, displayName } from "@/server/office/uploads";

export type PrintResult = { ok: true; message: string } | { ok: false; error: string };

const idOk = (id: unknown): id is string => typeof id === "string" && /^[a-z0-9-]{1,40}$/i.test(id);
const MAX_HELD = 10;

async function student() {
  const user = await requireUser();
  return user.role === "student" ? user : null;
}

/** Сколько страниц: PDF — по документу, картинка — одна. Тип — по сигнатуре; иначе null. */
async function countPages(buf: Buffer): Promise<{ pages: number; ext: string } | null> {
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") {
    try {
      const doc = await PDFDocument.load(buf, { ignoreEncryption: true, updateMetadata: false });
      return { pages: doc.getPageCount(), ext: "pdf" };
    } catch {
      return null;
    }
  }
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { pages: 1, ext: "jpg" };
  if (buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) return { pages: 1, ext: "png" };
  return null;
}

/**
 * Безопасная печать: файл встаёт в личную очередь и ждёт 24 часа, пока студент не подойдёт к принтеру с Орбита ID.
 * В прототипе сам файл не хранится — только имя и число страниц. Квота месяца проверяется с учётом ожидающих.
 */
export async function sendToPrint(form: FormData): Promise<PrintResult> {
  const user = await student();
  if (!user) return { ok: false, error: "Печать доступна студентам" };
  if (!(form instanceof FormData)) return { ok: false, error: "Выберите файл" };
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Выберите файл" };
  if (file.size > MAX_UPLOAD) return { ok: false, error: "Файл больше 8 МБ" };
  const copies = Number(form.get("copies"));
  if (!Number.isInteger(copies) || copies < 1 || copies > MAX_COPIES) return { ok: false, error: `Копий от 1 до ${MAX_COPIES}` };
  const color = form.get("color") === "1";
  const duplex = form.get("duplex") === "1";

  const info = await countPages(Buffer.from(await file.arrayBuffer()));
  if (!info) return { ok: false, error: "Нужен PDF, JPG или PNG" };
  const held = await db.printJob.count({ where: { userId: user.id, status: "held", expiresAt: { gt: DEMO_NOW } } });
  if (held >= MAX_HELD) return { ok: false, error: "В очереди уже 10 файлов — сначала напечатайте их" };
  const used = await quotaUsed(user.id);
  const need = info.pages * copies;
  const left = color ? QUOTA.color - used.color : QUOTA.bw - used.bw;
  if (need > left) return { ok: false, error: `Не хватает квоты: нужно ${need} ${plural(need, "страница", "страницы", "страниц")}, осталось ${left}` };

  await db.printJob.create({
    data: {
      userId: user.id,
      fileName: displayName(file.name, info.ext),
      pages: info.pages,
      copies,
      color,
      duplex,
      status: "held",
      createdAt: DEMO_NOW,
      expiresAt: new Date(DEMO_NOW.getTime() + HOLD_HOURS * 3_600_000),
    },
  });
  revalidatePath("/print");
  return { ok: true, message: `В очереди: ${info.pages} ${plural(info.pages, "страница", "страницы", "страниц")}. Заберите на любом принтере` };
}

export async function cancelPrint(id: unknown): Promise<PrintResult> {
  const user = await student();
  if (!user || !idOk(id)) return { ok: false, error: "Файл не найден" };
  const r = await db.printJob.updateMany({ where: { id, userId: user.id, status: "held" }, data: { status: "cancelled" } });
  if (!r.count) return { ok: false, error: "Файл не найден" };
  revalidatePath("/print");
  return { ok: true, message: "Убрано из очереди" };
}

/** «Я у принтера»: Орбита ID приложен — печатается вся своя очередь. Цветное ждёт цветного принтера. */
export async function releasePrint(printerId: unknown): Promise<PrintResult> {
  const user = await student();
  const p = printerById(printerId);
  if (!user || !p) return { ok: false, error: "Принтер не найден" };
  if (p.status === "offline") return { ok: false, error: "Принтер не работает — выберите другой" };
  const jobs = await db.printJob.findMany({ where: { userId: user.id, status: "held", expiresAt: { gt: DEMO_NOW } } });
  const ok = jobs.filter((j) => !j.color || p.color);
  if (!jobs.length) return { ok: false, error: "Очередь пуста" };
  if (!ok.length) return { ok: false, error: "Это чёрно-белый принтер, а в очереди только цветное" };
  await db.printJob.updateMany({ where: { id: { in: ok.map((j) => j.id) }, userId: user.id, status: "held" }, data: { status: "printed", printerId: p.id, printedAt: DEMO_NOW } });
  revalidatePath("/print");
  const rest = jobs.length - ok.length;
  return { ok: true, message: `Печатается на принтере «${printerName(p)}»${rest ? `. Цветное ждёт цветного принтера` : ""}` };
}

/** Скан с принтера приходит владельцу Орбита ID. Файл в прототипе — сгенерированный PDF. */
export async function scanToOrbita(printerId: unknown): Promise<PrintResult> {
  const user = await student();
  const p = printerById(printerId);
  if (!user || !p) return { ok: false, error: "Принтер не найден" };
  if (!p.scan) return { ok: false, error: "У этого принтера нет сканера" };
  if (p.status === "offline") return { ok: false, error: "Принтер не работает — выберите другой" };
  const today = await db.scan.count({ where: { userId: user.id, createdAt: { gte: new Date(DEMO_NOW.getTime() - 86_400_000) } } });
  if (today >= 30) return { ok: false, error: "Слишком много сканов за сутки" };
  const stamp = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Moscow" }).format(DEMO_NOW).replace(/[.,:\s]+/g, "-");
  await db.scan.create({ data: { userId: user.id, fileName: `Скан ${stamp}.pdf`, pages: 2, size: 640_000, printerId: p.id, createdAt: new Date(DEMO_NOW.getTime() + today * 1000) } });
  revalidatePath("/print");
  return { ok: true, message: "Скан пришёл в Орбиту" };
}
