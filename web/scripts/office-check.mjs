// Запуск: npm run build && PORT=3101 node scripts/office-check.mjs  (сам поднимает next start)
// «Офис»: заявки, документы, PDF, публичная проверка, защита серверных действий.
import { execSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
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
const actionId = (name) => Object.entries(manifest).find(([, v]) => v.exportedName === name && v.filename.includes("office"))?.[0];

const server = spawn("node", ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], { env: { ...process.env, COOKIE_SECURE: "false" }, stdio: "ignore" });
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(BASE + "/login")).ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 500));
}

const browser = await chromium.launch();
let ipN = 20;
async function login(name) {
  const ctx = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": `10.5.0.${ipN++}` } });
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
  const r = await ctx.request.post(BASE + "/office", {
    headers: { "Next-Action": actionId(name), "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component" },
    data: JSON.stringify(args),
    maxRedirects: 0,
  });
  return { status: r.status(), body: await r.text() };
}
const goodCert = { purpose: "Банк", lang: "Русский", format: "Электронная с QR", copies: 1 };

try {
  check("action ids found", !!actionId("createRequest") && !!actionId("withdrawRequest") && !!actionId("replyToRequest"));

  // публичные страницы без входа
  const anonIdx = await fetch(BASE + "/verify", { redirect: "manual" });
  check("/verify works without login", anonIdx.status === 200, String(anonIdx.status));
  const docA = await db.document.findUniqueOrThrow({ where: { number: "D-2470" } });
  const reqA = await db.officeRequest.findUniqueOrThrow({ where: { number: "R-2481" } });
  const vOk = await (await fetch(BASE + "/verify/" + docA.verifyToken)).text();
  check("/verify/<valid>: подлинный + masked name, no full name", vOk.includes("Документ подлинный") && vOk.includes("Воронцова А. С.") && !vOk.includes("Алиса") && !vOk.includes("Сергеевна"));
  const vBad = await (await fetch(BASE + "/verify/" + "x".repeat(43))).text();
  check("/verify/<random>: не найден", vBad.includes("Документ не найден") && !vBad.includes("Документ подлинный"));
  check("verifyToken is 43-char base64url", /^[A-Za-z0-9_-]{43}$/.test(docA.verifyToken));
  const anonPdf = await fetch(BASE + `/office/documents/${docA.id}/pdf`, { redirect: "manual" });
  check("anonymous PDF redirects to /login", [307, 308].includes(anonPdf.status));

  // ---- Алиса
  let { ctx, page } = await login("a.vorontsova");
  await page.goto(BASE + "/office");
  await page.waitForSelector("[data-request]");
  await page.waitForTimeout(500); // потоковая подмена Suspense-содержимого
  const t0 = await text(page);
  check("Alisa sees R-2481 and R-2477 cards", (await page.locator('[data-request="R-2481"]').count()) === 1 && (await page.locator('[data-request="R-2477"]').count()) === 1);
  check("Alisa does not see Maxim's request", (await page.locator('[data-request="R-2479"]').count()) === 0 && !t0.includes("военкомат · "));
  check("Alisa docs: 3 documents, Maxim's absent", (await page.locator("[data-doc]").count()) === 3 && (await page.locator('[data-doc="D-2441"]').count()) === 0);

  // создание через интерфейс
  await page.click('[data-type="study"]');
  await page.waitForSelector('button[role=radio]:has-text("Работодатель")');
  await page.click('button[role=radio]:has-text("Работодатель")');
  await page.click('button:has-text("Отправить")');
  await page.waitForSelector("text=Заявка отправлена");
  await page.click('button:has-text("Готово")');
  await page.waitForSelector("[data-request]:has-text('Справка об обучении')");
  const created = await db.officeRequest.findFirstOrThrow({ where: { user: { login: "a.vorontsova" }, typeId: "study" } });
  const card = await page.locator("[data-request]", { hasText: "Справка об обучении" }).textContent();
  check("created via UI: card in «В работе» with «Подана»", card.includes("Подана") && created.status === "sent");
  check("params stored validated", JSON.parse(created.params).purpose === "Работодатель");

  // каталог: популярные плитками, остальное — в окне «Ещё» по категориям; кнопки «Новая заявка» нет
  check("catalog: 7 popular tiles + «Ещё», no «Новая заявка»", (await page.locator("[data-type]").count()) === 7 && (await page.locator("[data-more]").count()) === 1 && !(await page.textContent("main")).includes("Новая заявка"));
  await page.click("[data-more]");
  await page.waitForSelector("dialog[open][aria-label='Все заявки']");
  const more = (await page.textContent("dialog[open]")) ?? "";
  check("«Ещё»: all types grouped by category", ["Справки", "Учёба", "Документы", "Стипендия и оплата", "Жизнь в университете"].every((c) => more.includes(c)) && more.includes("Повышенная стипендия") && more.includes("Дубликат студенческого"));
  await page.click('[data-more-type="high-stipend"]');
  await page.waitForSelector("dialog[open][aria-label='Повышенная стипендия']");
  await page.click('button[role=radio]:has-text("Наука")');
  await page.click('button:has-text("Отправить")');
  await page.waitForSelector("text=Заявка отправлена");
  await page.click('button:has-text("Готово")');
  const stip = await db.officeRequest.findFirst({ where: { user: { login: "a.vorontsova" }, typeId: "high-stipend" } });
  check("request from «Ещё» created and validated", !!stip && JSON.parse(stip.params).subject === "Наука");

  // подделки
  const before = await db.officeRequest.count();
  const f1 = await forge(ctx, "createRequest", ["hacker", goodCert]);
  const f2 = await forge(ctx, "createRequest", ["study", { ...goodCert, purpose: "Что угодно" }]);
  const f3 = await forge(ctx, "createRequest", ["study", { ...goodCert, format: "Бумажная", copies: 99 }]);
  const f4 = await forge(ctx, "createRequest", ["retake", { subject: "Микроэкономика", comment: "x".repeat(501) }]);
  check("forged unknown typeId rejected", f1.body.includes("Такой заявки нет"), f1.body.slice(0, 60));
  check("forged invalid option rejected", f2.body.includes("Некорректное"), f2.body.slice(0, 60));
  check("forged copies 99 rejected", f3.body.includes("Экземпляров от 1"), f3.body.slice(0, 60));
  check("forged long comment rejected", f4.body.includes("Комментарий не длиннее"));
  check("no rows created by forged requests", (await db.officeRequest.count()) === before);

  // чужая заявка
  const { ctx: mctx, page: mpage } = await login("m.orlov");
  const w = await forge(mctx, "withdrawRequest", [reqA.id]);
  const r = await forge(mctx, "replyToRequest", [reqA.id, "взлом"]);
  check("Maxim cannot withdraw Alisa's request", w.body.includes("Заявка не найдена") && (await db.officeRequest.findUniqueOrThrow({ where: { id: reqA.id } })).status === "work");
  check("Maxim cannot reply to Alisa's request", r.body.includes("Заявка не найдена") && (await db.requestMessage.count({ where: { requestId: reqA.id, body: "взлом" } })) === 0);
  const pdfM = await mctx.request.get(BASE + `/office/documents/${docA.id}/pdf`);
  check("Maxim gets 404 for Alisa's PDF", pdfM.status() === 404, String(pdfM.status()));
  const pdfNo = await mctx.request.get(BASE + `/office/documents/nonexistent/pdf`);
  check("nonexistent document PDF → 404", pdfNo.status() === 404);
  await mpage.goto(BASE + "/office");
  await mpage.waitForSelector("[data-request]");
  await mpage.waitForSelector("[data-doc]");
  await mpage.waitForTimeout(500); // потоковая подмена Suspense-содержимого
  const mc = [await mpage.locator('[data-request="R-2479"]').count(), await mpage.locator('[data-request="R-2481"]').count(), await mpage.locator("[data-doc]").count()];
  check("Maxim sees only his own", mc[0] === 1 && mc[1] === 0 && mc[2] === 2, mc.join(","));

  // ответ и отзыв через интерфейс
  await page.click('[data-request="R-2481"]');
  await page.click('button:has-text("Ответить")');
  await page.fill('textarea[aria-label="Сообщение"]', "Апостиль не нужен, спасибо");
  await page.click('button:has-text("Отправить")');
  await page.waitForSelector('dialog[open] button:has-text("Ответить")'); // поле закрылось — сообщение ушло
  await page.waitForSelector('dialog[open] span:has-text("Апостиль не нужен, спасибо")');
  const nReply = await db.requestMessage.count({ where: { requestId: reqA.id, authorRole: "student" } });
  check("reply stored and shown", nReply === 1, `count ${nReply}`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  await page.click(`[data-request="${created.number}"]`);
  await page.click('button:has-text("Отозвать заявку")');
  await page.click('button:has-text("Точно отозвать?")');
  await page.waitForFunction((n) => !document.querySelector(`[data-request="${n}"]`), created.number);
  check("withdraw: card gone, status withdrawn", (await db.officeRequest.findUniqueOrThrow({ where: { id: created.id } })).status === "withdrawn");
  const w2 = await forge(ctx, "withdrawRequest", [created.id]);
  check("second withdraw refused", w2.body.includes("Отозвать уже нельзя"));
  const long = await forge(ctx, "replyToRequest", [reqA.id, "я".repeat(1001)]);
  check("reply >1000 rejected", long.body.includes("Не длиннее 1000"));

  // PDF
  const pdf = await ctx.request.get(BASE + `/office/documents/${docA.id}/pdf`);
  const buf = await pdf.body();
  const h = pdf.headers();
  check("owner PDF: %PDF, > 5 KB", pdf.status() === 200 && buf.subarray(0, 4).toString() === "%PDF" && buf.length > 5000, `${buf.length} bytes`);
  check("PDF headers: attachment + no-store", /attachment/.test(h["content-disposition"] ?? "") && /no-store/.test(h["cache-control"] ?? "") && h["content-type"] === "application/pdf");

  // превью
  await page.click('[data-doc="D-2470"]');
  await page.waitForSelector('dialog[open] >> text=Подписано электронной подписью');
  check("doc preview: paper, QR svg, verify link", (await page.locator('dialog[open] svg[viewBox]').count()) > 1 && (await page.textContent('dialog[open]')).includes("Воронцовой Алисе Сергеевне"));
  await page.keyboard.press("Escape");

  // лимит: 10 в час
  await db.officeRequest.deleteMany({ where: { number: { notIn: ["R-2481", "R-2477", "R-2479", "R-2490"] } } });
  let rejectedAt = 0;
  let last;
  for (let i = 1; i <= 11; i++) {
    last = await forge(ctx, "createRequest", ["study", goodCert]);
    if (last.body.includes("Слишком много")) { rejectedAt = i; break; }
  }
  check("11th request within an hour rejected", rejectedAt === 11, `rejected at ${rejectedAt}`);
  await db.officeRequest.deleteMany({ where: { number: { notIn: ["R-2481", "R-2477", "R-2479", "R-2490"] } } });

  // Ника: пусто
  const { page: np } = await login("n.lanskaya");
  await db.user.update({ where: { login: "n.lanskaya" }, data: { onboardingDone: true } }); // онбординг — в onboarding-check; здесь — данные первокурсницы
  await np.goto(BASE + "/office");
  await np.waitForSelector("text=Документы первокурсника");
  check("Nika: only her freshman request, calm empty documents", (await text(np)).includes("Документов пока нет") && !(await text(np)).includes("R-2481"));
  // сотрудник
  const { page: tp } = await login("e.petrova");
  await tp.goto(BASE + "/office");
  await tp.waitForSelector("text=Кабинет сотрудника появится здесь");
  check("teacher sees placeholder", true);
  const tf = await forge((await tp.context()), "createRequest", ["study", goodCert]);
  check("teacher cannot create request", tf.body.includes("доступны студентам"));
} finally {
  await browser.close();
  server.kill();
  execSync("npm run db:seed", { stdio: "ignore" });
  await db.$disconnect();
}
const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
