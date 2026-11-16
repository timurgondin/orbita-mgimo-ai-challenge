// Запуск: npm run build && PORT=3102 node scripts/time-check.mjs  (сам поднимает next start)
// «Время»: расписание, групповые консультации, запись/отмена, защита на сервере (в т.ч. подделанные запросы к серверным действиям).
import { execSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const PORT = Number(process.env.PORT ?? 3102);
const BASE = `http://127.0.0.1:${PORT}`;
const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
};

execSync("npm run db:seed", { stdio: "ignore" }); // чистое состояние записей
const db = new PrismaClient();
await db.loginAttempt.deleteMany();
await db.session.deleteMany();

const manifest = JSON.parse(readFileSync(new URL("../.next/server/server-reference-manifest.json", import.meta.url), "utf8")).node;
const actionId = (name) => Object.entries(manifest).find(([, v]) => v.exportedName === name && v.filename.includes("consultations"))?.[0];

const server = spawn("npx", ["next", "start", "-p", String(PORT)], { env: { ...process.env, COOKIE_SECURE: "false" }, stdio: "ignore" });
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(BASE + "/login")).ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 500));
}

const browser = await chromium.launch();
let ipN = 60;
async function login(name) {
  const ctx = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": `10.4.0.${ipN++}` } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/login");
  await page.fill("#login", name);
  await page.fill("#pass", "orbita-demo");
  await page.click("button[type=submit]");
  await page.waitForURL(BASE + "/");
  await page.waitForSelector("main h1");
  return { ctx, page };
}
const waitText = (page, str) => page.waitForFunction((t) => document.querySelector("main")?.textContent?.includes(t), str);
const text = async (page) => (await page.textContent("main")) ?? "";
const cons = (courseTitle, userLogin) => db.consultation.findFirstOrThrow({ where: { course: { title: courseTitle, enrollments: { some: { user: { login: userLogin } } } } } });
const count = (id) => db.consultationSignup.count({ where: { consultationId: id } });
/** Подделанный вызов серверного действия, как это сделал бы клиент без интерфейса. */
async function forge(ctx, name, args) {
  const r = await ctx.request.post(BASE + "/time", {
    headers: { "Next-Action": actionId(name), "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component" },
    data: JSON.stringify(args),
    maxRedirects: 0,
  });
  return { status: r.status(), body: await r.text() };
}

