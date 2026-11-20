// Запуск: npm run build && PORT=3101 node scripts/library-check.mjs  (сам поднимает next start)
// «Библиотека»: продление (правила, уведомление), заказ в постамат и на станцию, выдача по Орбита ID, каталог, читалка, чужие выдачи и заказы.
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
/** Подделанный вызов server action: аргументы — JSON (как шлёт React для простых значений). */
async function forge(ctx, file, name, args, path = "/") {
  const r = await ctx.request.post(BASE + path, {
    headers: { "Next-Action": actionId(name, file), "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component" },
    data: JSON.stringify(args),
    maxRedirects: 0,
  });
  return { status: r.status(), body: await r.text() };
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
const uid = async (login) => (await db.user.findUniqueOrThrow({ where: { login } })).id;

try {
  const { ctx, page } = await login("a.vorontsova");
  await open(page, "/library");
  await page.waitForSelector("[data-loan]");
  check("library: 5 books on hand, Orbita ID button", (await page.locator("[data-loan]").count()) === 5 && (await page.locator("[data-orbita-id]").count()) === 1);
  check("Экономикс due tomorrow", ((await page.textContent('[data-loan="economix"]')) ?? "").includes("Завтра до 10:00"));
  await page.click("[data-orbita-id]");
  await page.waitForSelector("dialog[open] [data-student-card]");
  check("Orbita ID opens the card with QR", (await page.locator("dialog[open] svg").count()) > 0);
  await page.keyboard.press("Escape");

  await page.click('[data-loan="economix"] [data-renew]');
  await page.waitForSelector("text=Продлено до 4 декабря");
  const me = await uid("a.vorontsova");
  const eco = await db.loan.findFirstOrThrow({ where: { userId: me, book: { slug: "economix" } } });
  const note = await db.notification.findFirstOrThrow({ where: { userId: me, refId: "book:economix" } });
  check("renew: +14 days, counter, notification resolved", eco.renewals === 1 && eco.dueAt.toISOString().startsWith("2026-12-04") && !!note.resolvedAt);

  const semester = await db.loan.findFirstOrThrow({ where: { userId: me, kind: "semester", returnedAt: null } });
  const s = await forge(ctx, "library", "renewLoan", [semester.id], "/library");
  check("semester textbook can't be renewed", s.body.includes("на учебный год"));
  const maxLoan = await db.loan.findFirstOrThrow({ where: { user: { login: "m.orlov" }, returnedAt: null } });
  const foreign = await forge(ctx, "library", "renewLoan", [maxLoan.id], "/library");
  check("foreign loan: not found", foreign.body.includes("Книга не найдена"));
  await forge(ctx, "library", "renewLoan", [eco.id], "/library");
  const third = await forge(ctx, "library", "renewLoan", [eco.id], "/library");
  check("max two renewals", third.body.includes("дважды"));

  // заказы: трекер, постамат по Орбита ID
  await open(page, "/library");
  check("two orders: one ready in a locker, one in transit", (await page.locator("[data-order-card]").count()) === 2 && (await page.locator('[data-order-card="game-theory"][data-status="ready"] [data-pickup]').count()) === 1 && (await page.locator('[data-order-card="negotiations"] [data-pickup]').count()) === 0);
  check("history grouped by semester with «take again»", (await page.locator("[data-history]").count()) === 4 && (await text(page)).includes("Весна 2026") && (await page.locator("[data-again]").count()) === 4);
  const transit = await db.bookOrder.findFirstOrThrow({ where: { userId: me, status: "transit" } });
  const early = await forge(ctx, "library", "pickupOrder", [transit.id], "/library");
  check("can't pick up an order in transit", early.body.includes("ещё в пути"));
  await page.click('[data-order-card="game-theory"] [data-pickup]');
  await page.waitForSelector("dialog[open] [data-pickup-modal] svg");
  check("locker window: cell number and Orbita ID QR", ((await page.textContent("dialog[open] [data-pickup-modal]")) ?? "").includes("Ячейка 14"));
  await page.click("dialog[open] [data-open-cell]");
  await page.waitForSelector("dialog[open] >> text=Ячейка 14 открыта");
  const picked = await db.bookOrder.findFirstOrThrow({ where: { userId: me, book: { slug: "game-theory" } } });
  const gameLoan = await db.loan.findFirst({ where: { userId: me, book: { slug: "game-theory" }, returnedAt: null } });
  check("pickup: order closed, book on hand for two weeks", picked.status === "picked" && !!picked.closedAt && gameLoan?.kind === "short" && gameLoan.dueAt.toISOString().startsWith("2026-12-03"));
  const again = await forge(ctx, "library", "pickupOrder", [picked.id], "/library");
  check("second pickup rejected", again.body.includes("Заказ не найден"));
  await page.keyboard.press("Escape");

  // каталог: полка к курсам, поиск, разделы, заказ на станцию выдачи
  await open(page, "/library?tab=catalog");
  await page.waitForSelector("[data-catalog]");
  const total = await db.book.count();
  check("catalog: whole fund + course shelf", (await page.locator("[data-catalog] [data-book]").count()) === total && (await page.locator("[data-course-shelf] [data-book]").count()) > 0);
  await page.fill("[data-catalog-search]", "переговоры");
  await page.waitForTimeout(300);
  check("search by title", (await page.locator("[data-catalog] [data-book]").count()) === 1);
  await page.fill("[data-catalog-search]", "гончаров");
  await page.waitForTimeout(300);
  check("search by author", (await page.locator("[data-catalog] [data-book]").count()) === 3);
  await page.fill("[data-catalog-search]", "");
  await page.click('[data-shelf="Право"]');
  check("shelf chip filters", (await page.locator("[data-catalog] [data-book]").count()) === (await db.book.count({ where: { shelf: "Право" } })));
  const vienna = await db.book.findUniqueOrThrow({ where: { slug: "vienna" } });
  await page.click('[data-catalog] [data-book="vienna"]');
  await page.waitForSelector('dialog[open] [data-book-modal="vienna"]');
  check("book window: about and pickup points", ((await page.textContent("dialog[open]")) ?? "").includes("Постатейный комментарий") && (await page.locator("dialog[open] [data-point]").count()) === 4);
  await page.click('dialog[open] label:has([data-point="station"])');
  await page.click("dialog[open] [data-order]");
  await page.waitForSelector("text=Заказано, привезём сегодня к 15:00");
  const vOrder = await db.bookOrder.findFirstOrThrow({ where: { userId: me, bookId: vienna.id, closedAt: null } });
  check("order: station, packing, copy taken", vOrder.point === "station" && vOrder.status === "packing" && (await db.book.findUniqueOrThrow({ where: { id: vienna.id } })).available === vienna.available - 1);
  await page.waitForTimeout(600);
  check("catalog shows «Заказана»", ((await page.textContent('[data-catalog] [data-book="vienna"]')) ?? "").includes("Заказана"));
  const dbl = await forge(ctx, "library", "orderBook", [vienna.id, "locker-a"], "/library");
  check("double order rejected", dbl.body.includes("Уже заказана"));
  const protocol = await db.book.findUniqueOrThrow({ where: { slug: "protocol" } });
  const none = await forge(ctx, "library", "orderBook", [protocol.id, "locker-a"], "/library");
  check("order with no free copies rejected", none.body.includes("Свободных экземпляров нет"));
  const ebookOnly = await db.book.findUniqueOrThrow({ where: { slug: "micro-problems" } });
  const eb = await forge(ctx, "library", "orderBook", [ebookOnly.id, "locker-a"], "/library");
  check("e-book can't be ordered", eb.body.includes("Книга не найдена"));
  const ecoBook = await db.book.findUniqueOrThrow({ where: { slug: "economix" } });
  const own = await forge(ctx, "library", "orderBook", [ecoBook.id, "locker-a"], "/library");
  check("book on hand can't be ordered", own.body.includes("уже у вас"));
  const badPoint = await forge(ctx, "library", "orderBook", [protocol.id, "../admin"], "/library");
  check("unknown pickup point rejected", badPoint.body.includes("Выберите, где забрать"));
  const cancel = await forge(ctx, "library", "cancelOrder", [vOrder.id], "/library");
  check("cancel order returns the copy", cancel.body.includes("Заказ отменён") && (await db.book.findUniqueOrThrow({ where: { slug: "vienna" } })).available === vienna.available);

  // читалка
  await open(page, "/library/read/micro-problems");
  await page.waitForSelector("[data-reader-page]");
  check("reader opens where you stopped", (await page.getAttribute("[data-reader-page]", "data-reader-page")) === "42");
  await page.click("[data-next-page]");
  await page.waitForSelector('[data-reader-page="43"]');
  await page.waitForTimeout(600);
  check("next page saved", (await db.reading.findFirstOrThrow({ where: { userId: me, bookId: ebookOnly.id } })).page === 43);
  await open(page, "/library/read/vienna");
  check("print-only book has no reader", (await page.locator("[data-reader-page]").count()) === 0);
  const badPage = await forge(ctx, "library", "saveReading", [ebookOnly.id, 99999], "/library");
  check("reading page out of range rejected", badPage.body.includes("Книга не найдена"));

  // Максим: на книгу очередь — продлить нельзя
  const { ctx: mctx, page: mp } = await login("m.orlov");
  const wp = await forge(mctx, "library", "renewLoan", [maxLoan.id], "/library");
  check("queue on the book: no renewal", wp.body.includes("очередь"));
  const foreignCancel = await forge(mctx, "library", "cancelOrder", [transit.id], "/library");
  const foreignPickup = await forge(mctx, "library", "pickupOrder", [transit.id], "/library");
  check("Maxim can't cancel or pick up Alisa's order", foreignCancel.body.includes("Заказ не найден") && foreignPickup.body.includes("Заказ не найден"));
  await open(mp, "/library");
  check("Maxim sees only his books", (await mp.locator("[data-loan]").count()) === 2 && !(await text(mp)).includes("Экономикс"));
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
