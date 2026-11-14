// Запуск: сначала `npm run build && npx next start -p 3100`, затем `node scripts/screenshots.mjs`
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../docs/screenshots");
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

async function shot(name, { width, height, theme = "dark", scrollY = 0 }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  await context.addInitScript((t) => localStorage.setItem("theme", t), theme);
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  if (scrollY) {
    await page.evaluate((y) => window.scrollTo(0, y), scrollY);
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(600);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  if (overflow) console.warn(`! horizontal overflow at ${width}px (${name})`);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  await context.close();
}

await shot("today-desktop-dark", { width: 1440, height: 900 });
await shot("today-desktop-light", { width: 1440, height: 900, theme: "light" });
await shot("today-desktop-scrolled", { width: 1440, height: 900, scrollY: 400 });
await shot("today-mobile-dark", { width: 390, height: 844 });
await browser.close();
