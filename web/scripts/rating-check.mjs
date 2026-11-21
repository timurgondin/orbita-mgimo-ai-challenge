// Запуск: npm run build && PORT=3101 node scripts/rating-check.mjs  (сам поднимает next start)
// «Рейтинг»: своё место, распределение без имён, пороги; первокурсница без рейтинга, преподаватель без страницы.
import { execSync, spawn } from "node:child_process";

import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const PORT = Number(process.env.PORT ?? 3101);
const BASE = `http://127.0.0.1:${PORT}`;
const results = [];
const check = (name, ok, extra = "") => {
  results.push(!!ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
};

execSync("npm run db:seed", { stdio: "ignore" });
const db = new PrismaClient();
await db.loginAttempt.deleteMany();
await db.session.deleteMany();

const server = spawn("node", ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], { env: { ...process.env, COOKIE_SECURE: "false" }, stdio: "ignore" });
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(BASE + "/login")).ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 500));
}


const browser = await chromium.launch();
let ipN = 40;
async function login(name, viewport) {
  const ctx = await browser.newContext({ viewport, extraHTTPHeaders: { "x-forwarded-for": `10.9.0.${ipN++}` } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/login");
  await page.fill("#login", name);
  await page.fill("#pass", "orbita-demo");
  await page.click("button[type=submit]");
  await page.waitForURL((u) => u.pathname === "/" || u.pathname === "/welcome");
  return { ctx, page };
}
async function open(page, path) {
  await page.goto(BASE + path);
  await page.waitForLoadState("networkidle");
}
const text = async (page) => (await page.textContent("main")) ?? "";

try {
  const anon = await fetch(BASE + "/study/rating", { redirect: "manual" });
  check("anonymous rating redirects to /login", [307, 308].includes(anon.status));

  const { page } = await login("a.vorontsova");
  await open(page, "/study?tab=perf");
  await page.waitForSelector("[data-rating-link]");
  const card = (await page.textContent("[data-rating-link]")) ?? "";
  check("perf: rating card with place and top-%", /\d+ место из 184, топ-\d+%/.test(card), card);
  await page.click("[data-rating-link]");
  await page.waitForURL((u) => u.pathname === "/study/rating");
  await page.waitForSelector("[data-histogram]");
  const t = await text(page);
  const rank = Number(await page.textContent("[data-rank]"));
  check("rating: place shown, matches perf card", rank > 0 && rank < 184 && card.includes(`${rank} место из 184`), String(rank));
  check("rating: privacy note, perks, how it is counted", t.includes("Видно только тебе") && t.includes("Повышенная академическая стипендия") && (await page.locator("[data-how]").count()) === 1);
  // однокурсники анонимны: ни одной фамилии из группы
  const pool = await db.user.findMany({ where: { login: { startsWith: "seed.student" } }, select: { lastName: true } });
  check("rating: no classmates' names on the page", pool.every((p) => !t.includes(p.lastName)));
  check("rating: histogram has own bar and table view", (await page.locator("[data-histogram] table tr").count()) > 10 && t.includes("ты"));
  check("rating: history of places for 2 semesters", (await page.locator("[data-history] table tr").count()) === 2);
  await page.click("[data-how]");
  await page.waitForSelector("dialog[open] [data-how-modal]");
  check("«Как считается» opens a modal with the formula", ((await page.textContent("dialog[open]")) ?? "").includes("Σ оценка × кредиты"));
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "Последняя сессия" }).click();
  await page.waitForTimeout(400);
  check("rating: last session view switches", Number(await page.textContent("[data-rank]")) > 0);

  // первокурсница: рейтинга ещё нет
  const { page: np } = await login("n.lanskaya");
  await db.user.update({ where: { login: "n.lanskaya" }, data: { onboardingDone: true } }); // онбординг — в onboarding-check; здесь — данные первокурсницы
  await open(np, "/study/rating");
  check("first-year: rating after first session", (await text(np)).includes("Рейтинг появится после первой сессии"));

  // Максим: 6 семестров истории
  const { page: mp } = await login("m.orlov");
  await open(mp, "/study/rating");
  check("Maxim: own program and 6 points", (await text(mp)).includes("Мировая политика, 4 курс") && (await mp.locator("[data-history] table tr").count()) === 6);
  await open(mp, "/");
  check("Today: rating in «Ещё»", (await mp.locator('nav[aria-label="Быстрый доступ"] dialog a[href="/study/rating"]').count()) === 1);

  // преподаватель: страницы рейтинга нет
  const { page: tp } = await login("e.petrova");
  await open(tp, "/study/rating");
  check("teacher: no rating page", !new URL(tp.url()).pathname.startsWith("/study/rating"));
} catch (e) {
  console.error(e);
  results.push(false);
} finally {
  await browser.close();
  server.kill();
  await db.$disconnect();
  execSync("npm run db:seed", { stdio: "ignore" });
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
