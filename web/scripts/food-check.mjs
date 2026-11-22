// Запуск: npm run build && PORT=3101 node scripts/food-check.mjs  (сам поднимает next start; SHOTS=1 — скриншоты в docs/screenshots)
// «Еда»: заведения кампуса, часы и загруженность от перемен, меню с ценами, связь с Random Coffee, помощник, плитка.
import { execSync, spawn } from "node:child_process";
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const PORT = Number(process.env.PORT ?? 3101);
const BASE = `http://127.0.0.1:${PORT}`;
const SHOTS = process.env.SHOTS === "1";
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

const browser = await chromium.launch();
let ipN = 60;
async function login(name, viewport = { width: 1280, height: 900 }) {
  const ctx = await browser.newContext({ viewport, colorScheme: "dark", extraHTTPHeaders: { "x-forwarded-for": `10.9.1.${ipN++}` } });
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
const shot = async (page, name, opts = {}) => SHOTS && page.screenshot({ path: `../docs/screenshots/${name}.png`, ...opts });

try {
  // без входа — на /login
  const anon = await browser.newContext();
  const r = await anon.request.get(BASE + "/food", { maxRedirects: 0 });
  check("без входа /food не отдаётся", r.status() >= 300 && r.status() < 400, `status ${r.status()}`);
  await anon.close();

  const { ctx, page } = await login("a.vorontsova");
  await open(page, "/food");
  const venues = await page.locator("[data-venue]").count();
  check("пять заведений", venues === 5, String(venues));
  check("в 11:49 всё открыто", (await page.locator("[data-venue] [data-open]").count()) === 5);
  const canteen = page.locator('[data-venue="peremena"]');
  check("на карточке столовой обед дня с ценой", /Обед дня[\s\S]*Комплексный обед[\s\S]*320/.test(await canteen.innerText()));
  check("в столовой во время пары свободно", (await canteen.locator("[data-crowd]").getAttribute("data-crowd")) === "low");
  await shot(page, "food-list", { fullPage: true });

  await canteen.click();
  const dlg = page.locator("dialog[open]");
  await dlg.waitFor();
  check("окно заведения открыто и адрес с ?place=", new URL(page.url()).searchParams.get("place") === "peremena");
  check("наплыв на большой перемене", (await dlg.locator("[data-rush]").innerText()).includes("12:30"));
  const bars = await dlg.locator("[data-load] > span").count();
  check("загруженность по получасам с 8:30 до 18:00", bars === 19, String(bars));
  check("сейчас — один столбец", (await dlg.locator("[data-load] [data-now]").count()) === 1);
  const dishes = await dlg.locator("[data-dish]").count();
  check("меню с ценами", dishes >= 15 && /\d+\s₽/.test(await dlg.innerText()), String(dishes));
  check("КБЖУ скрыт по умолчанию", (await dlg.locator("[data-kbju]").count()) === 0);
  await dlg.locator("[data-kbju-toggle]").click();
  check("КБЖУ у каждого блюда", (await dlg.locator("[data-kbju]").count()) === dishes && /ккал/.test(await dlg.locator("[data-kbju]").first().innerText()));
  await dlg.locator("[data-kbju-toggle]").click();
  await page.waitForTimeout(400);
  await shot(page, "food-venue");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  check("закрытие возвращает /food", new URL(page.url()).search === "");

  // прямая ссылка и неверный параметр
  // КБЖУ во всех заведениях: включён один раз — остаётся при переходе к другому
  await page.locator('[data-venue="peremena"]').click();
  await page.locator("dialog[open] [data-kbju-toggle]").click();
  let kOk = true;
  for (const slug of ["zerno", "atrium", "terrace", "fresh", "peremena"]) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    await page.locator(`[data-venue="${slug}"]`).click();
    const d = page.locator("dialog[open]");
    await d.waitFor();
    const n = await d.locator("[data-dish]").count();
    const k = await d.locator("[data-kbju]").count();
    if (!n || n !== k) kOk = false;
  }
  check("КБЖУ у всех блюд всех заведений, переключатель запоминается", kOk);
  await page.waitForTimeout(300);
  await shot(page, "food-kbju");
  await open(page, "/food?place=zerno");
  const direct = await page.locator("dialog[open]").innerText().catch((e) => "ERR " + e.message.slice(0, 80));
  check("прямая ссылка открывает кофейню", direct.includes("«Зерно»"), direct.slice(0, 60));
  await open(page, "/food?place=../../etc");
  check("неизвестное заведение — просто список", (await page.locator("dialog[open]").count()) === 0 && (await page.locator("[data-venue]").count()) === 5);

  // Random Coffee: место встречи ведёт в «Еду», кафе отмечено
  const match = await db.coffeeMember.findFirst({ where: { user: { login: "a.vorontsova" }, match: { week: "2026-11-16", status: "active", online: false } }, include: { match: true } });
  if (match) {
    await open(page, "/coffee");
    const link = page.locator("[data-coffee-place]");
    await link.waitFor({ timeout: 5000 }).catch(() => {});
    const href = (await link.count()) ? await link.getAttribute("href") : null;
    check("место встречи в Random Coffee — ссылка на кафе", !!href && href.startsWith("/food?place="), href ?? "нет ссылки");
    if (href) {
      await link.click();
      await page.waitForURL((u) => u.pathname === "/food");
      await page.locator("dialog[open]").waitFor();
      check("в окне кафе — встреча Random Coffee", (await page.locator("dialog[open] [data-coffee-link]").count()) === 1);
      check("на карточке кафе — отметка встречи", (await page.locator("[data-venue] [data-coffee-mark]").count()) === 1);
    }
  } else check("у a.vorontsova есть встреча Random Coffee в кафе", false);

  // плитка «Еда» в «Ещё»
  await open(page, "/");
  check("плитка «Еда» есть на «Сегодня»", (await page.locator('a[href="/food"]').count()) >= 1);

  // помощник
  const ask = async (q) => {
    await page.keyboard.press("Control+k");
    const input = page.locator("dialog[open] textarea, dialog[open] input[type=text]").first();
    await input.fill(q);
    await input.press("Enter");
    await page.locator("dialog[open] [data-assistant-food]").last().waitFor({ timeout: 8000 }).catch(() => {});
    const n = await page.locator("dialog[open] [data-assistant-food]").count();
    const text = await page.locator("dialog[open]").innerText();
    await page.keyboard.press("Escape");
    return { n, text };
  };
  const a1 = await ask("Где поесть?");
  check("помощник: «где поесть» — карточка заведений", a1.n >= 1 && a1.text.includes("Свободнее всего"));
  await open(page, "/");
  const a2 = await ask("что сегодня в столовой");
  check("помощник: обед дня в столовой", a2.n >= 1 && a2.text.includes("Обед дня") && a2.text.includes("320"));
  await ctx.close();

  // преподаватель тоже видит
  const t = await login("e.petrova");
  await open(t.page, "/food");
  check("преподаватель видит заведения", (await t.page.locator("[data-venue]").count()) === 5);
  check("у преподавателя нет отметок Random Coffee", (await t.page.locator("[data-coffee-mark]").count()) === 0);
  await t.ctx.close();

  // телефон 360 px
  const m = await login("m.orlov", { width: 360, height: 780 });
  await open(m.page, "/food");
  const sw = await m.page.evaluate(() => document.documentElement.scrollWidth);
  check("360 px без горизонтальной прокрутки", sw <= 360, String(sw));
  await shot(m.page, "food-mobile");
  await m.page.locator('[data-venue="atrium"]').click();
  await m.page.locator("dialog[open]").waitFor();
  await m.page.waitForTimeout(500);
  const dw = await m.page.evaluate(() => document.querySelector("dialog[open]").scrollWidth <= document.querySelector("dialog[open]").clientWidth);
  check("окно на телефоне без горизонтальной прокрутки", dw);
  await shot(m.page, "food-venue-mobile");
  await m.ctx.close();
} catch (e) {
  check("без исключений", false, e.message);
} finally {
  await browser.close();
  server.kill();
  await db.$disconnect();
  execSync("npm run db:seed", { stdio: "ignore" });
}

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
