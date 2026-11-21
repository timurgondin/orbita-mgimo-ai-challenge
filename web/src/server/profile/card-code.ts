import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { qrSvg, verifyUrl } from "@/server/office/documents";

/** Код в QR Орбита ID меняется каждые 10 с; принимаем текущий и два прошлых окна (до 30 с на скан). */
export const CARD_QR_PERIOD_MS = 10_000;
const GRACE_WINDOWS = 2;

let keyCache: Buffer | undefined;
/** Ключ подписи выводится из перца (env), в разработке без перца — случайный на процесс. */
function key(): Buffer {
  if (keyCache) return keyCache;
  const raw = process.env.CARD_QR_SECRET || process.env.AUTH_PEPPER;
  if (!raw && process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
    throw new Error("AUTH_PEPPER не задан");
  }
  keyCache = raw ? createHmac("sha256", Buffer.from(raw, "base64")).update("orbita-card-qr/v1").digest() : randomBytes(32);
  return keyCache;
}

const mac = (token: string, w: number) => createHmac("sha256", key()).update(`${token}.${w}`).digest().subarray(0, 12).toString("base64url");

/** Свежий QR студенческого и сколько он ещё живёт (мс) — без абсолютного времени, чтобы не зависеть от часов клиента. */
export async function cardQr(token: string): Promise<{ qr: string; ttl: number }> {
  const now = Date.now();
  const w = Math.floor(now / CARD_QR_PERIOD_MS);
  const qr = await qrSvg(`${verifyUrl(token)}?c=${w.toString(36)}.${mac(token, w)}`);
  return { qr, ttl: (w + 1) * CARD_QR_PERIOD_MS - now };
}

/** Проверка кода из QR: подпись верна и окно не старше 30 с. */
export function cardCodeValid(token: string, code: string | undefined): boolean {
  const m = /^([0-9a-z]{1,12})\.([A-Za-z0-9_-]{16})$/.exec(code ?? "");
  if (!m) return false;
  const w = parseInt(m[1], 36);
  const cur = Math.floor(Date.now() / CARD_QR_PERIOD_MS);
  if (!(w <= cur && w >= cur - GRACE_WINDOWS)) return false;
  const a = Buffer.from(m[2]);
  const b = Buffer.from(mac(token, w));
  return a.length === b.length && timingSafeEqual(a, b);
}
