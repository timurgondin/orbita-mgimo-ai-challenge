// Запуск: npm run build && PORT=3101 node scripts/mobility-check.mjs  (сам поднимает next start)
// «Семестр за рубежом»: объявление, требования по данным студента, заявка с файлами — проверка всего на сервере, заявка в «Офисе».
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
const dialog = (page) => page.locator("dialog[open]");

try {
  const { ctx, page } = await login("a.vorontsova");
  const n = await db.notification.findFirst({ where: { user: { login: "a.vorontsova" }, link: "/news/mobility-spring-2027" } });
  check("announcement notification links to its page", !!n && n.category === "announcement");
  await open(page, "/news/mobility-spring-2027");
  await page.waitForSelector("[data-cta]:visible");
  const t = await text(page);
  check("page: partners, requirements, documents, steps", (await page.locator("[data-partner-card]").count()) === 6 && t.includes("Требования") && t.includes("Мотивационное письмо") && t.includes("Собеседование"));
  check("requirements checked against Alisa's data", (await page.locator('[data-req][data-ok="yes"]').count()) === 5 && t.includes("топ-"));
  await open(page, "/news/other");
  check("unknown announcement: not found", (await page.locator("[data-cta]").count()) === 0);
  await open(page, "/news/mobility-spring-2027");

  // подделанные заявки: проверка на сервере
  const pdf = { name: "letter.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF\n") };
  const png = { name: "letter.pdf", mimeType: "application/pdf", buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]) };
  const bad = await forgeForm(ctx, "news", "applyMobility", { priority: "evil-u", lang: "Курс B2 в Орбите", letter: pdf, cv: pdf });
  check("forged unknown university rejected", bad.body.includes("Некорректный выбор университетов"));
  const noLang = await forgeForm(ctx, "news", "applyMobility", { priority: "hanri", lang: "Эсперанто", letter: pdf, cv: pdf });
  check("forged language rejected", noLang.body.includes("Укажите, чем подтвердите язык"));
  const noCv = await forgeForm(ctx, "news", "applyMobility", { priority: "hanri", lang: "Курс B2 в Орбите", letter: pdf });
  check("missing CV rejected", noCv.body.includes("резюме"));
  const notPdf = await forgeForm(ctx, "news", "applyMobility", { priority: "hanri", lang: "Курс B2 в Орбите", letter: png, cv: pdf });
  check("letter by signature must be PDF", notPdf.body.includes("нужен PDF"));
  check("nothing created by forged requests", (await db.officeRequest.count({ where: { typeId: "mobility" } })) === 0);
  const viaCatalog = await forge(ctx, "office", "createRequest", ["mobility", { subject: "x", comment: "" }], "/office");
  check("mobility can't be created from the office catalog", viaCatalog.body.includes("Такой заявки нет"));

  // настоящая заявка через форму
  await page.click("[data-apply-open]:visible");
  await page.waitForSelector("dialog[open] [data-apply-form]");
  await page.click('dialog[open] [data-partner="hanri"]');
  await page.click('dialog[open] [data-partner="hansa"]');
  await page.click("dialog[open] button:has-text('Курс B2 в Орбите')");
  await page.setInputFiles('dialog[open] input[name="letter"]', { name: "motivation.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF\n") });
  await page.setInputFiles('dialog[open] input[name="cv"]', { name: "cv.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF\n") });
  await page.click("dialog[open] [data-apply-send]");
  await page.waitForSelector("text=Заявка на конкурс подана");
  const req = await db.officeRequest.findFirst({ where: { typeId: "mobility", user: { login: "a.vorontsova" } }, include: { files: true, events: true } });
  const params = JSON.parse(req?.params ?? "{}");
  check("application stored: priorities in order, files labeled, 4 stages", !!req && params.priorities?.join() === "hanri,hansa" && req.files.map((f) => f.label).sort().join() === "Мотивационное письмо,Резюме" && req.events.length === 4);
  await page.waitForSelector("[data-cta]:visible >> text=Заявка подана");
  check("page shows own application", ((await page.textContent("[data-cta]:visible")) ?? "").includes(req.number));
  const again = await forgeForm(ctx, "news", "applyMobility", { priority: "hanri", lang: "Курс B2 в Орбите", letter: pdf, cv: pdf });
  check("second application rejected", again.body.includes("Заявка уже подана"));
  await open(page, `/office?request=${req.number}`);
  await page.waitForSelector("dialog[open]");
  const od = (await dialog(page).textContent()) ?? "";
  check("application is in «Офис» with its files", od.includes("Семестр за рубежом") && od.includes("Мотивационное письмо"));
  await open(page, "/office?new=mobility");
  await page.waitForTimeout(700);
  check("office: ?new=mobility opens nothing", (await page.locator("dialog[open]").count()) === 0);

  // первокурсница: курс не подходит, заявки Алисы не видно
  const { page: np } = await login("n.lanskaya");
  await db.user.update({ where: { login: "n.lanskaya" }, data: { onboardingDone: true } }); // онбординг — в onboarding-check; здесь — данные первокурсницы
  await open(np, "/news/mobility-spring-2027");
  check("first-year: course requirement not met", (await np.locator('[data-req="course"][data-ok="no"]').count()) === 1 && !(await text(np)).includes(req.number));
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
