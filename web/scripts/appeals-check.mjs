// Запуск: npm run build && PORT=3101 node scripts/appeals-check.mjs  (сам поднимает next start)
// «Красная кнопка»: обращения в приёмную ректора — только свои, адресат из справочника, автор из сессии, лимит в сутки.
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
async function forge(ctx, args) {
  const r = await ctx.request.post(BASE + "/redbutton", {
    headers: { "Next-Action": actionId("sendAppeal", "appeals"), "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component" },
    data: JSON.stringify([args]),
    maxRedirects: 0,
  });
  return { status: r.status(), body: await r.text() };
}

const browser = await chromium.launch();
let ipN = 60;
async function login(name, viewport) {
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
const uid = async (login) => (await db.user.findUniqueOrThrow({ where: { login } })).id;
const TEXT = "Спасибо за разбор олигополии на консультации — наконец поняла модель Курно.";

try {
  const { ctx, page } = await login("a.vorontsova");
  const me = await uid("a.vorontsova");
  await open(page, "/redbutton");
  const nums = await page.locator("[data-appeal]").evaluateAll((els) => els.map((e) => e.getAttribute("data-appeal")));
  check("own appeals listed, newest first", nums.join(",") === "1046,1041,1037", nums.join(","));
  check("someone else's appeal not shown", !nums.includes("1044") && !(await page.content()).includes("перенесли накануне"));
  check("send disabled until form is complete", await page.locator("[data-send]").isDisabled());

  // окно по ссылке из уведомления
  await open(page, "/redbutton?appeal=1037");
  await page.waitForSelector('dialog[open] [data-appeal-modal="1037"]');
  check("?appeal opens appeal with tracker and answer", (await page.locator('dialog[open] [data-step="fin"]').count()) === 4 && (await page.locator("dialog[open] [data-answer]").count()) === 1);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  const note = await db.notification.count({ where: { userId: me, link: "/redbutton?appeal=1037" } });
  check("answer notification links to the appeal", note === 1);

  // отправка через интерфейс: благодарность преподавателю, анонимно
  await page.click('[data-kind="thanks"]');
  await page.click("[data-pick]");
  await page.waitForSelector("dialog[open] [data-picker-search]");
  check("picker: my teachers on top", (await page.locator('dialog[open] [data-target="petrova-ea"]').count()) === 1 && (await page.locator('dialog[open] [data-target-kind="staff"]').count()) > 0);
  await page.fill("dialog[open] [data-picker-search]", "библ");
  await page.waitForTimeout(200);
  check("picker search", (await page.locator('dialog[open] [data-target="library"]').count()) === 1 && (await page.locator('dialog[open] [data-target="petrova-ea"]').count()) === 0);
  await page.fill("dialog[open] [data-picker-search]", "петрова");
  await page.click('dialog[open] [data-target="petrova-ea"]');
  await page.waitForTimeout(400);
  check("picked target shown", (await page.locator('[data-picked="petrova-ea"]').count()) === 1);
  await page.fill("[data-text]", TEXT);
  check("sender: own name chosen by default", (await page.locator('[data-from="me"][aria-checked="true"]').count()) === 1 && (await page.locator('[data-from="anon"][aria-checked="false"]').count()) === 1);
  await page.click('[data-from="anon"]');
  await page.click("[data-send]");
  await page.waitForSelector('[data-appeal="1047"]');
  const created = await db.appeal.findUnique({ where: { number: 1047 } });
  check("appeal saved: author from session, anonymous, routed to department", created?.userId === me && created.anonymous === true && created.kind === "thanks" && created.forwardedTo === "Кафедра экономики" && created.status === "sent");
  check("form reset after sending", (await page.locator("[data-text]").inputValue()) === "" && (await page.locator('[data-picked]').count()) === 0 && (await page.locator('[data-from="me"][aria-checked="true"]').count()) === 1);

  // подделанные запросы
  const before = await db.appeal.count();
  const bad = [
    { kind: "bribe", targetKind: "none", targetId: null, text: TEXT, anonymous: false },
    { kind: "complaint", targetKind: "teacher", targetId: "no-such-teacher", text: TEXT, anonymous: false },
    { kind: "complaint", targetKind: "teacher", targetId: "../petrova-ea", text: TEXT, anonymous: false },
    { kind: "complaint", targetKind: "staff", targetId: "rector-himself", text: TEXT, anonymous: false },
    { kind: "complaint", targetKind: "free", targetId: "Любой текст", text: TEXT, anonymous: false },
    { kind: "complaint", targetKind: "none", targetId: null, text: "коротко", anonymous: false },
    { kind: "complaint", targetKind: "none", targetId: null, text: "x".repeat(2001), anonymous: false },
    { kind: "complaint", targetKind: "none", targetId: null, text: TEXT, anonymous: "yes" },
  ];
  for (const b of bad) await forge(ctx, b);
  check("forged kind / target / text / flags rejected", (await db.appeal.count()) === before);

  const orlov = await uid("m.orlov");
  await forge(ctx, { kind: "idea", targetKind: "unit", targetId: "canteen", text: TEXT, anonymous: false, userId: orlov, number: 1 });
  const forged = await db.appeal.findFirst({ where: { targetId: "canteen" }, orderBy: { number: "desc" } });
  check("author always from session, number from server", forged?.userId === me && forged.number === 1048);

  for (let i = 0; i < 5; i++) await forge(ctx, { kind: "complaint", targetKind: "none", targetId: null, text: TEXT, anonymous: false });
  const mineToday = await db.appeal.count({ where: { userId: me, createdAt: { gt: new Date("2026-11-18T11:49:00+03:00") } } });
  check("no more than 5 appeals per day", mineToday === 5, String(mineToday));

  // другой студент не видит чужие обращения, даже по ссылке
  const o = await login("m.orlov");
  await open(o.page, "/redbutton?appeal=1037");
  await o.page.waitForTimeout(800);
  const oNums = await o.page.locator("[data-appeal]").evaluateAll((els) => els.map((e) => e.getAttribute("data-appeal")));
  check("other student sees only own", oNums.join(",") === "1044" && (await o.page.locator("dialog[open] [data-appeal-modal]").count()) === 0);

  // преподаватель: доступ из меню профиля
  const t = await login("e.petrova");
  await open(t.page, "/");
  await t.page.click('button[aria-label="Профиль и настройки"]');
  await t.page.click("[data-redbutton-link]");
  await t.page.waitForURL((u) => u.pathname === "/redbutton");
  await t.page.waitForSelector("[data-composer]");
  check("teacher opens the red button from the profile menu", (await t.page.locator("[data-appeal]").count()) === 0);

  // телефон 360 px: без горизонтальной прокрутки
  const m = await login("a.vorontsova", { width: 360, height: 780 });
  await open(m.page, "/redbutton");
  const overflow = await m.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("360 px: no horizontal scroll", overflow <= 0, String(overflow));
  await m.page.click("[data-pick]");
  await m.page.waitForSelector("dialog[open] [data-picker-search]");
  check("360 px: picker opens as a sheet", (await m.page.locator('dialog[open][data-sheet="full"]').count()) === 1);
} finally {
  await browser.close();
  server.kill();
  await db.$disconnect();
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
