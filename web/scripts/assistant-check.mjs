// Запуск: npm run build && PORT=3101 node scripts/assistant-check.mjs  (сам поднимает next start)
// ИИ-помощник: Ctrl K и сфера в доке, ответы по своим данным, заявка и запись через подтверждение, подделки.
import { execSync, spawn } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const PORT = Number(process.env.PORT ?? 3101);
const BASE = `http://127.0.0.1:${PORT}`;
const SHOTS = process.env.SHOTS; // папка для скриншотов, если нужна
const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
};

execSync("npm run db:seed", { stdio: "ignore" });
const db = new PrismaClient();
await db.loginAttempt.deleteMany();
await db.session.deleteMany();

const manifest = JSON.parse(readFileSync(new URL("../.next/server/server-reference-manifest.json", import.meta.url), "utf8")).node;
const actionId = (name) => Object.entries(manifest).find(([, v]) => v.exportedName === name && v.filename.includes("assistant"))?.[0];

const server = spawn("node", ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], { env: { ...process.env, COOKIE_SECURE: "false" }, stdio: "ignore" });
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(BASE + "/login")).ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 500));
}

const browser = await chromium.launch();
let ipN = 20;
async function login(name, viewport = { width: 1280, height: 860 }) {
  const ctx = await browser.newContext({ viewport, extraHTTPHeaders: { "x-forwarded-for": `10.7.0.${ipN++}` } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/login");
  await page.fill("#login", name);
  await page.fill("#pass", "orbita-demo");
  await page.click("button[type=submit]");
  await page.waitForURL((u) => u.pathname === "/" || u.pathname === "/welcome");
  await page.waitForLoadState("networkidle");
  return { ctx, page };
}
async function ask(ctx, text) {
  const r = await ctx.request.post(BASE + "/", {
    headers: { "Next-Action": actionId("askAssistant"), "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component" },
    data: JSON.stringify([text]),
    maxRedirects: 0,
  });
  return { status: r.status(), body: await r.text() };
}
const DLG = "dialog[open][aria-label='Орбита — помощник']";
const shot = async (page, name) => {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
};
/** Спросить в окне и дождаться окончания печати. */
async function askUi(page, text) {
  await page.fill("#assistant-input", text);
  await page.keyboard.press("Enter");
  await page.waitForSelector(`${DLG} [role=status]`);
  await page.waitForSelector(`${DLG} [role=status]`, { state: "detached" });
  await page.waitForTimeout(2600); // печать текста
  return (await page.textContent(`${DLG} [role=log]`)) ?? "";
}

try {
  check("action id found", !!actionId("askAssistant"));

  // ---- Алиса: окно, ответы, действия
  const { ctx, page } = await login("a.vorontsova");
  await page.keyboard.press("Control+k");
  await page.waitForSelector(DLG);
  check("Ctrl K opens assistant", true);
  await shot(page, "assistant-empty");
  await page.keyboard.press("Escape");
  await page.waitForSelector(DLG, { state: "detached" }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector("dialog[open]"));
  await page.click('button[aria-label^="Спросить Орбиту"]');
  await page.waitForSelector(DLG);
  check("dock orb opens assistant", true);

  // «думаю» — сфера с подписью
  await page.fill("#assistant-input", "Какая следующая пара?");
  await page.keyboard.press("Enter");
  await page.waitForSelector(`${DLG} [role=status] canvas`);
  check("thinking orb shown while answering", true);
  await shot(page, "assistant-thinking");
  await page.waitForSelector(`${DLG} [role=status]`, { state: "detached" });
  await page.waitForTimeout(2600);
  let log = (await page.textContent(`${DLG} [role=log]`)) ?? "";
  check("next lesson answered", log.includes("Следующая") || log.includes("Сейчас идёт") || log.includes("пар больше нет"), log.slice(0, 160));
  await shot(page, "assistant-lesson");

  log = await askUi(page, "Мой средний балл");
  const alisaAvg = log.match(/Средний балл за семестр — ([\d,]+)/)?.[1];
  check("grades answered", !!alisaAvg, alisaAvg);
  await shot(page, "assistant-grades");

  log = await askUi(page, "Что сдать на неделе?");
  check("tasks answered", /Ближайшие пять дней|сдавать нечего/.test(log));

  // справка: черновик → подтверждение → настоящая заявка
  const alisa = await db.user.findUniqueOrThrow({ where: { login: "a.vorontsova" } });
  const reqBefore = await db.officeRequest.count({ where: { userId: alisa.id } });
  log = await askUi(page, "Закажи справку в военкомат");
  check("request draft for army", log.includes("Справка в военкомат") && log.includes("Военкомат"));
  check("draft does not create request", (await db.officeRequest.count({ where: { userId: alisa.id } })) === reqBefore);
  await shot(page, "assistant-request");
  await page.click(`${DLG} button:has-text("Подтвердить")`);
  await page.waitForSelector(`${DLG} :text("Открыть в Офисе")`);
  const created = await db.officeRequest.findFirst({ where: { userId: alisa.id }, orderBy: { number: "desc" } });
  check("confirm creates request for Alisa", (await db.officeRequest.count({ where: { userId: alisa.id } })) === reqBefore + 1 && created?.typeId === "army");

  // консультация: выбор → запись
  log = await askUi(page, "Запиши на консультацию");
  const hasSlots = log.includes("Записаться");
  check("consultations offered", hasSlots || log.includes("Свободных мест"));
  if (hasSlots) {
    const goingBefore = await db.consultationSignup.count({ where: { userId: alisa.id } }).catch(() => null);
    await page.locator(`${DLG} button:has-text("Записаться")`).last().click();
    await page.waitForSelector(`${DLG} :text("Вы идёте")`);
    await shot(page, "assistant-consult");
    if (goingBefore !== null) check("sign-up stored", (await db.consultationSignup.count({ where: { userId: alisa.id } })) === goingBefore + 1);
    else check("sign-up shown", true);
  }

  // ---- подделки
  const alisaApi = await ask(ctx, "мой средний балл");
  const { ctx: mctx } = await login("m.orlov");
  const maximApi = await ask(mctx, "мой средний балл");
  const maxAvg = maximApi.body.match(/Средний балл за семестр — ([\d,]+)/)?.[1];
  check("each student gets own average", alisaApi.body.includes(`— ${alisaAvg} `) && !!maxAvg && maxAvg !== alisaAvg, `${alisaAvg} / ${maxAvg}`);

  const anon = await (await browser.newContext()).request.post(BASE + "/", {
    headers: { "Next-Action": actionId("askAssistant"), "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component" },
    data: JSON.stringify(["мой средний балл"]),
    maxRedirects: 0,
  });
  const anonBody = await anon.text();
  check("anonymous gets no data", !/Средний балл за семестр/.test(anonBody), String(anon.status()));

  const weird = await ask(ctx, { text: "балл" });
  check("non-string input → fallback", weird.status === 200 && weird.body.includes("Пока не знаю"));
  const long = await ask(ctx, "а".repeat(20000));
  check("long input handled", long.status === 200 || long.status === 413);

  const { ctx: tctx } = await login("e.petrova");
  const teacher = await ask(tctx, "мой средний балл");
  check("teacher gets no student data", teacher.body.includes("Пока помогаю только студентам"));
  const tReq = await ask(tctx, "закажи справку");
  check("teacher gets no request draft", !tReq.body.includes("\"kind\":\"request\""));

  // ---- мобильный
  const { page: mp } = await login("m.orlov", { width: 360, height: 760 });
  await mp.click('button[aria-label^="Спросить Орбиту"]');
  await mp.waitForSelector(DLG);
  await askUi(mp, "Запиши на консультацию");
  const overflow = await mp.evaluate((sel) => {
    const d = document.querySelector(sel);
    return d.scrollWidth > d.clientWidth + 1 || d.getBoundingClientRect().width > innerWidth;
  }, DLG);
  check("360px: no horizontal overflow", !overflow);
  await shot(mp, "assistant-mobile");
} finally {
  await browser.close();
  server.kill();
  execSync("npm run db:seed", { stdio: "ignore" });
  await db.$disconnect();
}
const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
