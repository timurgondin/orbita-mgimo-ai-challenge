// Запуск: npm run build && COOKIE_SECURE=false npx next start -p 3101, затем PORT=3101 node scripts/time-screenshots.mjs
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = `http://127.0.0.1:${process.env.PORT ?? 3101}`;
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../docs/screenshots");
const browser = await chromium.launch();

async function session(viewport, ip) {
  const ctx = await browser.newContext({ viewport, extraHTTPHeaders: { "x-forwarded-for": ip } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/login");
  await page.fill("#login", "a.vorontsova");
  await page.fill("#pass", "orbita-demo");
  await page.click("button[type=submit]");
  await page.waitForURL(BASE + "/");
  return { ctx, page };
}
const settle = async (page) => { await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(700); };
const open = async (page, url) => { await page.goto(BASE + url, { waitUntil: "networkidle" }); await settle(page); };
const shot = (page, name, full = false) => page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });

let { ctx, page } = await session({ width: 1440, height: 900 }, "10.3.0.1");
await open(page, "/time");
await shot(page, "time-list", true);
await page.click('[data-pair="5"]');
await page.waitForTimeout(700);
await shot(page, "time-lesson-modal");
await page.keyboard.press("Escape");
await open(page, "/time?view=week");
await shot(page, "time-week", true);
await page.click('button[aria-label="Синхронизация календаря"]');
await page.waitForTimeout(700);
await shot(page, "time-sync");
await open(page, "/time?tab=cons");
await shot(page, "time-cons", true);
await page.click('[data-id]:nth-of-type(1)');
await page.waitForTimeout(700);
await shot(page, "time-cons-modal");
await ctx.close();

({ ctx, page } = await session({ width: 390, height: 844 }, "10.3.0.2"));
await open(page, "/time");
if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) console.warn("! overflow list");
await shot(page, "time-mobile");
await open(page, "/time?view=week");
if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) console.warn("! overflow week");
await shot(page, "time-mobile-week");
await open(page, "/time?tab=cons");
if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) console.warn("! overflow cons");
await shot(page, "time-mobile-cons");
await ctx.close();
await browser.close();
