// Запуск: npm run build && PORT=3101 node scripts/profile-check.mjs  (сам поднимает next start)
// «Профиль»: данные только свои, правка контактов, студенческий с QR, публичная проверка билета, подделки.
import { execSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const PORT = Number(process.env.PORT ?? 3101);
const BASE = `http://127.0.0.1:${PORT}`;
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
const actionId = (name) => Object.entries(manifest).find(([, v]) => v.exportedName === name && (v.filename.includes("profile") || v.filename.includes("today")))?.[0];

const server = spawn("node", ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], { env: { ...process.env, COOKIE_SECURE: "false" }, stdio: "ignore" });
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(BASE + "/login")).ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 500));
}

const browser = await chromium.launch();
let ipN = 20;
async function login(name) {
  const ctx = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": `10.6.0.${ipN++}` } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/login");
  await page.fill("#login", name);
  await page.fill("#pass", "orbita-demo");
  await page.click("button[type=submit]");
  await page.waitForURL((u) => u.pathname === "/" || u.pathname === "/welcome");
  return { ctx, page };
}
const text = async (page) => (await page.textContent("main")) ?? "";
async function forge(ctx, name, args) {
  const r = await ctx.request.post(BASE + "/profile", {
    headers: { "Next-Action": actionId(name), "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component" },
    data: JSON.stringify(args),
    maxRedirects: 0,
  });
  return { status: r.status(), body: await r.text() };
}
const user = (login) => db.user.findUniqueOrThrow({ where: { login } });