try {
  check("action ids found in manifest", !!actionId("signUp") && !!actionId("cancel") && !!actionId("updateQuestion"));
  const r = await fetch(BASE + "/time", { redirect: "manual" });
  check("unauthenticated /time redirects to /login", [307, 308].includes(r.status) && new URL(r.headers.get("location"), BASE).pathname === "/login");

  const alisaEcon = await cons("Эконометрика", "a.vorontsova");
  const alisaEng = await cons("Английский язык B2", "a.vorontsova");
  const alisaWorld = await cons("Мировая экономика", "a.vorontsova");
  const maximSec = await cons("Международная безопасность", "m.orlov");

  // без сессии подделка ничего не меняет
  const anon = await fetch(BASE + "/time", { method: "POST", headers: { "Next-Action": actionId("signUp"), "Content-Type": "text/plain;charset=UTF-8" }, body: JSON.stringify([alisaEng.id, "x"]), redirect: "manual" });
  check("anonymous forged signUp does nothing", (await count(alisaEng.id)) === 9, `status ${anon.status}`);

  // ---- Алиса
  let { ctx, page } = await login("a.vorontsova");
  await page.goto(BASE + "/time");
  await page.waitForSelector('[data-pair="6"]');
  const list = await text(page);
  check("list: Thu bell grid with live pair 3, ещё 41 мин", (await page.locator('[data-pair="3"][data-state="live"]').first().textContent()).includes("ещё 41 мин") && list.includes("Микроэкономика") && list.includes("Олигополия") && list.includes("Нет пары"));
  check("list: room change 2214 → 4105", list.includes("2214") && list.includes("→ 4105"));
  check("list: signed-up consultation in pair 6, «Вы записаны»", (await page.locator('[data-pair="6"]').first().textContent()).includes("Эконометрика") && list.includes("Вы записаны"));
  check("list: week title", list.includes("16 – 21 ноября"));

  await page.evaluate(() => { window.__marker = 1; });
  await page.click('button[aria-label="Следующая неделя"]');
  await page.waitForSelector("text=23 – 28 ноября");
  check("next week: URL ?w=1, no reload", page.url().endsWith("/time?w=1") && (await page.evaluate(() => window.__marker)) === 1, page.url());
  await page.click('button[aria-label^="Понедельник"]');
  await page.waitForSelector("text=Контрольная №2");
  check("week 2 Monday: Контрольная №2 on pair 2", (await text(page)).includes("Контрольная №2") && (await text(page)).includes("09:30"));
  await page.goto(BASE + "/time?w=-3");
  await page.waitForSelector("text=Пар нет");
  check("empty past week renders «Пар нет»", (await text(page)).includes("Пар нет"));
  await page.goto(BASE + "/time?view=week");
  await page.waitForSelector('button[aria-pressed="true"][aria-label="Неделя"]');
  check("?view=week opens the grid", (await page.locator("main button", { hasText: "ауд. 4105" }).count()) > 0);

  await page.goto(BASE + "/time?tab=cons");
  await page.waitForSelector("[data-id]");
  const c0 = await text(page);
  check("Alisa cons: her 5 courses' consultations", ["Соколов", "Morgan", "Ким А. С.", "Петрова", "Орлова"].every((t) => c0.includes(t)));
  check("Alisa cons: none of Maxim's", !["Фролов", "Зайцева", "Громов"].some((t) => c0.includes(t)));
  check("Alisa cons: «Вы идёте», «Мест нет», counts", c0.includes("Вы идёте") && c0.includes("Мест нет") && c0.includes("12 из 12") && c0.includes("9 из 15"));

  // запись через интерфейс
  await page.click(`[data-id="${alisaEng.id}"]`);
  await page.waitForSelector("#cons-q");
  check("modal shows 3 questions from data", (await page.textContent('dialog[open]')).includes("3 вопроса уже прислали"));
  await page.fill("#cons-q", "Как оформить Essay по Remote work");
  await page.click('button:has-text("Записаться")');
  await page.waitForSelector('[role="status"]:has-text("Вы записаны")');
  await waitText(page, "10 из 15");
  check("sign up: count 10 из 15 and «Вы идёте»", (await text(page)).includes("10 из 15") && (await text(page)).includes("Вы идёте"));
  const mine = await db.consultationSignup.findFirst({ where: { consultationId: alisaEng.id, user: { login: "a.vorontsova" } } });
  check("signup stored with question", mine?.question === "Как оформить Essay по Remote work" && (await count(alisaEng.id)) === 10);

  // дубль через подделку
  const dup = await forge(ctx, "signUp", [alisaEng.id, "ещё раз"]);
  check("forged duplicate signUp rejected", dup.body.includes("Вы уже записаны") && (await count(alisaEng.id)) === 10, dup.body.slice(0, 80));

  // обновить вопрос и отменить
  await page.click(`[data-id="${alisaEng.id}"]`);
  await page.waitForSelector("#cons-q");
  await page.fill("#cons-q", "Новый вопрос");
  await page.click('button:has-text("Сохранить")');
  await page.waitForSelector('[role="status"]:has-text("Вопрос сохранён")');
  check("question updated", (await db.consultationSignup.findFirst({ where: { consultationId: alisaEng.id, user: { login: "a.vorontsova" } } }))?.question === "Новый вопрос");
  await page.waitForTimeout(400);
  await page.click(`[data-id="${alisaEng.id}"]`);
  await page.waitForSelector('button:has-text("Отменить запись")');
  await page.click('button:has-text("Отменить запись")');
  await page.waitForSelector('[role="status"]:has-text("Запись отменена")');
  await waitText(page, "9 из 15");
  check("cancel: back to 9 из 15, signup deleted", (await count(alisaEng.id)) === 9 && (await text(page)).includes("9 из 15"));

  // переполненная консультация (Ким, 12 из 12)
  await page.click(`[data-id="${alisaWorld.id}"]`);
  await page.waitForSelector('dialog[open] >> text=Мест нет');
  check("full consultation: modal has no sign-up button", (await page.locator('dialog[open] button:has-text("Записаться")').count()) === 0);
  const full = await forge(ctx, "signUp", [alisaWorld.id, "прорвусь"]);
  check("forged signUp to FULL consultation rejected", full.body.includes("Мест нет") && (await count(alisaWorld.id)) === 12, full.body.slice(0, 80));

  // валидация вопроса
  const long = await forge(ctx, "signUp", [alisaEng.id, "а".repeat(501)]);
  check("question > 500 chars rejected", long.body.includes("не длиннее 500") && (await count(alisaEng.id)) === 9);
  const bad = await forge(ctx, "signUp", [{ $ne: 1 }, 5]);
  check("malformed args rejected", !bad.body.includes('"ok":true') && (await count(alisaEng.id)) === 9);
  // чужой userId в аргументах игнорируется: запись всегда на себя
  const hijack = await forge(ctx, "signUp", [alisaEng.id, "q", (await db.user.findUniqueOrThrow({ where: { login: "m.orlov" } })).id]);
  const maximRow = await db.consultationSignup.count({ where: { consultationId: alisaEng.id, user: { login: "m.orlov" } } });
  check("extra userId argument ignored (signup is for the session user)", hijack.body.includes('"ok":true') && maximRow === 0 && (await count(alisaEng.id)) === 10);
  await forge(ctx, "cancel", [alisaEng.id]);
  check("forged cancel removes only own signup", (await count(alisaEng.id)) === 9);

  // прошедшая консультация не принимает запись: переносим Эконометрику в прошлое только в тесте
  await ctx.close();

  // ---- Максим
  ({ ctx, page } = await login("m.orlov"));
  await page.goto(BASE + "/time?tab=cons");
  await page.waitForSelector("[data-id]");
  const m0 = await text(page);
  check("Maxim cons: his teachers, not Alisa's", ["Фролов", "Зайцева", "Громов"].every((t) => m0.includes(t)) && !["Соколов", "Morgan", "Ким А. С.", "Орлова"].some((t) => m0.includes(t)));
  check("Maxim cons: signed-up «Вы идёте» ×2", (m0.match(/Вы идёте/g) ?? []).length === 2);
  const foreign = await forge(ctx, "signUp", [alisaEng.id, "чужой курс"]);
  check("Maxim forged signUp to Alisa's course rejected (not enrolled)", foreign.body.includes("не найдена") && (await count(alisaEng.id)) === 9, foreign.body.slice(0, 80));
  const foreignCancel = await forge(ctx, "cancel", [alisaEcon.id]);
  check("Maxim forged cancel of Alisa's signup does nothing", (await count(alisaEcon.id)) === 7);
  void foreignCancel;
  await page.goto(BASE + "/time");
  await page.waitForSelector('[data-pair="7"]');
  check("Maxim list: his consultation on pair 7", (await text(page)).includes("Международная безопасность") && !(await text(page)).includes("Эконометрика"));
  // запись на прошедшее время
  await db.consultation.update({ where: { id: maximSec.id }, data: { startsAt: new Date("2026-11-19T10:00:00+03:00"), endsAt: new Date("2026-11-19T11:20:00+03:00") } });
  const past = await forge(ctx, "signUp", [maximSec.id, "поздно"]);
  const pastCancel = await forge(ctx, "cancel", [maximSec.id]);
  check("past consultation: signUp and cancel rejected", past.body.includes("Запись закрыта") && pastCancel.body.includes("Запись закрыта"));
  await db.consultation.update({ where: { id: maximSec.id }, data: { startsAt: new Date("2026-11-19T18:10:00+03:00"), endsAt: new Date("2026-11-19T19:30:00+03:00") } });
  await ctx.close();

  // ---- Преподаватель
  ({ ctx, page } = await login("e.petrova"));
  await page.goto(BASE + "/time");
  await page.waitForSelector("main h1");
  const t = await text(page);
  check("teacher /time: placeholder only", t.includes("Кабинет сотрудника появится здесь") && !t.includes("Эконометрика"));
  const tf = await forge(ctx, "signUp", [alisaEng.id, "q"]);
  check("teacher forged signUp rejected", tf.body.includes("студентам") && (await count(alisaEng.id)) === 9);
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
