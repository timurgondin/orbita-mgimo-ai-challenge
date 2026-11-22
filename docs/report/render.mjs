// report.html → Орбита — процесс создания.pdf (+ PNG первых страниц для просмотра: node render.mjs --preview)
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "../../web/package.json"));
const { chromium } = require("playwright");

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("file://" + path.join(here, "report.html"), { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
const out = path.join(here, "orbita-process.pdf");
await page.pdf({ path: out, format: "A4", printBackground: true, preferCSSPageSize: true });
console.log("pdf", out);
await browser.close();
