// Запуск: npm run build && PORT=3101 node scripts/archive-check.mjs  (сам поднимает next start)
// «Архив курсов»: прошлые семестры только свои, подделанные параметры, связь с «Успеваемостью» и профилем;
// плитки и ссылки «Сегодня» ведут в разделы (а не на «#»).
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
  const ctx = await browser.newContext({ viewport, extraHTTPHeaders: { "x-forwarded-for": `10.7.0.${ipN++}` } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/login");
  await page.fill("#login", name);
  await page.fill("#pass", "orbita-demo");
  await page.click("button[type=submit]");
  await page.waitForURL((u) => u.pathname === "/" || u.pathname === "/welcome");
  return { ctx, page };
}
const text = async (page) => (await page.textContent("main")) ?? "";

try {
  // без входа
  const anon = await fetch(BASE + "/study/archive", { redirect: "manual" });
  check("anonymous /study/archive redirects to /login", [307, 308].includes(anon.status) && anon.headers.get("location")?.includes("/login"));

  // данные в базе: у каждого — свои
  const alisaId = (await db.user.findUniqueOrThrow({ where: { login: "a.vorontsova" } })).id;
  const maximId = (await db.user.findUniqueOrThrow({ where: { login: "m.orlov" } })).id;
  check("seed: Alisa has 2 past semesters", (await db.pastCourse.groupBy({ by: ["semester"], where: { userId: alisaId } })).length === 2);
  check("seed: Maxim has 6 past semesters", (await db.pastCourse.groupBy({ by: ["semester"], where: { userId: maximId } })).length === 6);

  // ---- Алиса, 2 курс
  const { page } = await login("a.vorontsova");
  await page.goto(BASE + "/study/archive");
  await page.waitForSelector("[data-semester]");
  await page.waitForLoadState("networkidle");
  const t = await text(page);
  check("Alisa: two semesters of the 1st year", (await page.locator("[data-semester]:visible").count()) === 2 && t.includes("1 курс, осень 2025") && t.includes("1 курс, весна 2026"));
  check("Alisa: totals (14 disciplines, 60 / 240 credits)", t.includes("14") && t.includes("дисциплин сдано") && t.includes("60") && t.includes("/ 240"));
  check("Alisa: own courses only", t.includes("Введение в экономику") && t.includes("Статистика") && !t.includes("Переговорный процесс") && !t.includes("Введение в политологию"));
  check("Alisa: one year → no year switcher", (await page.locator('[role=tablist][aria-label="Курс обучения"]:visible').count()) === 0);

  // окно курса: формула оценки и итог
  await page.click('[data-archive-course]:has-text("Введение в экономику")');
  const dlg = page.locator("dialog[open]");
  await dlg.waitFor();
  const d = (await dlg.textContent()) ?? "";
  check("course modal: grade, formula, teacher", d.includes("из 10, отлично") && d.includes("Домашние задания") && d.includes("40%") && d.includes("Сумма с весами 8,4") && d.includes("Петрова Е. А."));
  await page.keyboard.press("Escape");
  await dlg.waitFor({ state: "hidden" });

  // «Выписка оценок» → форма заявки в «Офисе»
  await page.click('a[href="/office?new=grades"]');
  await page.waitForURL((u) => u.pathname === "/office");
  await page.waitForSelector("dialog[open][aria-label='Выписка оценок']");
  check("«Выписка оценок» opens the office form", true);
  check("office: address is cleaned after opening", new URL(page.url()).search === "");
  // подделанный тип заявки — окна нет
  await page.goto(BASE + "/office?new=../../etc");
  await page.waitForTimeout(800);
  check("office: unknown ?new= opens nothing", (await page.locator("dialog[open]").count()) === 0);

  // «Успеваемость» → прошлые семестры → архив
  await page.goto(BASE + "/study?tab=perf");
  await page.waitForSelector("[data-past-semester]");
  check("perf: past semesters listed newest first", (await page.locator("[data-past-semester]").first().textContent())?.includes("весна 2026"));
  await page.click("[data-past-semester]");
  await page.waitForURL((u) => u.pathname === "/study/archive");
  check("perf: past semester leads to archive", true);

  // профиль → архив
  await page.goto(BASE + "/profile");
  await page.waitForSelector("[data-archive-link]");
  check("profile: archive row", ((await page.textContent("[data-archive-link]")) ?? "").includes("2 семестра"));
  await page.click("[data-archive-link]");
  await page.waitForURL((u) => u.pathname === "/study/archive");
  check("profile: archive row leads to archive", true);

  // ---- «Сегодня»: ни одной ссылки «#»
  await page.goto(BASE + "/");
  await page.waitForSelector('nav[aria-label="Быстрый доступ"]');
  const dead = await page.locator('main a[href="#"]').count();
  check("Today: no dead links", dead === 0, `${dead} left`);
  const tiles = await page.locator('nav[aria-label="Быстрый доступ"] a').evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  check("Today tiles: courses, grades, documents", ["/study", "/study?tab=perf", "/office"].every((h) => tiles.includes(h)));

  await page.getByRole("button", { name: "Преподаватели" }).click();
  const tDlg = page.locator("dialog[open][aria-label='Преподаватели']");
  await tDlg.waitFor();
  const td = (await tDlg.textContent()) ?? "";
  check("teachers modal: own teachers", td.includes("Петрова Е. А.") && td.includes("Микроэкономика") && td.includes("Соколов Д. В.") && !td.includes("Лебедева"));
  await page.click('[data-teacher="Соколов Д. В."]');
  await page.waitForURL((u) => u.pathname === "/people/sokolov-dv");
  check("teacher row opens the teacher page", true);

  await page.goto(BASE + "/");
  await page.getByRole("button", { name: "Библиотека" }).click();
  await page.waitForSelector("text=Библиотека скоро появится");
  check("library tile answers with a toast", true);

  await page.click('a[aria-label^="Текущая пара"]');
  await page.waitForURL((u) => u.pathname === "/time");
  await page.waitForSelector("dialog[open][aria-label='Микроэкономика']");
  check("«Сейчас» opens the lesson in «Время»", new URL(page.url()).search === "");
  await page.goto(BASE + "/time?open=not-an-id");
  await page.waitForTimeout(800);
  check("time: unknown ?open= opens nothing", (await page.locator("dialog[open]").count()) === 0);

  // ---- Максим, 4 курс: три года, переключатель в адресе
  const { page: mp } = await login("m.orlov");
  await mp.goto(BASE + "/study/archive");
  await mp.waitForSelector("[data-semester]");
  await mp.waitForLoadState("networkidle");
  check("Maxim: latest year by default", (await text(mp)).includes("Весна 2026") && (await mp.locator('[role=tab][aria-selected=true]:visible').textContent()) === "3 курс");
  await mp.getByRole("tab", { name: "1 курс" }).click();
  await mp.waitForSelector("text=Введение в политологию");
  check("Maxim: year switch updates URL", new URL(mp.url()).searchParams.get("year") === "1");
  check("Maxim: own courses only", !(await text(mp)).includes("Введение в экономику"));
  await mp.goto(BASE + "/study/archive?year=99");
  await mp.waitForSelector("[data-semester]");
  await mp.waitForLoadState("networkidle");
  check("Maxim: bogus ?year= falls back to latest", (await text(mp)).includes("Весна 2026"));

  // ---- Ника, 1 курс: архив пуст
  const { page: np } = await login("n.lanskaya");
  await np.goto(BASE + "/study/archive");
  await np.waitForSelector("text=Здесь появятся курсы после первой сессии");
  check("first-year: empty archive", (await np.locator("[data-semester]:visible").count()) === 0);
  await np.goto(BASE + "/profile");
  await np.waitForSelector("text=Контакты");
  check("first-year: no archive row in profile", (await np.locator("[data-archive-link]").count()) === 0);

  // ---- преподаватель: архива студента нет
  const { page: tp } = await login("e.petrova");
  await tp.goto(BASE + "/study/archive");
  await tp.waitForURL((u) => u.pathname === "/study");
  check("teacher: /study/archive redirects to /study", true);

  // ---- мобильный: без горизонтальной прокрутки
  const { page: mob } = await login("m.orlov", { width: 360, height: 780 });
  await mob.goto(BASE + "/study/archive");
  await mob.waitForSelector("[data-semester]");
  const overflow = await mob.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("360px: no horizontal scroll", overflow <= 0, `${overflow}px`);
} finally {
  await browser.close();
  server.kill();
  execSync("npm run db:seed", { stdio: "ignore" });
  await db.$disconnect();
}
const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
