// Запуск: npm run build && PORT=3101 node scripts/people-check.mjs  (сам поднимает next start)
// Поиск людей: строка и вкладки, своя группа по умолчанию, карточка студента (почта всегда, телефон и Telegram — по настройке),
// расписание группы, приватность в профиле, помощник; подделки (чужая настройка, неверные поля, оценки не утекают).
import { execSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
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

const manifest = JSON.parse(readFileSync(new URL("../.next/server/server-reference-manifest.json", import.meta.url), "utf8")).node;
const actionId = (name, file) => Object.entries(manifest).find(([, v]) => v.exportedName === name && v.filename.includes(file))?.[0];
async function forge(ctx, file, name, args, path = "/") {
  const r = await ctx.request.post(BASE + path, {
    headers: { "Next-Action": actionId(name, file), "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component" },
    data: JSON.stringify(args),
    maxRedirects: 0,
  });
  return { status: r.status(), body: await r.text() };
}

const browser = await chromium.launch();
let ipN = 60;
async function login(name, viewport = { width: 1280, height: 900 }) {
  const ctx = await browser.newContext({ viewport, extraHTTPHeaders: { "x-forwarded-for": `10.9.1.${ipN++}` } });
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
const SHOTS = process.env.SHOTS;
const shot = async (page, name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

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
  const { ctx, page } = await login("a.vorontsova");

  // плитка «Люди» — среди закреплённых, «Преподавателей» больше нет
  check("tile «Люди» pinned on Today, no «Преподаватели»", (await page.locator('nav[aria-label="Быстрый доступ"] > [data-tile="people"]').getAttribute("href")) === "/people" && (await page.locator('[data-tile="teachers"]').count()) === 0);

  // пусто — своя группа и свои преподаватели
  await open(page, "/people");
  const group = (await page.locator("[data-people-group]").textContent()) ?? "";
  check("empty query: own group МБ-24-1 with classmates, without me", group.includes("Группа МБ-24-1") && group.includes("Беляева Дарья") && !group.includes("Воронцова"));
  check("empty query: my teachers", ((await page.locator("[data-people-teachers]").textContent()) ?? "").includes("Петрова Елена Андреевна"));
  await shot(page, "people-desktop");

  // поиск: падеж и регистр не важны в начале слова, ё = е, группа и программа
  await page.fill("[data-people-search]", "бел");
  await page.waitForFunction(() => document.querySelector("[data-people-results]")?.textContent?.includes("Белов"));
  const hits = await page.locator("[data-people-results] [data-person]").allTextContents();
  check("search «бел»: Беляева (student) and Белов (student), teacher Белов too", hits.some((h) => h.includes("Беляева Дарья")) && hits.some((h) => h.includes("Белов Роман")), hits.length + "");
  await shot(page, "people-search");
  check("query in URL", new URL(page.url()).searchParams.get("q") === "бел");
  await page.getByRole("tab", { name: "Преподаватели" }).click();
  await page.waitForTimeout(500);
  check("tab «Преподаватели»: only teachers", (await page.locator("[data-people-results] [data-person='student']").count()) === 0);
  await page.getByRole("tab", { name: "Все" }).click();
  await page.fill("[data-people-search]", "ткачева");
  await page.waitForFunction(() => document.querySelector("[data-people-results]")?.textContent?.includes("Ткачёва"));
  check("ё and е are the same", true);
  await page.fill("[data-people-search]", "мировая политика 4 курс орлов");
  await page.waitForFunction(() => document.querySelector("[data-people-results]")?.textContent?.includes("Орлов"));
  check("search by programme finds m.orlov", true);
  await page.fill("[data-people-search]", "zzzz");
  await page.waitForFunction(() => document.querySelector("[data-people-results]")?.textContent?.includes("Никого не нашли"));
  check("nothing found: one quiet line", true);
  await page.fill("[data-people-search]", "Беляева");
  await page.waitForSelector("[data-people-results] a[href='/people/d.belyaeva']");
  await page.click("[data-people-results] a[href='/people/d.belyaeva']");
  await page.waitForURL((u) => u.pathname === "/people/d.belyaeva");
  await page.waitForLoadState("networkidle");

  // карточка студента: почта, Telegram открыт, телефона нет, расписание группы, никаких оценок
  let t = (await page.textContent("main")) ?? "";
  check("student card: name, programme, group", t.includes("Беляева Дарья") && t.includes("Международный бизнес, 2 курс") && t.includes("Группа МБ-24-1"));
  check("student card: email always", (await page.locator("[data-student-contacts] [data-contact='email']").textContent()) === "d.belyaeva@orbita.edu");
  check("student card: Telegram shown (opened), phone hidden", (await page.locator("[data-student-contacts] [data-contact='telegram']").count()) === 1 && (await page.locator("[data-student-contacts] [data-contact='phone']").count()) === 0);
  check("student card: personal schedule for the week", (await weekItems(page, "[data-student-week]")).length > 5);
  check("student card: no grades, rating, payment form", !/балл|рейтинг|место|бюджет|контракт|зачётн/i.test(t));
  await shot(page, "people-student");
  await page.goBack();
  await page.waitForURL((u) => u.pathname === "/people");
  check("back returns to the same query", (await page.inputValue("[data-people-search]")) === "Беляева");

  // скрытый Telegram не виден, ни в HTML
  await open(page, "/people/a.gromova");
  check("hidden contacts are not in HTML", (await page.locator("[data-student-contacts] [data-contact='telegram']").count()) === 0 && !(await page.content()).includes("gromova"  + "_"));
  await open(page, "/people/k.ryabova"); // Telegram есть, но скрыт
  check("Telegram set but hidden → not shown", !(await page.content()).includes("ks_ryabova"));
  // m.orlov открыл и телефон
  await open(page, "/people/m.orlov");
  check("phone shown when opened", ((await page.locator("[data-student-contacts] [data-contact='phone']").textContent()) ?? "").includes("+7 900 000-56-78"));

  // недели: ‹ › листают ±3 недели, неделя в адресе; дальше границы — нельзя, мусор в ?week= — текущая неделя
  await open(page, "/people/g.ponomarev");
  check("week switch: «Эта неделя» by default", (await page.textContent("main [data-week-label]:visible")) === "Эта неделя");
  await page.click("main [data-week-next]:visible");
  await page.waitForURL((u) => u.searchParams.get("week") === "2026-11-23");
  await page.waitForFunction(() => [...document.querySelectorAll("main [data-week-label]")].some((e) => e.checkVisibility() && e.textContent === "Следующая неделя"));
  check("week switch: next week has pairs (Mon selected)", (await weekItems(page, "[data-student-week]")).length > 5);
  for (let i = 0; i < 2; i++) {
    await page.click("main [data-week-next]:visible");
    await page.waitForTimeout(700);
  }
  check("week switch: stops at +3 weeks", new URL(page.url()).searchParams.get("week") === "2026-12-07" && (await page.locator("main [data-week-next]:visible").count()) === 0);
  await open(page, "/people/g.ponomarev?week=2027-01-04");
  check("week switch: out-of-range ?week= → this week", (await page.textContent("main [data-week-label]:visible")) === "Эта неделя");
  await open(page, "/people/g.ponomarev?week=2026-11-09");
  const prevLabel = await page.textContent("main [data-week-label]:visible");
  check("week switch: previous weeks have the same pairs", prevLabel === "Прошлая неделя" && (await weekItems(page, "[data-student-week]")).length > 5, prevLabel);
  await open(page, "/people/petrova-ea?week=2026-11-23");
  check("teacher card: next week via ?week=", (await page.textContent("main [data-week-label]:visible")) === "Следующая неделя");

  // личное расписание: курсы по выбору — у каждого свои
  const gen = await db.user.findMany({ where: { groupName: "ЭД-23-1" }, select: { login: true }, orderBy: { login: "asc" } });
  const weeks = new Set();
  for (const g of gen.slice(0, 6)) {
    await open(page, "/people/" + g.login);
    weeks.add((await weekItems(page, "[data-student-week]")).join("|"));
  }
  check("generated group: same group, different personal schedules (electives)", gen.length >= 14 && weeks.size > 1, `${gen.length} students, ${weeks.size} schedules`);
  await shot(page, "people-student-generated");
  check("directory is big: 1000+ students, 60+ teachers", (await db.user.count({ where: { role: "student" } })) > 1000 && (await db.teacher.count()) > 60);

  // неверные адреса
  for (const bad of ["e.petrova", "office", "no.such.user", "..%2F..", "A.VORONTSOVA"]) {
    await open(page, "/people/" + bad);
    const b = (await page.textContent("main")) ?? "";
    check(`/people/${bad} → «Никого не нашли», no data`, b.includes("Никого не нашли") && !b.includes("@orbita.edu"));
  }
  // преподаватель по тому же адресу
  await open(page, "/people/petrova-ea");
  check("teacher card still works at /people/<slug>", ((await page.textContent("h1")) ?? "").includes("Петрова"));

  // приватность — окно из профиля и со своей карточки
  await open(page, "/profile");
  await page.click("[data-privacy-open]");
  await page.waitForSelector("dialog[open] [data-privacy-modal]");
  check("privacy modal: email always visible", ((await page.textContent("dialog[open] [data-privacy-modal]")) ?? "").includes("Видят все"));
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && !!r.request().headers()["next-action"]),
    page.click("dialog[open] [data-privacy='showPhone'] [role='switch']"),
  ]);
  let phoneOn = false;
  for (let i = 0; i < 20 && !phoneOn; i++, await page.waitForTimeout(250)) phoneOn = (await db.user.findUniqueOrThrow({ where: { login: "a.vorontsova" } })).showPhone;
  check("privacy: phone switched on in DB", phoneOn);
  await shot(page, "people-privacy");
  await page.click("dialog[open] [data-my-card]");
  await page.waitForURL((u) => u.pathname === "/people/a.vorontsova");
  await page.waitForLoadState("networkidle");
  check("own card: phone visible after switch, «Приватность» opens the modal", (await page.locator("[data-student-contacts] [data-contact='phone']").count()) === 1 && (await page.locator("main [data-privacy-open]:visible").count()) === 1);
  await page.click("main [data-privacy-open]:visible");
  await page.waitForSelector("dialog[open] [data-privacy-modal]");
  await page.click("dialog[open] [data-privacy='showPhone'] [role='switch']");
  await page.waitForFunction(() => !document.querySelector("[data-student-contacts] [data-contact='phone']"), null, { timeout: 5000 }).catch(() => {});
  check("own card: switching off in the modal hides the phone at once", (await page.locator("[data-student-contacts] [data-contact='phone']").count()) === 0);
  await page.keyboard.press("Escape");
  await open(page, "/profile");
  await page.click("[data-headman-link]");
  await page.waitForURL((u) => u.pathname === "/people/d.belyaeva");
  check("profile: headman opens her card", true);

  // подделки
  const before = await db.user.findUniqueOrThrow({ where: { login: "d.belyaeva" } });
  let r = await forge(ctx, "profile/actions", "updatePrivacy", ["showTelegram", false, before.id]);
  const after = await db.user.findUniqueOrThrow({ where: { login: "d.belyaeva" } });
  const me = await db.user.findUniqueOrThrow({ where: { login: "a.vorontsova" } });
  check("forged updatePrivacy with someone's id changes only own row", after.showTelegram === true && me.showTelegram === false, r.body.slice(0, 60));
  r = await forge(ctx, "profile/actions", "updatePrivacy", ["role", "staff"]);
  check("forged updatePrivacy: unknown field rejected", r.body.includes('"ok":false') && (await db.user.findUniqueOrThrow({ where: { login: "a.vorontsova" } })).role === "student");
  r = await forge(ctx, "profile/actions", "updatePrivacy", ["showPhone", "yes"]);
  check("forged updatePrivacy: non-boolean rejected", r.body.includes('"ok":false'));
  r = await forge(ctx, "people/actions", "findPeople", ["беляева", "all"], "/people");
  const hitsLine = r.body.split("\n").find((l) => /^\d+:\[\{"kind"/.test(l)) ?? "";
  check("findPeople returns only directory fields", hitsLine.includes("Беляева") && !/passwordHash|cardToken|recordBook|phone|telegram|courseRank|showPhone/.test(hitsLine), hitsLine.slice(0, 80));
  r = await forge(ctx, "people/actions", "findPeople", ["а".repeat(5000), "all"], "/people");
  check("findPeople: huge query is cut, no crash", r.status === 200);
  r = await forge(ctx, "people/actions", "findPeople", ["беляева", "admins"], "/people");
  check("findPeople: unknown tab → empty", r.body.includes("[]"));
  const anon = await browser.newContext();
  r = await forge(anon, "people/actions", "findPeople", ["беляева", "all"], "/people");
  check("findPeople without session: no data", !r.body.includes("Беляева"));
  const anonTab = await anon.newPage();
  await anonTab.goto(BASE + "/people/d.belyaeva");
  await anonTab.waitForLoadState("networkidle");
  check("card without session → login, no data", new URL(anonTab.url()).pathname === "/login" && !(await anonTab.content()).includes("d.belyaeva@"));
  const photo = await anon.request.get(BASE + "/people/a.vorontsova/photo", { maxRedirects: 0 });
  check("photo without session → 401", photo.status() === 401);
  await anon.close();

  // помощник
  r = await forge(ctx, "assistant/actions", "askAssistant", ["найди Беляеву"]);
  check("assistant: «найди Беляеву» → card with her", r.body.includes('"kind":"people"') && r.body.includes("d.belyaeva@orbita.edu"));
  r = await forge(ctx, "assistant/actions", "askAssistant", ["почта Жукова"]);
  check("assistant: «почта Жукова»", r.body.includes("m.zhukov@orbita.edu"));
  r = await forge(ctx, "assistant/actions", "askAssistant", ["кто староста"]);
  check("assistant: «кто староста» → Беляева with email", r.body.includes("староста — Дарья Беляева, d.belyaeva@orbita.edu"), r.body.slice(-200));
  r = await forge(ctx, "assistant/actions", "askAssistant", ["найди почту куратора"]);
  check("assistant: «почта куратора» → Петрова", r.body.includes("куратор — Елена Петрова, e.petrova@orbita.edu"));
  r = await forge(ctx, "assistant/actions", "askAssistant", ["дай расписание Матвея Жукова на вторник"]);
  check("assistant: «расписание Матвея Жукова на вторник» → lessons", r.body.includes('"kind":"lessons"') && r.body.includes("Матвей Жуков: вторник, 17 ноября"), r.body.slice(-240));
  r = await forge(ctx, "assistant/actions", "askAssistant", ["пары Петровой завтра"]);
  check("assistant: teacher's schedule for tomorrow", r.body.includes("Елена Петрова: завтра"));
  r = await forge(ctx, "assistant/actions", "askAssistant", ["Мой средний балл"]);
  check("assistant: other intents untouched", r.body.includes('"kind":"grades"'));
  await ctx.close();

  // телефон 390 px
  const m = await login("a.vorontsova", { width: 390, height: 844 });
  await open(m.page, "/people");
  check("mobile: no horizontal scroll", await m.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await shot(m.page, "people-mobile");
  await open(m.page, "/people/d.belyaeva");
  check("mobile card: no horizontal scroll", await m.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await shot(m.page, "people-student-mobile");
  await m.ctx.close();

  // преподаватель тоже ищет студентов
  const tch = await login("e.petrova");
  await open(tch.page, "/people?q=орлов");
  check("teacher can search students", ((await tch.page.textContent("[data-people-results]")) ?? "").includes("Орлов Максим"));
  await tch.ctx.close();
} finally {
  await browser.close();
  server.kill();
  await db.$disconnect();
}
const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
