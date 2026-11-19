// Запуск: npm run build && PORT=3101 node scripts/print-check.mjs  (сам поднимает next start)
// «Печать»: очередь по Орбита ID, подсчёт страниц на сервере, квота, принтеры, сканы только владельцу.
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
/** Подделанный вызов с FormData: первый аргумент — форма (React кодирует её полями с префиксом «_1_»). */
async function forgeForm(ctx, file, name, fields, path = "/") {
  // поля формы идут первыми, корень «0» — последним: так их читает сервер
  const multipart = new FormData();
  for (const [k, v] of Object.entries(fields)) multipart.append(`_1_${k}`, typeof v === "string" ? v : new File([v.buffer], v.name, { type: v.mimeType }));
  multipart.append("0", '["$K1"]');
  const r = await ctx.request.post(BASE + path, { headers: { "Next-Action": actionId(name, file), Accept: "text/x-component" }, multipart, maxRedirects: 0 });
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
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  for (let i = 0; i < 3; i++) doc.addPage();
  const threePages = Buffer.from(await doc.save());

  const { ctx, page } = await login("a.vorontsova");
  const me = await uid("a.vorontsova");
  await open(page, "/print");
  await page.waitForSelector("[data-send]");
  check("print: held job, quota, printers", (await page.locator("[data-held]").count()) === 1 && (await page.locator("[data-printer]").count()) === 8 && (await text(page)).includes("из 200 осталось"));
  check("printer near the next lesson first", ((await page.locator("[data-printer]").first().textContent()) ?? "").includes("Рядом со следующей парой"));

  await page.setInputFiles("[data-send-input]", { name: "slides.pdf", mimeType: "application/pdf", buffer: threePages });
  await page.click("[data-send-go]");
  await page.waitForSelector("text=В очереди: 3 страницы");
  const job = await db.printJob.findFirstOrThrow({ where: { userId: me, fileName: "slides.pdf" } });
  check("pages counted on the server", job.pages === 3 && job.status === "held" && job.duplex);

  await page.setInputFiles("[data-send-input]", { name: "fake.pdf", mimeType: "application/pdf", buffer: Buffer.from("MZ not a pdf") });
  await page.click("[data-send-go]");
  await page.waitForSelector("text=Нужен PDF, JPG или PNG");
  check("not a PDF by signature rejected", (await db.printJob.count({ where: { userId: me, fileName: "fake.pdf" } })) === 0);

  const pdfFile = { name: "a.pdf", mimeType: "application/pdf", buffer: threePages };
  const many = await forgeForm(ctx, "print", "sendToPrint", { file: pdfFile, copies: "11", color: "0", duplex: "1" }, "/print");
  check("forged 11 copies rejected", many.body.includes("Копий от 1 до 10"));
  const quota = await forgeForm(ctx, "print", "sendToPrint", { file: pdfFile, copies: "10", color: "1", duplex: "0" }, "/print");
  check("color quota enforced", quota.body.includes("Не хватает квоты"));

  const maxJob = await db.printJob.findFirstOrThrow({ where: { user: { login: "m.orlov" }, status: "held" } });
  const foreign = await forge(ctx, "print", "cancelPrint", [maxJob.id], "/print");
  check("foreign job can't be cancelled", foreign.body.includes("Файл не найден") && (await db.printJob.findUniqueOrThrow({ where: { id: maxJob.id } })).status === "held");
  const off = await forge(ctx, "print", "releasePrint", ["p-e1"], "/print");
  check("offline printer refuses", off.body.includes("Принтер не работает"));
  const fake = await forge(ctx, "print", "releasePrint", ["p-zzz"], "/print");
  check("unknown printer refuses", fake.body.includes("Принтер не найден"));

  await open(page, "/print");
  await page.click('[data-printer="p-c1"]');
  await page.click("dialog[open] [data-release]");
  await page.waitForSelector("text=Печатается на принтере");
  check("release prints own queue only", (await db.printJob.count({ where: { userId: me, status: "held" } })) === 0 && (await db.printJob.findUniqueOrThrow({ where: { id: maxJob.id } })).status === "held");

  const noScan = await forge(ctx, "print", "scanToOrbita", ["p-c4"], "/print");
  check("printer without scanner refuses", noScan.body.includes("нет сканера"));
  await open(page, "/print");
  await page.click('[data-printer="p-c1"]');
  await page.click("dialog[open] [data-scan-here]");
  await page.waitForSelector("text=Скан пришёл в Орбиту");
  const scan = await db.scan.findFirstOrThrow({ where: { userId: me }, orderBy: { createdAt: "desc" } });
  const own = await page.request.get(BASE + `/print/scans/${scan.id}`);
  check("own scan: PDF", own.status() === 200 && (await own.body()).subarray(0, 5).toString() === "%PDF-");
  const { page: mp } = await login("m.orlov");
  const steal = await mp.request.get(BASE + `/print/scans/${scan.id}`);
  check("foreign scan: 404", steal.status() === 404);
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
