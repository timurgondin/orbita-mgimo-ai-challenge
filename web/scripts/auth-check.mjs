// Запуск: npm run build && node scripts/auth-check.mjs  (сам поднимает next start на :3100)
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const PORT = 3100;
const BASE = `http://127.0.0.1:${PORT}`;
const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
};

const db = new PrismaClient();
await db.loginAttempt.deleteMany();
await db.session.deleteMany();

const server = spawn("npx", ["next", "start", "-p", String(PORT)], {
  env: { ...process.env, COOKIE_SECURE: "false" },
  stdio: "ignore",
});
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(BASE + "/login")).ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 500));
}

const browser = await chromium.launch();
const GENERIC = "Неверный логин или пароль";
async function newPage(ip, ctxOpts = {}) {
  const ctx = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": ip }, ...ctxOpts });
  return { ctx, page: await ctx.newPage() };
}
async function submit(page, login, pass) {
  await page.goto(BASE + "/login");
  await page.fill("#login", login);
  await page.fill("#pass", pass);
  await page.click("button[type=submit]");
}

try {
  // 1. без сессии
  const r = await fetch(BASE + "/", { redirect: "manual" });
  check("unauthenticated / redirects to /login", [307, 308].includes(r.status) && new URL(r.headers.get("location"), BASE).pathname === "/login", `${r.status}`);

  // заголовки
  const lh = (await fetch(BASE + "/login")).headers;
  check("security headers", lh.get("x-content-type-options") === "nosniff" && lh.get("x-frame-options") === "DENY" && lh.get("referrer-policy") === "strict-origin-when-cross-origin" && /camera=\(\)/.test(lh.get("permissions-policy") ?? ""));

  // 2. неверный пароль / неизвестный логин
  let { ctx, page } = await newPage("10.0.0.1");
  await submit(page, "a.vorontsova", "wrong-password");
  await page.waitForSelector("form [role=alert]");
  const e1 = (await page.textContent("form [role=alert]")).trim();
  check("wrong password -> generic error", e1 === GENERIC, e1);
  await submit(page, "no.such.user", "whatever");
  await page.waitForSelector("form [role=alert]");
  const e2 = (await page.textContent("form [role=alert]")).trim();
  check("unknown login -> same error", e2 === GENERIC, e2);
  await ctx.close();

  // 3. блокировка на 6-й попытке
  ({ ctx, page } = await newPage("10.0.0.2"));
  const msgs = [];
  for (let i = 0; i < 6; i++) {
    await submit(page, "m.orlov", "bad" + i);
    await page.waitForSelector("form [role=alert]");
    msgs.push((await page.textContent("form [role=alert]")).trim());
  }
  check("attempts 1-5 generic error", msgs.slice(0, 5).every((m) => m === GENERIC));
  check("6th attempt -> lockout message", /^Слишком много попыток\. Попробуйте через \d+ мин\.$/.test(msgs[5]), msgs[5]);
  await submit(page, "m.orlov", "orbita-demo");
  await page.waitForSelector("form [role=alert]");
  check("correct password also blocked while locked", /Слишком много/.test(await page.textContent("form [role=alert]")));
  await ctx.close();

  // 4. успешный вход
  ({ ctx, page } = await newPage("10.0.0.3"));
  await submit(page, "a.vorontsova", "orbita-demo");
  await page.waitForURL(BASE + "/");
  const cookie = (await ctx.cookies()).find((c) => c.name === "orbita_session");
  check("session cookie HttpOnly + SameSite=Lax", !!cookie && cookie.httpOnly && cookie.sameSite === "Lax" && cookie.path === "/");
  const h1 = await (await page.waitForSelector("main h1"), await page.textContent("main h1"));
  check("authenticated / contains first name", h1.includes("Алиса"), h1);
  const dbSessions = await db.session.findMany();
  check("DB stores sha256 of token, not token", dbSessions.length === 1 && dbSessions[0].id !== cookie.value && /^[0-9a-f]{64}$/.test(dbSessions[0].id));
  await page.goto(BASE + "/login");
  await page.waitForURL(BASE + "/");
  check("/login redirects to / when signed in", true);

  // 5. выход
  const oldCookie = cookie.value;
  await page.click('button[aria-label="Профиль и настройки"]');
  await page.click("text=Выйти");
  await page.waitForURL(BASE + "/login");
  check("logout -> /login", true);
  check("session row deleted on logout", (await db.session.count()) === 0);
  const ctx2 = await browser.newContext();
  await ctx2.addCookies([{ name: "orbita_session", value: oldCookie, url: BASE }]);
  const p2 = await ctx2.newPage();
  await p2.goto(BASE + "/");
  await p2.waitForURL(BASE + "/login", { timeout: 10000 }).catch(() => {});
  check("old cookie no longer works", new URL(p2.url()).pathname === "/login" && (await p2.locator("main h1").count()) === 0, p2.url());
  await ctx2.close();
  await ctx.close();

  // роли и онбординг
  ({ ctx, page } = await newPage("10.0.0.4"));
  await submit(page, "n.lanskaya", "orbita-demo");
  await page.waitForURL(BASE + "/welcome");
  check("student without onboarding -> /welcome", true);
  await page.click("text=Продолжить");
  await page.waitForURL(BASE + "/");
  check("welcome -> Продолжить -> / (onboardingDone saved)", (await db.user.findUnique({ where: { login: "n.lanskaya" } })).onboardingDone === true);
  await db.user.update({ where: { login: "n.lanskaya" }, data: { onboardingDone: false } });
  await ctx.close();

  ({ ctx, page } = await newPage("10.0.0.5"));
  await submit(page, "e.petrova", "orbita-demo");
  await page.waitForURL(BASE + "/");
  await page.waitForSelector("main h1");
  check("teacher sees calm line", (await page.content()).includes("Кабинет сотрудника появится здесь"));
  await ctx.close();

  // 7. БД
  const users = await db.user.findMany();
  check("passwordHash is argon2id v=19 m=65536", users.every((u) => u.passwordHash.startsWith("$argon2id$v=19$m=65536,t=4,p=1$")), users[0].passwordHash.slice(0, 32));
  check("no plaintext password in DB", users.every((u) => !JSON.stringify(u).includes("orbita-demo")));
  check("distinct salts for same password", new Set(users.map((u) => u.passwordHash)).size === users.length);
} catch (e) {
  check("script error", false, String(e));
} finally {
  await browser.close();
  await db.loginAttempt.deleteMany();
  await db.session.deleteMany();
  await db.$disconnect();
  server.kill();
}
const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} FAILED` : "\nALL PASSED");
process.exit(failed ? 1 : 0);
