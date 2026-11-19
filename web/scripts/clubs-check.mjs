// Запуск: npm run build && PORT=3101 node scripts/clubs-check.mjs  (сам поднимает next start)
// «Клубы»: вступление и заявки, подделанные id, чужое участие, преподаватель.
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
const dialog = (page) => page.locator("dialog[open]");
const uid = async (login) => (await db.user.findUniqueOrThrow({ where: { login } })).id;

try {
  const { ctx, page } = await login("a.vorontsova");
  await open(page, "/clubs");
  await page.waitForSelector("[data-club]");
  check("clubs: 12 clubs, own section", (await page.locator("[data-club]").count()) === 12 && (await page.locator("[data-my-club]").count()) === 3);
  await page.click("button[aria-pressed]:has-text('Спорт')");
  await page.waitForTimeout(300);
  check("category filter", (await page.locator("[data-club]").count()) === 3);
  await page.click("button[aria-pressed]:has-text('Все')");

  await page.click('[data-club="running"]');
  await page.waitForSelector("dialog[open] [data-leader]");
  const d = (await dialog(page).textContent()) ?? "";
  check("club modal: description, leader, schedule", d.includes("Полина Корнеева") && d.includes("Вт и Пт, 07:30") && (await page.locator('dialog[open] a[href^="mailto:p.korneeva"]').count()) === 1);
  await page.click("dialog[open] [data-club-join]");
  await page.waitForSelector("text=Вы в клубе");
  const me = await uid("a.vorontsova");
  const running = await db.club.findUniqueOrThrow({ where: { slug: "running" } });
  check("join open club: member at once", (await db.clubMember.findFirst({ where: { clubId: running.id, userId: me } }))?.status === "member");
  await page.keyboard.press("Escape");

  await page.click('[data-club="byte"]');
  await page.click("dialog[open] [data-club-join]");
  await page.waitForSelector("text=Заявка отправлена руководителю");
  const byte = await db.club.findUniqueOrThrow({ where: { slug: "byte" } });
  check("club with selection: application pending", (await db.clubMember.findFirst({ where: { clubId: byte.id, userId: me } }))?.status === "pending");
  await page.keyboard.press("Escape");

  // подделки
  const twice = await forge(ctx, "clubs", "joinClub", [running.id], "/clubs");
  check("join twice rejected", twice.body.includes("уже в клубе"));
  const unknown = await forge(ctx, "clubs", "joinClub", ["nope"], "/clubs");
  check("unknown club rejected", unknown.body.includes("Клуб не найден"));
  const chess = await db.club.findUniqueOrThrow({ where: { slug: "chess" } });
  const notMine = await forge(ctx, "clubs", "leaveClub", [chess.id], "/clubs");
  check("leave a club you're not in rejected", notMine.body.includes("не состоите"));
  const maxim = await uid("m.orlov");
  check("Maxim's chess membership untouched", (await db.clubMember.count({ where: { clubId: chess.id, userId: maxim } })) === 1);

  const cyc = await db.club.findUniqueOrThrow({ where: { slug: "cycling" } });
  const left = await forge(ctx, "clubs", "leaveClub", [cyc.id], "/clubs");
  check("leave own club", left.body.includes("Готово") && (await db.clubMember.count({ where: { clubId: cyc.id, userId: me } })) === 0);

  const { page: mp } = await login("m.orlov");
  await open(mp, "/clubs");
  const mine = await mp.locator("[data-my-club]").evaluateAll((els) => els.map((e) => e.getAttribute("data-my-club")).sort().join());
  check("Maxim sees only his clubs", mine === "chess,mun", mine);

  const { ctx: tctx } = await login("e.petrova");
  const t = await forge(tctx, "clubs", "joinClub", [running.id], "/clubs");
  check("teacher can't join as a student", t.body.includes("Клубы доступны студентам"));
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
