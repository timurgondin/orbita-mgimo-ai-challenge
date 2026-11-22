"use server";

import { headers } from "next/headers";
import { db } from "@/server/db/client";
import { DEMO_FRESHMAN, resetDemoFreshman } from "@/server/onboarding/reset";
import { PEPPER_VERSION, needsRehash, hashPassword, verifyDummy, verifyPassword } from "./password";
import { clearFailures, lockedMinutes, recordFailure } from "./rate-limit";
import { createSession, destroySession } from "./session";

export interface LoginState {
  error?: string;
  /** Куда перейти после успешного входа (клиент сначала играет переход). */
  to?: "/" | "/welcome";
}

const GENERIC = "Неверный логин или пароль";

async function clientIp(): Promise<string> {
  const h = await headers();
  // Берём адрес, который проставил наш reverse proxy (x-real-ip или ПРАВОЕ значение x-forwarded-for).
  // Левые значения X-Forwarded-For присылает клиент — им доверять нельзя, иначе лимит обходится подменой.
  const real = h.get("x-real-ip")?.trim();
  if (real) return real;
  const xff = h.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean);
  return xff?.at(-1) || "unknown";
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const rawLogin = formData.get("login");
  const password = formData.get("password");
  if (typeof rawLogin !== "string" || typeof password !== "string") return { error: GENERIC };
  const login = rawLogin.trim().toLowerCase();
  if (!login || !password || login.length > 64 || password.length > 256) return { error: GENERIC };
  const remember = formData.get("remember") === "on";

  const key = `${login}|${await clientIp()}`;
  const wait = await lockedMinutes(key);
  if (wait > 0) return { error: `Слишком много попыток. Попробуйте через ${wait} мин.` };

  const user = await db.user.findUnique({ where: { login } });
  let ok = false;
  if (user) {
    ok = await verifyPassword(user.passwordHash, password);
  } else {
    await verifyDummy(password);
  }
  if (!user || !ok) {
    await recordFailure(key);
    return { error: GENERIC };
  }

  await clearFailures(key);
  if (needsRehash(user.passwordHash, user.pepperVersion)) {
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(password), pepperVersion: PEPPER_VERSION },
    });
  }
  await createSession(user.id, remember);
  if (user.login === DEMO_FRESHMAN) {
    await resetDemoFreshman(user.id);
    return { to: "/welcome" };
  }
  return { to: user.role === "student" && !user.onboardingDone ? "/welcome" : "/" };
}

/** Без redirect: клиент уходит на /login полной загрузкой, чтобы сбросить кэш роутера (иначе — петля / ↔ /login). */
export async function logoutAction(): Promise<void> {
  await destroySession();
}
