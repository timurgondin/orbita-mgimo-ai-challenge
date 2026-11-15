// Запуск: npm run build && PORT=3103 node scripts/office-screenshots.mjs  (сам поднимает next start)
import { execSync, spawn } from "node:child_process";
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const PORT = Number(process.env.PORT ?? 3103);
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = new URL("../../docs/screenshots/", import.meta.url).pathname;
execSync("npm run db:seed", { stdio: "ignore" });
const server = spawn("node", ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], { env: { ...process.env, COOKIE_SECURE: "false" }, stdio: "ignore" });
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(BASE + "/login")).ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 500));
}
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, extraHTTPHeaders: { "x-forwarded-for": "10.9.0.1" }, acceptDownloads: true });
  const page = await ctx.newPage();
  await page.goto(BASE + "/login");
  await page.fill("#login", "a.vorontsova");
  await page.fill("#pass", "orbita-demo");
  await page.click("button[type=submit]");
  await page.waitForURL(BASE + "/");
  await page.goto(BASE + "/office");
  await page.waitForSelector("[data-request]");
  await page.screenshot({ path: OUT + "office-main.png" });
  await page.click('[data-request="R-2481"]');
  await page.waitForTimeout(700);
  await page.screenshot({ path: OUT + "office-request.png" });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  await page.click('[data-type="visa"]');
  await page.waitForTimeout(700);
  await page.click('button[role=radio]:has-text("Бумажная")');
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + "office-form.png" });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  await page.click('[data-doc="D-2470"]');
  await page.waitForTimeout(800);
  await page.screenshot({ path: OUT + "office-doc.png" });
  // PDF
  const res = await ctx.request.get(BASE + (await page.getAttribute('a[href$="/pdf"]', "href")));
  const { writeFileSync } = await import("node:fs");
  writeFileSync(OUT + "sample-certificate.pdf", await res.body());
  // verify
  const token = (await new PrismaClient().document.findUniqueOrThrow({ where: { number: "D-2470" } })).verifyToken;
  const anon = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await anon.goto(BASE + "/verify/" + token);
  await anon.waitForSelector("text=Документ подлинный");
  await anon.screenshot({ path: OUT + "verify.png" });
  // mobile
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, extraHTTPHeaders: { "x-forwarded-for": "10.9.0.2" } });
  const mp = await m.newPage();
  await mp.goto(BASE + "/login");
  await mp.fill("#login", "a.vorontsova");
  await mp.fill("#pass", "orbita-demo");
  await mp.click("button[type=submit]");
  await mp.waitForURL(BASE + "/");
  await mp.goto(BASE + "/office");
  await mp.waitForSelector("[data-request]");
  await mp.screenshot({ path: OUT + "office-mobile.png", fullPage: true });
  await mp.click('[data-doc="D-2470"]');
  await mp.waitForTimeout(800);
  await mp.screenshot({ path: OUT + "office-mobile-doc.png" });
} finally {
  await browser.close();
  server.kill();
}
