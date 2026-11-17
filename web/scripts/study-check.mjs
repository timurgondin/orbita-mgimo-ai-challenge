// Запуск: npm run build && PORT=3101 node scripts/study-check.mjs  (сам поднимает next start)
// «Учёба»: страницы курсов только свои (чужой курс — 404), окно задания, ?task=, калькулятор оценки, ссылки из «Сегодня» и «Успеваемости».
import { execSync, spawn } from "node:child_process";
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const PORT = Number(process.env.PORT ?? 3101);
const BASE = `http://127.0.0.1:${PORT}`;
const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
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
let ipN = 20;
async function login(name, viewport) {
  const ctx = await browser.newContext({ viewport, extraHTTPHeaders: { "x-forwarded-for": `10.8.0.${ipN++}` } });
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
const body = async (page) => (await page.textContent("body")) ?? "";
const dialog = (page) => page.locator("dialog[open]");
const component = (title) => db.gradeComponent.findFirstOrThrow({ where: { title, course: { enrollments: { some: { user: { login: "a.vorontsova" } } } } } });

try {
  const anon = await fetch(BASE + "/study/micro-24", { redirect: "manual" });
  check("anonymous course page redirects to /login", [307, 308].includes(anon.status) && anon.headers.get("location")?.includes("/login"));

  const { page } = await login("a.vorontsova");

  // ---- Курсы
  await open(page, "/study");
  await page.waitForSelector("[data-course]");
  const t = await text(page);
  check("no «До сессии» line", !t.includes("До сессии"));
  check("cards: no «next element» (Problem set, Контрольная №2)", !t.includes("Problem set 6") && !t.includes("Контрольная №2"));
  check("kinds: «Лекции и практика», no consultations", t.includes("Лекции и практика") && !t.includes("консультации"));
  const hrefs = await page.locator("[data-course]").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  check("cards link to course pages", hrefs.includes("/study/micro-24") && hrefs.every((h) => h?.startsWith("/study/")));

  // ---- Страница курса
  await page.click('[data-course="micro-24"]');
  await page.waitForURL((u) => u.pathname === "/study/micro-24");
  await page.waitForSelector("text=Формула оценки");
  const c = await text(page);
  check("course page: score, forecast, formula", c.includes("8,1") && c.includes("прогноз в ведомость") && c.includes("Контрольная №1") && c.includes("Экзамен 22 декабря"));
  check("sidebar: current course marked", (await page.locator('aside a[aria-current="page"]').textContent())?.includes("Микроэкономика"));
  await page.click('[aria-pressed]:text-is("9")');
  check("calculator: 9 needs 8,8 on the rest", ((await page.textContent("[data-calc-result]")) ?? "").includes("8,8"));
  await page.click('[aria-pressed]:text-is("5")');
  check("calculator: 5 needs 2,1", ((await page.textContent("[data-calc-result]")) ?? "").includes("2,1"));
  await page.click('[data-component]:has-text("Problem set 6")');
  await dialog(page).waitFor();
  const d = (await dialog(page).textContent()) ?? "";
  check("component modal: description and steps", d.includes("Олигополия") && d.includes("Сдано") && d.includes("20% итоговой оценки"));
  await page.keyboard.press("Escape");
  await dialog(page).waitFor({ state: "hidden" });
  await page.click('aside a[href="/study/english-b2"]');
  await page.waitForURL((u) => u.pathname === "/study/english-b2");
  await page.waitForSelector("h1:text-is('Английский язык B2')");
  check("sidebar switches course", true);

  await open(page, "/study/python-data");
  check("online course page", (await text(page)).includes("уроков пройдено"));

  // ---- Чужое и несуществующее — 404, без данных
  for (const [name, path] of [
    ["Maxim's course → 404", "/study/ir-theory-22"],
    ["unknown slug → 404", "/study/no-such-course"],
    ["long slug → 404", "/study/" + "x".repeat(200)],
  ]) {
    await open(page, path);
    const b = await body(page);
    check(name, !b.includes("Формула оценки") && !b.includes("Теория международных отношений") && /Курс не найден/.test(b));
  }

  // ---- Задания
  await open(page, "/study?tab=tasks");
  await page.waitForSelector("[data-task]");
  const tt = await text(page);
  check("tasks: groups «Ближайшие», «Позже», «Проверенные»", tt.includes("Ближайшие") && tt.includes("Позже") && tt.includes("Доклад") && tt.includes("Проверенные"));
  await page.click('[data-task]:has-text("Эссе «Глобальные")');
  await dialog(page).waitFor();
  const td = (await dialog(page).textContent()) ?? "";
  check("task modal: what to do, due, weight, course", td.includes("Что сделать") && td.includes("Четверг, 19 ноября, 23:59") && td.includes("15% итоговой оценки") && td.includes("Мировая экономика"));
  await page.keyboard.press("Escape");
  await dialog(page).waitFor({ state: "hidden" });
  await page.click('[data-task]:has-text("Контрольная №1")');
  await dialog(page).waitFor();
  check("graded modal: score and feedback", ((await dialog(page).textContent()) ?? "").includes("Хорошо с графиками"));

  const ps6 = await component("Problem set 6");
  await open(page, `/study?tab=tasks&task=${ps6.id}`);
  await page.waitForSelector("dialog[open][aria-label='Problem set 6']");
  check("?task=<id> opens the task, URL cleaned", new URL(page.url()).searchParams.get("task") === null);
  const foreign = await db.gradeComponent.findFirstOrThrow({ where: { title: "Policy brief" } });
  await open(page, `/study?tab=tasks&task=${foreign.id}`);
  await page.waitForTimeout(800);
  check("?task=<Maxim's id> opens nothing", (await dialog(page).count()) === 0 && !(await body(page)).includes("Policy brief"));

  // ---- «Сегодня» → окно задания, «Успеваемость» → курс
  await open(page, "/");
  await page.locator('section[aria-label="Скоро"] a[href*="task="]').first().click();
  await page.waitForURL((u) => u.pathname === "/study");
  await dialog(page).waitFor();
  check("Today «Скоро» opens the task window", true);
  await open(page, "/study?tab=perf");
  await page.click('a[href="/study/econometrics-24"]');
  await page.waitForURL((u) => u.pathname === "/study/econometrics-24");
  check("perf row leads to course page", true);

  // ---- Максим: свои курсы открываются, Алисины — нет
  const { page: mp } = await login("m.orlov");
  await open(mp, "/study/ir-theory-22");
  check("Maxim: own course page", (await text(mp)).includes("Теория международных отношений"));
  await open(mp, "/study/micro-24");
  check("Maxim: Alisa's course → 404", !(await body(mp)).includes("Формула оценки"));

  // ---- преподаватель
  const { page: tp } = await login("e.petrova");
  await open(tp, "/study/micro-24");
  check("teacher: no student course page", !(await body(tp)).includes("Формула оценки"));

  // ---- 360 px без горизонтальной прокрутки
  const { page: mob } = await login("a.vorontsova", { width: 360, height: 780 });
  for (const path of ["/study/econometrics-24", "/study?tab=tasks", "/study"]) {
    await open(mob, path);
    const overflow = await mob.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`360px ${path}: no horizontal scroll`, overflow <= 0, `${overflow}px`);
  }
} finally {
  await browser.close();
  server.kill();
  execSync("npm run db:seed", { stdio: "ignore" });
  await db.$disconnect();
}
const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);

async function text(page) {
  return (await page.locator("main").last().textContent()) ?? "";
}
