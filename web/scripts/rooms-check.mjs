// Запуск: npm run build && PORT=3101 node scripts/rooms-check.mjs  (сам поднимает next start)
// «Аудитории»: бронь переговорок и свободных аудиторий, отметка по Орбита ID, чужие брони недоступны, правила — на сервере.
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
/** Переговорка, свободная в это время по броням в БД (у переговорок нет пар). */
async function freeMeet(date, start, dur, not = []) {
  const a = new Date(`${date}T00:00:00+03:00`).getTime() + start * 60_000;
  const b = a + dur * 60_000;
  for (const id of ["vega", "altair", "sirius", "lyra", "orion", "cassiopeia", "andromeda", "polaris"].filter((x) => !not.includes(x))) {
    const hit = await db.roomBooking.count({ where: { roomId: id, status: { in: ["booked", "checked"] }, startsAt: { lt: new Date(b) }, endsAt: { gt: new Date(a) } } });
    if (!hit) return id;
  }
  throw new Error("no free meeting room");
}
const book = (ctx, args) => forge(ctx, "rooms", "bookRoom", [args], "/rooms");

try {
  const { ctx, page } = await login("a.vorontsova");
  const me = await uid("a.vorontsova");
  await open(page, "/rooms");
  await page.waitForSelector("[data-room-list]");
  check("rooms: 14 rooms, 6 days, own bookings", (await page.locator("[data-room]").count()) === 14 && (await page.locator("[data-day]").count()) === 6 && (await page.locator('[data-mine] [data-booking="vega"][data-state="upcoming"]').count()) === 1);
  check("missed booking shown as released", (await page.locator('[data-past] [data-state="missed"]').count()) === 1);
  check("free rooms listed first", (await page.locator("[data-room]").first().getAttribute("data-free")) === "1");

  await page.click('[data-equip="vks"]');
  const vks = await page.locator("[data-room]").evaluateAll((els) => els.map((e) => e.getAttribute("data-room")));
  check("equipment filter", vks.length > 0 && vks.every((id) => ["sirius", "lyra", "orion", "andromeda", "a4207"].includes(id)));
  await page.click('[data-equip="vks"]');
  for (let i = 0; i < 9; i++) await page.click('[aria-label="Больше"]');
  const big = await page.locator("[data-room]").evaluateAll((els) => els.map((e) => e.getAttribute("data-room")));
  check("seats filter (10 people)", big.length > 0 && !big.includes("vega") && !big.includes("sirius") && big.includes("orion"));

  // бронь через интерфейс: Альтаир сегодня с 12:00 на час (свободен по сиду)
  await open(page, "/rooms");
  await page.click('[data-room="altair"]');
  await page.fill("dialog[open] [data-title]", "Проект по праву");
  await page.click("dialog[open] [data-book]");
  await page.waitForSelector("text=Альтаир: сегодня с 12:00 до 13:00");
  const mine = await db.roomBooking.findFirstOrThrow({ where: { userId: me, roomId: "altair", status: "booked" } });
  check("booked in DB", mine.title === "Проект по праву" && mine.startsAt.toISOString() === "2026-11-19T09:00:00.000Z");
  await page.waitForSelector('[data-mine] [data-booking="altair"][data-state="checkin"]');
  await page.click('[data-mine] [data-booking="altair"] [data-checkin]');
  await page.waitForSelector("text=Комната ваша до 13:00");
  check("check-in by Orbita ID", (await db.roomBooking.findUniqueOrThrow({ where: { id: mine.id } })).status === "checked");
  await page.waitForSelector('[data-mine] [data-booking="altair"][data-state="active"]');
  await page.click('[data-mine] [data-booking="altair"] button');
  await page.click("dialog[open] [data-release]");
  await page.waitForSelector("text=Комната освобождена");
  check("release early frees the room", (await db.roomBooking.findUniqueOrThrow({ where: { id: mine.id } })).endsAt.toISOString() === "2026-11-19T08:49:00.000Z");

  // подделанные запросы
  check("unknown room", (await book(ctx, { roomId: "zzz", date: "2026-11-20", start: 600, duration: 60 })).body.includes("Комната не найдена"));
  check("date outside the week", (await book(ctx, { roomId: "vega", date: "2026-12-01", start: 600, duration: 60 })).body.includes("на неделю вперёд"));
  check("sunday refused", (await book(ctx, { roomId: "vega", date: "2026-11-22", start: 600, duration: 60 })).body.includes("на неделю вперёд"));
  check("past time refused", (await book(ctx, { roomId: "vega", date: "2026-11-19", start: 600, duration: 60 })).body.includes("уже прошло"));
  check("off-grid start refused", (await book(ctx, { roomId: "vega", date: "2026-11-20", start: 605, duration: 60 })).body.includes("уже прошло"));
  check("bad duration refused", (await book(ctx, { roomId: "vega", date: "2026-11-20", start: 600, duration: 45 })).body.includes("до 2 часов"));
  check("after closing refused", (await book(ctx, { roomId: "vega", date: "2026-11-20", start: 1230, duration: 60 })).body.includes("до 21:00"));
  check("classroom during a class refused", (await book(ctx, { roomId: "a3108", date: "2026-11-20", start: 720, duration: 30 })).body.includes("пара с 11:10 до 12:30"));
  const other = await db.roomBooking.findFirstOrThrow({ where: { userId: { not: me }, status: "booked", startsAt: { gte: new Date("2026-11-20T00:00:00+03:00") } }, orderBy: { startsAt: "asc" } });
  const msk = new Date(other.startsAt.getTime() + 3 * 3600_000);
  const taken = await book(ctx, { roomId: other.roomId, date: msk.toISOString().slice(0, 10), start: msk.getUTCHours() * 60 + msk.getUTCMinutes(), duration: 30 });
  check("someone else's slot refused", taken.body.includes("Занято с"));
  check("own overlap refused", (await book(ctx, { roomId: await freeMeet("2026-11-23", 990, 60, ["lyra"]), date: "2026-11-23", start: 990, duration: 60 })).body.includes("уже бронь"));

  const freeSlot = async (date) => {
    for (let t = 600; t <= 1200; t += 30) {
      const id = await freeMeet(date, t, 30).catch(() => null);
      if (id) return { id, t };
    }
    throw new Error("no free slot");
  };
  const s24 = await freeSlot("2026-11-24");
  const long = await book(ctx, { roomId: s24.id, date: "2026-11-24", start: s24.t, duration: 30, title: "x".repeat(500) });
  const pol = await db.roomBooking.findFirst({ where: { userId: me, roomId: s24.id, startsAt: { gte: new Date("2026-11-24T00:00:00+03:00") } } });
  check("long title trimmed", long.body.includes('"ok":true') && pol?.title?.length === 60);
  const slot = await freeSlot("2026-11-25");
  const limit = await book(ctx, { roomId: slot.id, date: "2026-11-25", start: slot.t, duration: 30 });
  check(`no more than 3 active bookings`, limit.body.includes("Не больше 3"));

  const vega = await db.roomBooking.findFirstOrThrow({ where: { userId: me, roomId: "vega" } });
  check("check-in too early refused", (await forge(ctx, "rooms", "checkIn", [vega.id], "/rooms")).body.includes("Отметиться можно с 12:45"));
  const orlov = await db.roomBooking.findFirstOrThrow({ where: { user: { login: "m.orlov" }, status: "booked" } });
  const steal = await forge(ctx, "rooms", "cancelBooking", [orlov.id], "/rooms");
  const stealIn = await forge(ctx, "rooms", "checkIn", [orlov.id], "/rooms");
  check("foreign booking untouchable", steal.body.includes("Бронь не найдена") && stealIn.body.includes("Бронь не найдена") && (await db.roomBooking.findUniqueOrThrow({ where: { id: orlov.id } })).status === "booked");
  check("garbage id", (await forge(ctx, "rooms", "cancelBooking", [{ $ne: 1 }], "/rooms")).body.includes("Бронь не найдена"));

  await open(page, "/rooms");
  await page.click('[data-mine] [data-booking="vega"] button');
  await page.click("dialog[open] [data-cancel]");
  await page.waitForSelector("text=Бронь отменена");
  check("cancel own booking", (await db.roomBooking.findUniqueOrThrow({ where: { id: vega.id } })).status === "cancelled");

  // чужие брони видны только как «занято», без имён
  const html = await (await page.request.get(BASE + "/rooms")).text();
  const someone = await db.user.findUniqueOrThrow({ where: { id: other.userId } });
  check("no other people's names on the page", !html.includes(someone.lastName));

  // преподаватель: плитка на «Сегодня», страница и бронь
  const { ctx: tc, page: tp } = await login("e.petrova");
  check("teacher: «Аудитории» tile on Today", await tp.waitForSelector('a[href="/rooms"]', { timeout: 8000 }).then(() => true, () => false));
  await open(tp, "/rooms");
  check("teacher: rooms page", new URL(tp.url()).pathname === "/rooms" && (await tp.locator("[data-room]").count()) === 14);
  const ts = await freeSlot("2026-11-20");
  const tb = await book(tc, { roomId: ts.id, date: "2026-11-20", start: ts.t, duration: 30, title: "Консультация по курсовым" });
  check("teacher: can book", tb.body.includes('"ok":true') && (await db.roomBooking.count({ where: { user: { login: "e.petrova" } } })) === 1);

  // учебный офис — нет доступа
  const { ctx: oc, page: op } = await login("office");
  await op.goto(BASE + "/rooms");
  const away = await op.waitForURL((u) => u.pathname === "/", { timeout: 8000 }).then(() => true, () => false);
  check("office: redirected away", away, op.url());
  check("office: action refused", (await book(oc, { roomId: "vega", date: "2026-11-20", start: 600, duration: 60 })).body.includes("студентам и преподавателям"));

  // телефон 360 px: без горизонтальной прокрутки
  const { page: pp } = await login("m.orlov", { width: 360, height: 780 });
  await open(pp, "/rooms");
  await pp.waitForSelector("[data-room-list]");
  check("360px: no horizontal scroll", await pp.evaluate(() => document.documentElement.scrollWidth <= 360));
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
