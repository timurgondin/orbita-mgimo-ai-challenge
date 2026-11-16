// Запуск: npm run build && PORT=3101 node scripts/notifications-check.mjs  (сам поднимает next start)
// Центр уведомлений: колокольчик, шторка, «Новое», полоса срочного, «прочитано ≠ решено», подделки.
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

const manifest = JSON.parse(readFileSync(new URL("../.next/server/server-reference-manifest.json", import.meta.url), "utf8")).node;
const actionId = (name) => Object.entries(manifest).find(([, v]) => v.exportedName === name && v.filename.includes("notifications"))?.[0];

const server = spawn("node", ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], { env: { ...process.env, COOKIE_SECURE: "false" }, stdio: "ignore" });
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(BASE + "/login")).ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 500));
}

const browser = await chromium.launch();
let ipN = 20;
async function login(name) {
  const ctx = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": `10.7.0.${ipN++}` } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/login");
  await page.fill("#login", name);
  await page.fill("#pass", "orbita-demo");
  await page.click("button[type=submit]");
  await page.waitForURL((u) => u.pathname === "/" || u.pathname === "/welcome");
  await page.waitForTimeout(600);
  return { ctx, page };
}
async function forge(ctx, name, args) {
  const r = await ctx.request.post(BASE + "/", {
    headers: { "Next-Action": actionId(name), "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component" },
    data: JSON.stringify(args),
    maxRedirects: 0,
  });
  return { status: r.status(), body: await r.text() };
}
const notes = (login) => db.notification.findMany({ where: { user: { login } }, orderBy: { createdAt: "asc" } });
const bell = (page) => page.getAttribute("[data-bell]", "data-bell");

try {
  check("action ids found", !!actionId("markSeen") && !!actionId("resolveNotification"));

  const maximBefore = await notes("m.orlov");
  const { ctx, page } = await login("a.vorontsova");

  // колокольчик и «Сегодня»
  check("bell shows 2 pending actions", (await bell(page)) === "2", await bell(page));
  check("urgent strip: book due tomorrow", (await page.locator("[data-urgent]").count()) === 1 && ((await page.textContent("[data-urgent]")) ?? "").includes("Экономикс"));
  const news = (await page.textContent("section[aria-label='Новое']")) ?? "";
  check("«Новое»: action first, urgent not duplicated", news.includes("загранпаспорта") && !news.includes("Экономикс") && news.indexOf("загранпаспорта") < news.indexOf("8 из 10"));

  // «Все» открывает шторку → всё прочитано, но действия висят
  await page.click("[data-open-center]");
  await page.waitForSelector("[role=dialog][aria-label='Уведомления']:not([inert])");
  await page.waitForTimeout(800);
  const drawer = (await page.textContent("[role=dialog][aria-label='Уведомления']")) ?? "";
  check("drawer: «Нужно действие» + day groups", drawer.includes("Нужно действие") && drawer.includes("Сегодня") && drawer.includes("Вчера") && drawer.includes("Ранее"));
  const afterSeen = await notes("a.vorontsova");
  check("opening marks all as read", afterSeen.every((n) => n.readAt));
  check("read ≠ resolved: actions still pending", afterSeen.filter((n) => n.level === "action" && !n.resolvedAt).length === 2);
  check("Maxim's notifications untouched", JSON.stringify(await notes("m.orlov")) === JSON.stringify(maximBefore));

  // вкладки
  await page.click("[role=dialog] button[aria-pressed]:has-text('Расписание')");
  const sched = (await page.textContent("[role=dialog][aria-label='Уведомления']")) ?? "";
  check("tab «Расписание» filters", sched.includes("Английский переехал") && !sched.includes("8 из 10") && !sched.includes("Экономикс"));
  await page.click("[role=dialog] button[aria-pressed]:has-text('Все')");

  // «Продлить» прямо в шторке
  await page.click("[role=dialog] [data-action-card] button:has-text('Продлить')");
  await page.waitForSelector("text=Книга продлена на две недели");
  await page.waitForTimeout(800);
  const book = (await notes("a.vorontsova")).find((n) => n.category === "library");
  check("resolve: book extended, title updated", !!book.resolvedAt && book.title === "«Экономикс» продлена" && book.body === "Вернуть до 4 декабря", `${book.title} / ${book.body}`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  check("bell now 1, strip gone", (await bell(page)) === "1" && (await page.locator("[data-urgent]").count()) === 0, await bell(page));

  // подделки
  const maximNote = maximBefore.find((n) => n.level === "action");
  const linkNote = afterSeen.find((n) => n.actionKind === "link" && n.level === "action");
  const f1 = await forge(ctx, "resolveNotification", [maximNote.id]);
  const f2 = await forge(ctx, "resolveNotification", [linkNote.id]);
  const f3 = await forge(ctx, "resolveNotification", [book.id]);
  const f4 = await forge(ctx, "resolveNotification", ["' OR 1=1 --"]);
  const f5 = await forge(ctx, "resolveNotification", [{ id: maximNote.id }]);
  check("cannot resolve another user's notification", f1.body.includes("Уведомление не найдено") && !(await db.notification.findUniqueOrThrow({ where: { id: maximNote.id } })).resolvedAt);
  check("link-action cannot be «resolved» by request", f2.body.includes("не требует действия") && !(await db.notification.findUniqueOrThrow({ where: { id: linkNote.id } })).resolvedAt);
  check("double resolve rejected", f3.body.includes("Уже сделано"));
  check("garbage / object id rejected", f4.body.includes("Уведомление не найдено") && f5.body.includes("Уведомление не найдено"));

  // без входа
  const anonCtx = await browser.newContext();
  const anon = await forge(anonCtx, "resolveNotification", [maximNote.id]);
  check("anonymous resolve → redirect to /login, nothing changed", [303, 307, 308].includes(anon.status) || anon.body.includes("/login"), String(anon.status));
  check("Maxim still has his action", !(await db.notification.findUniqueOrThrow({ where: { id: maximNote.id } })).resolvedAt);

  // Максим: срок через неделю — без полосы, но число на колокольчике
  const { page: mp } = await login("m.orlov");
  check("Maxim: bell 1, no urgent strip", (await bell(mp)) === "1" && (await mp.locator("[data-urgent]").count()) === 0);

  // преподаватель: пустой центр
  const { page: tp } = await login("e.petrova");
  await tp.click("[data-bell]");
  await tp.waitForSelector("text=Здесь пусто");
  check("teacher: empty center", true);
} finally {
  await browser.close();
  server.kill();
  execSync("npm run db:seed", { stdio: "ignore" });
  await db.$disconnect();
}
const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
