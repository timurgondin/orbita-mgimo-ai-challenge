// Запуск: npm run build && PORT=3101 node scripts/coffee-check.mjs  (сам поднимает next start)
// Random Coffee: пара недели, согласие и Telegram, другое время, пропуск, подбор при вступлении, подделки (чужая встреча, неверные данные, преподаватель).
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
const uid = async (login) => (await db.user.findUniqueOrThrow({ where: { login } })).id;

const SHOTS = process.env.SHOTS; // путь к docs/screenshots — снять экраны
const shot = async (page, name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

try {
  const alice = await uid("a.vorontsova");
  const maxim = await uid("m.orlov");
  const match = await db.coffeeMatch.findFirstOrThrow({ where: { week: "2026-11-16", members: { some: { userId: alice } } } });

  const { ctx, page } = await login("a.vorontsova", { width: 1280, height: 900 });
  await open(page, "/coffee");
  await page.waitForSelector("[data-coffee-match]");
  const card = (await page.locator("[data-coffee-match]").textContent()) ?? "";
  check("pair of the week: name, programme, slot, place", card.includes("Егор Миронов") && card.includes("Мировая политика, 3 курс") && card.includes("Пятница, 20 ноября, с 12:30 до 13:00") && card.includes("Кофейня «Зерно»"));
  const shared = await page.locator("[data-shared]").allTextContents();
  check("shared interests first", [...shared].sort().join() === "Кино,Настолки,Стартапы" && (await page.locator("[data-partner-interests] > span").first().getAttribute("data-shared")) !== null, shared.join());
  check("partner agreed, Telegram hidden until both agree", (await page.locator('[data-coffee-state="ready"]').count()) === 1 && !(await page.content()).includes("egor_mrn"));
  check("past meetings: 3, last one asks «Встретились?»", (await page.locator("[data-past]").count()) === 3 && (await page.locator("[data-met-ask]").count()) === 1);
  await shot(page, "coffee-desktop");

  await page.click("[data-coffee-yes]");
  await page.waitForSelector('[data-coffee-state="both"]');
  check("both agreed: Telegram shown", (await page.locator("[data-partner-tg]").textContent())?.includes("@egor_mrn"));
  await shot(page, "coffee-agreed");

  await page.click("[data-met-yes]");
  await page.waitForSelector("[data-met-ask]", { state: "detached" });
  const vera = await db.coffeeMatch.findFirstOrThrow({ where: { week: "2026-11-09", members: { some: { userId: alice } } }, include: { members: true } });
  check("met mark saved for own side only", vera.members.find((m) => m.userId === alice)?.met === true);

  await page.click("[data-coffee-move]");
  await page.waitForSelector("dialog[open] [data-slots]");
  const options = await page.locator("dialog[open] [data-slot-option]").count();
  check("other time: free windows of both", options >= 2, String(options));
  await shot(page, "coffee-move");
  const opt = await page.locator("dialog[open] [data-slot-option]").nth(1).getAttribute("value");
  await page.locator("dialog[open] label").nth(1).click();
  await page.click("dialog[open] [data-move-send]");
  await page.waitForSelector('[data-coffee-state="waiting"]');
  const moved = await db.coffeeMatch.findUniqueOrThrow({ where: { id: match.id }, include: { members: true } });
  check("rescheduled: new slot, partner asked again, Telegram hidden", moved.startsAt.toISOString() === opt && moved.members.find((m) => m.userId !== alice)?.answer === "new" && (await page.locator("[data-partner-tg]").count()) === 0);

  // подделки
  const busy = await forge(ctx, "coffee", "rescheduleCoffee", [match.id, "2026-11-20T08:10:00.000Z"], "/coffee");
  check("reschedule into a class rejected", busy.body.includes("Это время занято"));
  const junk = await forge(ctx, "coffee", "rescheduleCoffee", [match.id, "x".repeat(500)], "/coffee");
  check("junk time rejected", junk.body.includes("Неверное время"));
  const bad = await forge(ctx, "coffee", "saveCoffee", [{ interests: ["Кино", "Бег", "<script>"], format: "campus" }], "/coffee");
  check("unknown interest rejected", bad.body.includes("Неверные данные"));
  const many = await forge(ctx, "coffee", "saveCoffee", [{ interests: ["Кино", "Бег", "ИИ", "Книги", "Театр", "Музыка", "Дизайн"], format: "campus" }], "/coffee");
  check("too many interests rejected", many.body.includes("от 3 до 6"));
  const fmt = await forge(ctx, "coffee", "saveCoffee", [{ interests: ["Кино", "Бег", "ИИ"], format: "moon" }], "/coffee");
  check("unknown format rejected", fmt.body.includes("Неверные данные"));
  const early = await forge(ctx, "coffee", "markCoffeeMet", [match.id, true], "/coffee");
  check("can't mark a future meeting as met", early.body.includes("ещё впереди"));
  const ans = await forge(ctx, "coffee", "answerCoffee", [match.id, "maybe"], "/coffee");
  check("unknown answer rejected", ans.body.includes("Неверный ответ"));

  // Максим: не участвует → вступает → пара подбирается сразу
  const { ctx: mctx, page: mp } = await login("m.orlov", { width: 390, height: 844 });
  const foreign = await forge(mctx, "coffee", "answerCoffee", [match.id, "skip"], "/coffee");
  const after = await db.coffeeMatch.findUniqueOrThrow({ where: { id: match.id } });
  check("someone else's meeting: not found, untouched", foreign.body.includes("Встреча не найдена") && after.status === "active");
  const foreignMove = await forge(mctx, "coffee", "rescheduleCoffee", [match.id, opt], "/coffee");
  check("someone else's meeting can't be moved", foreignMove.body.includes("Встреча не найдена"));
  await open(mp, "/coffee");
  check("not joined: join form, no pair", (await mp.locator("[data-coffee-join]").count()) === 1 && (await mp.locator("[data-coffee-match]").count()) === 0);
  check("Maxim doesn't see Alice's pair", !(await mp.content()).includes("Егор Миронов"));
  await shot(mp, "coffee-join-mobile");
  for (const i of ["Политика", "Языки", "Путешествия"]) await mp.click(`[data-interests] button:has-text('${i}')`);
  await mp.click("[data-coffee-save]");
  await mp.waitForSelector("[data-coffee-match]");
  const mm = await db.coffeeMatch.findFirst({ where: { week: "2026-11-16", members: { some: { userId: maxim } } }, include: { members: { include: { user: true } } } });
  const partner = mm?.members.find((m) => m.userId !== maxim)?.user;
  check("joined: matched at once with a free student, not Alice's partner", !!partner && partner.lastName !== "Миронов" && partner.id !== alice, partner && `${partner.firstName} ${partner.lastName}`);
  check("match notification", (await db.notification.count({ where: { userId: maxim, kind: "coffee" } })) === 1);
  await shot(mp, "coffee-mobile");

  // пропуск недели
  await page.reload();
  await page.click("[data-coffee-skip]");
  await page.waitForSelector('[data-coffee-state="cancelled"]');
  check("skip: meeting cancelled", (await db.coffeeMatch.findUniqueOrThrow({ where: { id: match.id } })).status === "cancelled");

  // пауза
  await page.click("[data-coffee-settings]");
  await page.click("dialog[open] [data-coffee-pause]");
  await page.waitForSelector("[data-coffee-join]");
  check("pause: profile inactive", (await db.coffeeProfile.findUniqueOrThrow({ where: { userId: alice } })).active === false);

  const { ctx: tctx, page: tp } = await login("e.petrova");
  const t = await forge(tctx, "coffee", "saveCoffee", [{ interests: ["Кино", "Бег", "ИИ"], format: "campus" }], "/coffee");
  check("teacher can't join", t.body.includes("для студентов"));
  await open(tp, "/coffee");
  check("teacher: no Random Coffee page", new URL(tp.url()).pathname === "/");
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
