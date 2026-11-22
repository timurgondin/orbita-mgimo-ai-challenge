// Запуск: npm run build && node scripts/data-check.mjs  (сам поднимает next start на PORT, по умолчанию :3100)
// Проверяет, что данные разделены по пользователям и вкладки «Учёбы» работают.
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const PORT = Number(process.env.PORT ?? 3100);
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
let ipN = 20;
async function login(name) {
  const ctx = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": `10.1.0.${ipN++}` } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/login");
  await page.fill("#login", name);
  await page.fill("#pass", "orbita-demo");
  await page.click("button[type=submit]");
  await page.waitForURL(BASE + "/");
  await page.waitForSelector("main h1");
  return { ctx, page };
}
const text = async (page) => (await page.textContent("main")) ?? "";

const ALISA_ONLY = ["Эконометрика", "Микроэкономика", "Международное право", "Python для анализа данных"];
const MAXIM_ONLY = ["Теория международных отношений", "Конфликтология", "Международная безопасность", "Внешняя политика России", "Анализ данных в политологии"];

try {
  const r = await fetch(BASE + "/study", { redirect: "manual" });
  check("unauthenticated /study redirects to /login", [307, 308].includes(r.status) && new URL(r.headers.get("location"), BASE).pathname === "/login", `${r.status}`);

  // Алиса
  let { ctx, page } = await login("a.vorontsova");
  const aToday = await text(page);
  check("Alisa Today: greeting + Микроэкономика now", aToday.includes("Алиса") && aToday.includes("Микроэкономика") && aToday.includes("3108"));
  const tomorrowRow = (await page.textContent('[data-lesson-row="tomorrow"]')) ?? "";
  check("Alisa Today: tomorrow row", tomorrowRow.includes("09:30") && tomorrowRow.includes("Микроэкономика") && aToday.includes("Завтра, пятница"));
  check("Alisa Today: now card live «ещё 41 мин», later list has English (4105) and her consultation", aToday.includes("ещё 41 мин") && aToday.includes("4105") && /Консультация в каб\.\s518/.test(aToday) && aToday.includes("Эконометрика") && aToday.includes("Вы записаны"));
  await page.goto(BASE + "/study");
  await page.waitForSelector("#tab-courses");
  const aStudy = await text(page);
  check("Alisa /study shows her courses incl. Эконометрика", ALISA_ONLY.every((t) => aStudy.includes(t)) && aStudy.includes("8,3"));
  check("Alisa /study has none of Maxim's courses", MAXIM_ONLY.every((t) => !aStudy.includes(t)));

  // вкладки: клиентское переключение, URL, без полной перезагрузки
  await page.evaluate(() => { window.__marker = 1; });
  await page.click("#tab-tasks");
  await page.waitForSelector("text=Ближайшие");
  check("tab click: URL ?tab=tasks, no reload", page.url().endsWith("/study?tab=tasks") && (await page.evaluate(() => window.__marker)) === 1, page.url());
  check("tasks view shows statuses and feedback", (await text(page)).includes("Верная квалификация") && (await text(page)).includes("Черновик"));
  await page.click("#tab-perf");
  await page.waitForSelector("text=По дисциплинам");
  const perf = await text(page);
  check("perf view: avg 8,1, place из 184, 26 / 30", perf.includes("8,1") && perf.includes("место на курсе из 184") && /26\s*\/\s*30/.test(perf));
  await page.goBack();
  await page.waitForSelector("text=Ближайшие");
  check("back button returns to previous tab", page.url().endsWith("tab=tasks"));
  await page.goto(BASE + "/study?tab=perf");
  await page.waitForSelector("text=По дисциплинам");
  check("direct link ?tab=perf opens performance", (await page.getAttribute("#tab-perf", "aria-selected")) === "true");

  // подмена чужих данных через адрес не работает
  await page.goto(BASE + "/study?tab=tasks&userId=x&courseId=y&user=m.orlov");
  await page.waitForSelector("text=Ближайшие");
  check("query params cannot select another user", MAXIM_ONLY.every((t) => !aStudy.includes(t)) && !(await text(page)).includes("Конфликтология"));
  await ctx.close();

  // Максим
  ({ ctx, page } = await login("m.orlov"));
  const mToday = await text(page);
  check("Maxim Today: his greeting and next class differ", mToday.includes("Максим") && mToday.includes("Конфликтология") && !mToday.includes("Микроэкономика") && !mToday.includes("Консультация по эконометрике"));
  await page.goto(BASE + "/study");
  await page.waitForSelector("#tab-courses");
  const mStudy = await text(page);
  check("Maxim /study shows his courses", MAXIM_ONLY.every((t) => mStudy.includes(t)));
  check("Maxim /study has no Эконометрика / Alisa's courses", !mStudy.includes("Эконометрика") && ALISA_ONLY.every((t) => !mStudy.includes(t)));
  await ctx.close();

  // Преподаватель: спокойная строка вместо данных студента
  ({ ctx, page } = await login("e.petrova"));
  await page.goto(BASE + "/study");
  await page.waitForSelector("main h1");
  const t = await text(page);
  check("teacher /study shows own courses, no student data", t.includes("Микроэкономика") && t.includes("Журнал") && ALISA_ONLY.filter((x) => x !== "Микроэкономика").every((x) => !t.includes(x)));
  await ctx.close();
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