try {
  check("action id found", !!actionId("updateContact"));

  // без входа
  const anon = await fetch(BASE + "/profile", { redirect: "manual" });
  check("anonymous /profile redirects to /login", [307, 308].includes(anon.status) && anon.headers.get("location")?.includes("/login"));

  // ---- Алиса: свой профиль
  const alisa = await user("a.vorontsova");
  const maxim = await user("m.orlov");
  const { ctx, page } = await login("a.vorontsova");
  await page.click('button[aria-label="Профиль и настройки"]');
  await page.click('#profile-menu a:has-text("Профиль")');
  await page.waitForURL(BASE + "/profile");
  await page.waitForSelector("text=Зачётная книжка");
  const t = await text(page);
  check("profile menu → /profile", true);
  check("Alisa sees own data", t.includes("Алиса Воронцова") && t.includes("25-МБ-0412") && t.includes("a.vorontsova@orbita.edu") && t.includes("@alisa_vrn"));
  check("no Maxim data on Alisa's profile", !t.includes("23-МП-0178") && !t.includes("@orlov_m") && !t.includes("Орлов"));
  check("no settings on profile", !t.includes("Тема") && !t.includes("Пароль") && !t.includes("Новые оценки"));
  check("card token not in profile HTML", !(await page.content()).includes(maxim.cardToken));

  // студенческий: окно с QR
  await page.click("main [data-open-card]");
  await page.waitForSelector("dialog[open][aria-label='Студенческий билет'] svg");
  const modal = (await page.textContent("dialog[open][aria-label='Студенческий билет']")) ?? "";
  check("card modal: QR + name + number + validity", modal.includes("Алиса Воронцова") && modal.includes("250412") && modal.includes("31.08.2029"));
  // QR сам меняется каждые 10 с, пока окно открыто
  const qrSel = "dialog[open] [data-orbita-qr]";
  await page.waitForFunction((s) => Number(document.querySelector(s)?.dataset.qrRev) >= 1, qrSel);
  const rev1 = Number(await page.getAttribute(qrSel, "data-qr-rev"));
  const svg1 = await page.innerHTML(qrSel + " .qr-in");
  await page.waitForFunction(([s, r]) => Number(document.querySelector(s)?.dataset.qrRev) > r, [qrSel, rev1], { timeout: 15000 });
  check("Orbita ID QR rotates (new code within 10 s)", (await page.innerHTML(qrSel + " .qr-in")) !== svg1);
  await page.keyboard.press("Escape");

  // правка контакта через интерфейс
  await page.click('button[aria-label="Изменить: Telegram"]');
  await page.fill('[data-contact="telegram"] input', "alisa_new");
  await page.keyboard.press("Enter");
  await page.waitForSelector('[data-contact="telegram"] >> text=@alisa_new');
  check("UI edit saved, normalized with @", (await user("a.vorontsova")).telegram === "@alisa_new");
  await page.click('button[aria-label="Изменить: Телефон"]');
  await page.fill('[data-contact="phone"] input', "8 (900) 111 22 33");
  await page.keyboard.press("Enter");
  await page.waitForSelector('[data-contact="phone"] >> text=+7 900 111-22-33');
  check("phone normalized to +7 900 111-22-33", (await user("a.vorontsova")).phone === "+7 900 111-22-33");

  // подделки
  const f1 = await forge(ctx, "updateContact", ["login", "hacker"]);
  const f2 = await forge(ctx, "updateContact", ["cardToken", "x"]);
  const f3 = await forge(ctx, "updateContact", ["telegram", "<script>alert(1)</script>"]);
  const f4 = await forge(ctx, "updateContact", ["phone", "1".repeat(200)]);
  const f5 = await forge(ctx, "updateContact", ["phone", 79001112233]);
  const f6 = await forge(ctx, "updateContact", ["telegram", "ab"]);
  const a2 = await user("a.vorontsova");
  check("forged field 'login' rejected", f1.body.includes("Неверный запрос") && a2.login === "a.vorontsova");
  check("forged field 'cardToken' rejected", f2.body.includes("Неверный запрос") && a2.cardToken === alisa.cardToken);
  check("script in telegram rejected", f3.body.includes("Имя в Telegram") && a2.telegram === "@alisa_new");
  check("200-char phone rejected", f4.body.includes("Проверьте номер") && a2.phone === "+7 900 111-22-33");
  check("non-string value rejected", f5.body.includes("Неверный запрос"));
  check("too short telegram rejected", f6.body.includes("Имя в Telegram"));
  const f7 = await forge(ctx, "updateContact", ["phone", ""]);
  check("empty value clears the contact", f7.body.includes('"ok":true') && (await user("a.vorontsova")).phone === null);
  check("Maxim untouched by Alisa's edits", JSON.stringify(await user("m.orlov")) === JSON.stringify(maxim));

  // «Сегодня»: плитка «Орбита ID» открывает то же окно
  await page.goto(BASE + "/");
  await page.waitForLoadState("networkidle");
  await page.click("nav[aria-label='Быстрый доступ'] > [data-tile='card']");
  await page.waitForSelector("dialog[open][aria-label='Студенческий билет'] svg");
  check("Today tile opens student card", ((await page.textContent("dialog[open][aria-label='Студенческий билет']")) ?? "").includes("250412"));

  // порядок плиток: только перестановка всех сервисов из белого списка
  const tShort = await forge(ctx, "setTileOrder", [["grades", "card", "teachers", "library", "print"]]);
  const tBad = await forge(ctx, "setTileOrder", [["grades", "card", "teachers", "library", "print", "courses", "rating", "documents", "../admin"]]);
  const tDup = await forge(ctx, "setTileOrder", [["grades", "grades", "teachers", "library", "print", "courses", "rating", "documents", "clubs"]]);
  const tEmpty = await forge(ctx, "setTileOrder", [[]]);
  check(
    "forged tile order rejected (partial, unknown, duplicate, empty)",
    [tShort, tBad, tDup, tEmpty].every((r) => r.body.includes("Некорректный порядок")) && (await db.user.findUniqueOrThrow({ where: { login: "a.vorontsova" } })).tiles === null,
  );

  // публичная проверка билета
  // код в QR: окно 10 с, подпись HMAC от ключа, выведенного из перца (src/server/profile/card-code.ts)
  const pepper = readFileSync(new URL("../.env", import.meta.url), "utf8").match(/^AUTH_PEPPER=["']?([^"'\n]+)/m)?.[1];
  const qrKey = createHmac("sha256", Buffer.from(pepper, "base64")).update("orbita-card-qr/v1").digest();
  const code = (tok, w) => `${w.toString(36)}.${createHmac("sha256", qrKey).update(`${tok}.${w}`).digest().subarray(0, 12).toString("base64url")}`;
  const nowW = () => Math.floor(Date.now() / 10_000);
  const v = await (await fetch(BASE + "/verify/" + alisa.cardToken + "?c=" + code(alisa.cardToken, nowW()))).text();
  const vStatic = await (await fetch(BASE + "/verify/" + alisa.cardToken)).text();
  const vOld = await (await fetch(BASE + "/verify/" + alisa.cardToken + "?c=" + code(alisa.cardToken, nowW() - 4))).text();
  const vFuture = await (await fetch(BASE + "/verify/" + alisa.cardToken + "?c=" + code(alisa.cardToken, nowW() + 3))).text();
  const vForged = await (await fetch(BASE + "/verify/" + alisa.cardToken + "?c=" + nowW().toString(36) + "." + "A".repeat(16))).text();
  const vSwap = await (await fetch(BASE + "/verify/" + alisa.cardToken + "?c=" + code(maxim.cardToken, nowW()))).text();
  check(
    "/verify card: без кода, старый (40 с), из будущего, поддельный, чужой — «устарел», без данных",
    [vStatic, vOld, vFuture, vForged, vSwap].every((x) => x.includes("QR-код устарел") && !x.includes("Воронцова") && !x.includes("250412")),
  );
  check("/verify/<card token>: действителен, masked name only", v.includes("Студенческий действителен") && v.includes("Воронцова А. С.") && !v.includes("Алиса") && !v.includes("Сергеевна") && !v.includes("25-МБ-0412"));
  check("cardToken is 43-char base64url", /^[A-Za-z0-9_-]{43}$/.test(alisa.cardToken));
  const vBad = await (await fetch(BASE + "/verify/" + "y".repeat(43))).text();
  check("/verify/<random>: не найден", vBad.includes("Документ не найден"));

  // преподаватель: без учёбы и студенческого
  const { page: tp } = await login("e.petrova");
  await tp.goto(BASE + "/profile");
  await tp.waitForSelector("text=Контакты");
  const tt = await text(tp);
  const tq = await forge(tp.context(), "refreshCardQr", []);
  check("teacher: refreshCardQr → no QR", tq.status === 200 && !tq.body.includes("<svg"));
  check("teacher: «Работа», no student card", tt.includes("Работа") && tt.includes("Кафедра экономики") && (await tp.locator("[data-open-card]").count()) === 0);
} finally {
  await browser.close();
  server.kill();
  execSync("npm run db:seed", { stdio: "ignore" });
  await db.$disconnect();
}
const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
