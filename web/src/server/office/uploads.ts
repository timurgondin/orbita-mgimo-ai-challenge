import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

// 8 МБ: тело запроса проходит через proxy (лимит 10 МБ) и bodySizeLimit server actions
export const MAX_UPLOAD = 8 * 1024 * 1024;
const UPLOAD_DIR = join(process.cwd(), "storage", "uploads");
// Тип — по сигнатуре содержимого, а не по имени или MIME из браузера
const SIGNATURES = [
  { mime: "application/pdf", ext: "pdf", ok: (b: Buffer) => b.subarray(0, 5).toString("latin1") === "%PDF-" },
  { mime: "image/jpeg", ext: "jpg", ok: (b: Buffer) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", ext: "png", ok: (b: Buffer) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
];

/** Имя файла только для показа: без управляющих символов, не длиннее 120. */
export const displayName = (name: string, ext: string) => name.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(-120) || `document.${ext}`;

/**
 * Сохраняет загруженный файл вне public под случайным именем (права 600). Размер проверяет вызывающий.
 * Тип — по сигнатуре; pdfOnly — только PDF. Неподходящий тип — null.
 */
export async function storeUpload(file: File, pdfOnly = false) {
  const buf = Buffer.from(await file.arrayBuffer());
  const sig = SIGNATURES.find((s) => s.ok(buf));
  if (!sig || (pdfOnly && sig.ext !== "pdf")) return null;
  const storedAs = `${randomBytes(16).toString("hex")}.${sig.ext}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(join(UPLOAD_DIR, storedAs), buf, { mode: 0o600 });
  return { name: displayName(file.name, sig.ext), size: buf.length, mime: sig.mime, storedAs, buf };
}
