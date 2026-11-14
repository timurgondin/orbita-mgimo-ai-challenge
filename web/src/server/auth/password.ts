import "server-only";
import { Algorithm, hash, verify, Version } from "@node-rs/argon2";

// Параметры — docs/security.md
export const ARGON2 = {
  memoryCost: 65_536, // KiB
  timeCost: 4,
  parallelism: 1,
  outputLen: 32,
} as const;

export const PEPPER_VERSION = 1;

function loadPepper(): Buffer | undefined {
  const raw = process.env.AUTH_PEPPER;
  if (!raw) {
    if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
      throw new Error("AUTH_PEPPER не задан");
    }
    return undefined;
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("AUTH_PEPPER должен быть 32 байта в base64");
  return buf;
}

let pepperCache: Buffer | undefined;
function pepper(): Buffer | undefined {
  pepperCache ??= loadPepper();
  return pepperCache;
}

function options() {
  const secret = pepper();
  if (!secret && process.env.NODE_ENV === "production") throw new Error("AUTH_PEPPER не задан");
  return { ...ARGON2, algorithm: 2 as Algorithm, version: 1 as Version, secret };
}

export function hashPassword(password: string): Promise<string> {
  return hash(password, options());
}

export async function verifyPassword(storedHash: string, password: string): Promise<boolean> {
  try {
    return await verify(storedHash, password, { secret: pepper() });
  } catch {
    return false;
  }
}

/** true, если хеш создан не с текущими параметрами. */
export function needsRehash(storedHash: string, pepperVersion: number = PEPPER_VERSION): boolean {
  if (pepperVersion !== PEPPER_VERSION) return true;
  const m = /^\$argon2id\$v=(\d+)\$m=(\d+),t=(\d+),p=(\d+)\$/.exec(storedHash);
  if (!m) return true;
  const [, v, mem, t, p] = m.map(Number);
  return (
    v !== 19 || mem !== ARGON2.memoryCost || t !== ARGON2.timeCost || p !== ARGON2.parallelism
  );
}

let dummy: Promise<string> | undefined;
/** Фиктивная проверка для несуществующего логина — выравнивает время ответа. */
export async function verifyDummy(password: string): Promise<void> {
  dummy ??= hashPassword("dummy-password-for-timing");
  await verifyPassword(await dummy, password);
}
