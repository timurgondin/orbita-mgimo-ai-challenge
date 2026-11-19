// Запуск: npm run build && PORT=3101 node scripts/library-check.mjs  (сам поднимает next start)
// «Библиотека»: продление (правила, уведомление), бронь, читалка, чужие выдачи.
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

  // бронь печатного экземпляра
  const vienna = await db.book.findUniqueOrThrow({ where: { slug: "vienna" } });
  await open(page, "/library");
  await page.click('[data-course-book="vienna"] [data-hold]');
  await page.waitForSelector("text=Забронировано");
  check("hold: a copy taken from available", (await db.book.findUniqueOrThrow({ where: { slug: "vienna" } })).available === vienna.available - 1);
  const holdAgain = await forge(ctx, "library", "holdBook", [vienna.id], "/library");
  check("double hold rejected", holdAgain.body.includes("Уже забронирована"));
  const protocol = await db.book.findUniqueOrThrow({ where: { slug: "protocol" } });
  const none = await forge(ctx, "library", "holdBook", [protocol.id], "/library");
  check("hold with no free copies rejected", none.body.includes("Свободных экземпляров нет"));
  const ebookOnly = await db.book.findUniqueOrThrow({ where: { slug: "micro-problems" } });
  const eb = await forge(ctx, "library", "holdBook", [ebookOnly.id], "/library");
  check("e-book can't be held", eb.body.includes("Книга не найдена"));
  const hold = await db.loan.findFirstOrThrow({ where: { userId: me, kind: "hold" } });
  const cancel = await forge(ctx, "library", "cancelHold", [hold.id], "/library");
  check("cancel hold returns the copy", cancel.body.includes("Бронь отменена") && (await db.book.findUniqueOrThrow({ where: { slug: "vienna" } })).available === vienna.available);

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
