// Запуск: npm run build && PORT=3101 node scripts/study-check.mjs  (сам поднимает next start)
// «Учёба»: страницы курсов только свои (чужой курс — 404), окно задания, ?task=, калькулятор оценки, ссылки из «Сегодня» и «Успеваемости».
import { execSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
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

const manifest = JSON.parse(readFileSync(new URL("../.next/server/server-reference-manifest.json", import.meta.url), "utf8")).node;
const actionId = (name) => Object.entries(manifest).find(([, v]) => v.exportedName === name && v.filename.includes("study"))?.[0];
async function forge(ctx, name, args) {
  const r = await ctx.request.post(BASE + "/study", {
    headers: { "Next-Action": actionId(name), "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component" },
    data: JSON.stringify(args),
    maxRedirects: 0,
  });
  return { status: r.status(), body: await r.text() };
}
const workOf = async (title, login = "a.vorontsova") =>
  db.assignmentWork.findFirstOrThrow({ where: { assignment: { title }, user: { login } } });

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

/** Все пары недели: проходит по полосе дней (виден один день) и собирает строки. */
async function weekItems(page, scope = "main") {
  const out = [];
  for (const b of await page.locator(`${scope} [data-week-day]:visible`).all()) {
    await b.click();
    out.push(...(await page.locator(`${scope} [data-week-item]:visible`).allTextContents()));
  }
  return out;
}

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
  check("course page: score with homework average, forecast, formula", c.includes("8,3") && c.includes("прогноз в ведомость") && c.includes("Контрольная №1") && c.includes("Домашние задания") && c.includes("проверено 5 из 7"));
  check("header: no exam date duplicated", c.includes("Экзамен, 6 кредитов") && !c.includes("Экзамен 22 декабря"));
  check("auto-pass: Микроэкономика выходит", (await page.getAttribute("[data-autopass]", "data-autopass")) === "yes");
  check("staff: lecturer and seminar teacher", (await page.locator("[data-staff]").count()) === 2 && c.includes("Лекции, доцент") && c.includes("Семинары"));
  check("sidebar: current course marked", (await page.locator('aside a[aria-current="page"]').textContent())?.includes("Микроэкономика"));
  await page.click('[aria-pressed]:text-is("9")');
  check("calculator: 9 needs 8,8 on the rest", ((await page.textContent("[data-calc-result]")) ?? "").includes("8,8"));
  await page.click('[aria-pressed]:text-is("5")');
  check("calculator: 5 needs 2,1", ((await page.textContent("[data-calc-result]")) ?? "").includes("2,1"));
  await page.click('[data-component]:has-text("Домашние задания")');
  await dialog(page).waitFor();
  const d = (await dialog(page).textContent()) ?? "";
  check("aggregate modal: average and its problem sets", d.includes("8,6") && d.includes("Problem set 1") && d.includes("Problem set 7") && d.includes("20% итоговой оценки"));
  await page.keyboard.press("Escape");
  await dialog(page).waitFor({ state: "hidden" });
  // вкладки курса: задания и документы
  await page.getByRole("tab", { name: "Задания" }).click();
  await page.waitForSelector("text=На проверке");
  const ct = await text(page);
  check("course tasks: problem sets, no prep, no tests", ct.includes("Problem set 7") && !ct.includes("Подготовка к") && (await page.locator('[data-task]:has-text("Контрольная")').count()) === 0);
  await page.getByRole("tab", { name: "Документы" }).click();
  await page.click('[data-doc="program"]');
  await page.waitForSelector('[data-course-doc="program"]');
  const doc = (await page.textContent('[data-course-doc="program"]')) ?? "";
  check("program document opens", doc.includes("Рабочая программа дисциплины") && doc.includes("Тема 1") && doc.includes("Литература") && doc.includes("3 семестр"));
  await page.keyboard.press("Escape");
  await dialog(page).waitFor({ state: "hidden" });
  await page.click('[data-doc="assessment"]');
  await page.waitForSelector('[data-course-doc="assessment"]');
  check("assessment document: auto-pass rule and questions", ((await page.textContent('[data-course-doc="assessment"]')) ?? "").includes("Модели Курно и Бертрана"));
  await page.keyboard.press("Escape");
  await dialog(page).waitFor({ state: "hidden" });

  // карточка преподавателя
  await open(page, "/study/micro-24");
  await page.click('[data-staff="petrova-ea"]');
  await page.waitForURL((u) => u.pathname === "/people/petrova-ea");
  await page.waitForSelector("text=Публикации");
  const pp = await text(page);
  check("teacher page: position, week, publications, ORCID", pp.includes("Доцент") && pp.includes("Неделя") && pp.includes("ORCID") && pp.includes("Ведёт у тебя") && pp.includes("h-индекс 9"));
  check("teacher page: interests as tags", (await page.locator("[data-interest]").count()) === 3);
  const tw = await weekItems(page);
  check("teacher page: full week with other groups", tw.length >= 5 && tw.some((x) => x.includes("МБ-24-3")));
  await open(page, "/people/larionov-po");
  check("teacher profiles differ (Ларионов: eLibrary and SSRN only)", (await page.locator("[data-profile]").evaluateAll((els) => els.map((e) => e.getAttribute("data-profile")).join(","))) === "elibrary,ssrn");
  await open(page, "/people/no-such-person");
  check("unknown person → not found", (await body(page)).includes("Никого не нашли"));
  await open(page, "/study/econometrics-24");
  check("auto-pass: Эконометрика не выходит", (await page.getAttribute("[data-autopass]", "data-autopass")) === "no" && (await text(page)).includes("До автомата не хватает"));

  await open(page, "/study/micro-24");
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
  check("tasks: groups incl. «На проверке»", tt.includes("Ближайшие") && tt.includes("На проверке") && tt.includes("Позже") && tt.includes("Доклад") && tt.includes("Проверенные"));
  check("tasks: no «Впереди» tags, no «без оценки», no tests", !tt.includes("Впереди") && !tt.includes("без оценки") && !tt.includes("Контрольная №2") && !tt.includes("Подготовка к занятиям"));
  check("tasks: recent checked + link to all", tt.includes("Недавно проверено") && tt.includes("Все проверенные работы"));
  await page.click("[data-view-done]");
  await page.waitForSelector("[data-done-summary]");
  const dv = await text(page);
  check("done view: summary, months, URL", dv.includes("Проверено 21 работа") && dv.includes("Ноябрь") && dv.includes("Сентябрь") && new URL(page.url()).searchParams.get("view") === "done");
  await page.click('[aria-pressed]:has-text("Эконометрика")');
  check("done view: course filter", ((await page.textContent("[data-done-summary]")) ?? "").includes("Проверено 5 работ"));
  await page.click('[aria-pressed]:has-text("Текущие")');
  await page.waitForSelector("text=Ближайшие");
  check("tasks: time left shown («12 ч» for today's essay)", ((await page.textContent('[data-task]:has-text("Эссе «Глобальные")')) ?? "").includes("12 ч"));
  await page.click('[data-task]:has-text("Эссе «Глобальные")');
  await dialog(page).waitFor();
  const td = (await dialog(page).textContent()) ?? "";
  check("task modal: what to do, due, weight, course", td.includes("Что сделать") && td.includes("Четверг, 19 ноября, 23:59") && td.includes("15% итоговой оценки") && td.includes("Мировая экономика"));
  await page.keyboard.press("Escape");
  await dialog(page).waitFor({ state: "hidden" });
  await page.click('[data-task]:has-text("Казус №3")');
  await dialog(page).waitFor();
  check("graded modal: score and feedback", ((await dialog(page).textContent()) ?? "").includes("Верная квалификация"));

  await page.keyboard.press("Escape");
  await dialog(page).waitFor({ state: "hidden" });

  // ---- Подготовка к контролю: темы и демоверсия в окне элемента (?comp=), «к занятию» — в ближайших занятиях
  const k2 = await db.gradeComponent.findFirstOrThrow({ where: { title: "Контрольная №2", course: { slug: "econometrics-24" } } });
  await open(page, `/study/econometrics-24?comp=${k2.id}`);
  await page.waitForSelector("dialog[open] [data-prepare]");
  const kd = (await dialog(page).textContent()) ?? "";
  check("test modal: topics and what to bring", kd.includes("Мультиколлинеарность") && kd.includes("шпаргалка A4"));
  await page.click("dialog[open] [data-demo-open]");
  await page.waitForSelector("dialog[open] [data-demo]");
  check("demo sheet: 4 tasks, 10 points", (await page.locator("dialog[open] [data-demo] li").count()) === 4 && ((await page.textContent("dialog[open] [data-demo]")) ?? "").includes("10 баллов"));
  await page.keyboard.press("Escape");
  await dialog(page).waitFor({ state: "hidden" });
  await open(page, "/study/micro-24");
  await page.waitForSelector("[data-lesson-prep]");
  check("course page: «К занятию» in upcoming lessons", ((await page.textContent("[data-lesson-prep]")) ?? "").includes("Курно"));
  await open(page, "/study/micro-24?comp=not-an-id");
  await page.waitForTimeout(600);
  check("course page: unknown ?comp= opens nothing", (await page.locator("dialog[open]").count()) === 0);
  await open(page, "/study?tab=tasks");
  await page.waitForSelector("[data-task]");
  // ---- Сдача работы: прикрепить (черновик) → отправить → отозвать (снова черновик) → убрать файл
  await page.keyboard.press("Escape");
  await dialog(page).waitFor({ state: "hidden" });
  await page.click('[data-task]:has-text("Лабораторная №5")');
  await dialog(page).waitFor();
  await page.setInputFiles('dialog[open] input[type=file]', { name: "lab5_voroncova.zip", mimeType: "application/zip", buffer: Buffer.alloc(2048, 1) });
  await page.waitForSelector("text=Файл прикреплён");
  let w = await workOf("Лабораторная №5");
  check("attach: draft with file name, not sent", w.status === "draft" && w.fileName === "lab5_voroncova.zip" && w.fileSize === 2048 && !w.submittedAt);
  await page.click("dialog[open] >> text=Отправить на проверку");
  await page.waitForSelector("text=Работа отправлена");
  w = await workOf("Лабораторная №5");
  check("submit: status submitted", w.status === "submitted" && !!w.submittedAt);
  await page.click("dialog[open] >> text=Отозвать");
  await page.waitForSelector("text=Отправка отозвана");
  w = await workOf("Лабораторная №5");
  check("withdraw: draft again, file kept", w.status === "draft" && w.fileName === "lab5_voroncova.zip");
  await page.click('dialog[open] [aria-label="Убрать файл"]');
  await page.waitForSelector("text=Файл убран");
  w = await workOf("Лабораторная №5");
  check("remove file: nothing attached", w.status === "upcoming" && w.fileName === null);
  await page.keyboard.press("Escape");
  await dialog(page).waitFor({ state: "hidden" });

  check("action ids found", ["attachFile", "removeFile", "submitWork", "withdrawWork"].every((n) => !!actionId(n)));
  const actx = page.context();
  const maxims = await db.assignment.findFirstOrThrow({ where: { title: "Policy brief" } });
  await forge(actx, "attachFile", [maxims.id, { name: "x.pdf", size: 100 }]);
  await forge(actx, "submitWork", [maxims.id]);
  const mw = await workOf("Policy brief", "m.orlov");
  check("forged attach/submit to Maxim's task: nothing changes", mw.status === "draft" && mw.fileName === "policy_brief_draft.docx");
  const essay = await db.assignment.findFirstOrThrow({ where: { title: { startsWith: "Эссе «Глобальные" } } });
  const bad = await forge(actx, "attachFile", [essay.id, { name: "virus.exe", size: 100 }]);
  check("forged .exe rejected", bad.body.includes("Нужен PDF") && (await workOf(essay.title)).fileName === "esse_cepochki_postavok.docx");
  const big = await forge(actx, "attachFile", [essay.id, { name: "essay.pdf", size: 999_000_000 }]);
  check("forged file over 20 MB rejected", big.body.includes("20 МБ") && (await workOf(essay.title)).fileName === "esse_cepochki_postavok.docx");
  const graded = await db.assignment.findFirstOrThrow({ where: { title: "Problem set 1" } });
  await forge(actx, "attachFile", [graded.id, { name: "again.pdf", size: 100 }]);
  await forge(actx, "submitWork", [graded.id]);
  check("forged resubmit of graded work: nothing changes", (await workOf("Problem set 1")).status === "graded");
  const lab5 = await db.assignment.findFirstOrThrow({ where: { title: "Лабораторная №5" } });
  const empty = await forge(actx, "submitWork", [lab5.id]);
  check("submit without a file rejected", empty.body.includes("Сначала прикрепи файл") && (await workOf("Лабораторная №5")).status === "upcoming");
  check("no prep assignments: preparation lives in lessons", (await db.assignment.count({ where: { title: { startsWith: "Подготовка" } } })) === 0 && (await db.scheduleEvent.count({ where: { prep: { not: null } } })) >= 5);

  const ps6 = await db.assignment.findFirstOrThrow({ where: { title: "Problem set 6" } });
  await open(page, `/study?tab=tasks&task=${ps6.id}`);
  await page.waitForSelector("dialog[open][aria-label='Problem set 6']");
  check("?task=<id> opens the task, URL cleaned", new URL(page.url()).searchParams.get("task") === null);
  const foreign = await db.assignment.findFirstOrThrow({ where: { title: "Policy brief" } });
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
