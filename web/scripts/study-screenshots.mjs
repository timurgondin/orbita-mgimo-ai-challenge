// Запуск: npm run build && npx next start -p 3101 (COOKIE_SECURE=false), затем PORT=3101 node scripts/study-screenshots.mjs
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = `http://127.0.0.1:${process.env.PORT ?? 3100}`;
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../docs/screenshots");
const browser = await chromium.launch();
let n = 40;

async function session(login, viewport) {
  const ctx = await browser.newContext({ viewport, extraHTTPHeaders: { "x-forwarded-for": `10.2.0.${n++}` } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/login");
  await page.fill("#login", login);
  await page.fill("#pass", "orbita-demo");
  await page.click("button[type=submit]");
  await page.waitForURL(BASE + "/");
  return { ctx, page };
}
async function shot(page, url, name, fullPage = false) {
  await page.goto(BASE + url, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  if (overflow) console.warn(`! horizontal overflow (${name})`);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage });
}

let { ctx, page } = await session("a.vorontsova", { width: 1440, height: 900 });
await shot(page, "/study", "study-courses", true);
await shot(page, "/study?tab=tasks", "study-tasks", true);
await shot(page, "/study?tab=perf", "study-perf", true);
await shot(page, "/", "today-alisa");
await ctx.close();

({ ctx, page } = await session("m.orlov", { width: 1440, height: 900 }));
await shot(page, "/study", "study-courses-maxim", true);
await shot(page, "/", "today-maxim");
await ctx.close();

({ ctx, page } = await session("a.vorontsova", { width: 390, height: 844 }));
await shot(page, "/study", "study-mobile");
await shot(page, "/study?tab=tasks", "study-mobile-tasks");
await shot(page, "/study?tab=perf", "study-mobile-perf");
await ctx.close();
await browser.close();
