// Запуск: npm run build && PORT=3101 node scripts/notifications-check.mjs  (сам поднимает next start)
// Центр уведомлений: колокольчик, шторка, «Новое», полоса срочного, «прочитано ≠ решено», подделки.
import { execSync, spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
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
const actionId = (name, file = "notifications") => Object.entries(manifest).find(([, v]) => v.exportedName === name && v.filename.includes(file))?.[0];

const server = spawn("node", ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], { env: { ...process.env, COOKIE_SECURE: "false" }, stdio: "ignore" });
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(BASE + "/login")).ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 500));
}

const browser = await chromium.launch();
let ipN = 20;
async function login(name) {
  const ctx = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": `10.7.0.${ipN++}` } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/login");
  await page.fill("#login", name);
  await page.fill("#pass", "orbita-demo");
  await page.click("button[type=submit]");
  await page.waitForURL((u) => u.pathname === "/" || u.pathname === "/welcome");
  await page.waitForTimeout(600);
  return { ctx, page };
}
async function forge(ctx, name, args) {
  const r = await ctx.request.post(BASE + "/", {
    headers: { "Next-Action": actionId(name), "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component" },
    data: JSON.stringify(args),
    maxRedirects: 0,
  });
  return { status: r.status(), body: await r.text() };
}
const notes = (login) => db.notification.findMany({ where: { user: { login } }, orderBy: { createdAt: "asc" } });
const bell = (page) => page.getAttribute("[data-bell]", "data-bell");

try {
  check("action ids found", !!actionId("markSeen") && !!actionId("resolveNotification") && !!actionId("uploadRequestFile", "office"));

  const maximBefore = await notes("m.orlov");
  const { ctx, page } = await login("a.vorontsova");

  // колокольчик и «Сегодня»
  check("bell shows 2 pending actions", (await bell(page)) === "2", await bell(page));
  check("urgent strip: book due tomorrow", (await page.locator("[data-urgent]").count()) === 1 && ((await page.textContent("[data-urgent]")) ?? "").includes("Экономикс"));
  const news = (await page.textContent("section[aria-label='Новое']")) ?? "";
  check("«Новое»: action first, urgent not duplicated", news.includes("загранпаспорта") && !news.includes("Экономикс") && news.indexOf("загранпаспорта") < news.indexOf("8 из 10"));

  // «Все» открывает шторку → всё прочитано, но действия висят
  await page.click("[data-open-center]");
  await page.waitForSelector("dialog[open][aria-label='Уведомления']");
  await page.waitForTimeout(800);
  const drawer = (await page.textContent("dialog[open][aria-label='Уведомления']")) ?? "";
  check("center: «Нужно действие», «Новые» (unread at open) and «Ранее»", drawer.includes("Нужно действие") && drawer.includes("Новые") && drawer.includes("Ранее"));
  check("center shows types: Оценка, Расписание, Безопасность", drawer.includes("Оценка") && drawer.includes("Расписание") && drawer.includes("Безопасность"));
  check("unread rows marked, read rows not", (await page.locator("dialog[open] [data-unread]").count()) === 5 && (await page.locator("dialog[open] [data-note]:not([data-unread])").count()) >= 3);
  const afterSeen = await notes("a.vorontsova");
  check("opening marks all as read", afterSeen.every((n) => n.readAt));
  check("read ≠ resolved: actions still pending", afterSeen.filter((n) => n.level === "action" && !n.resolvedAt).length === 2);
  check("Maxim's notifications untouched", JSON.stringify(await notes("m.orlov")) === JSON.stringify(maximBefore));

  // вкладки
  await page.click("dialog[open] button[aria-pressed]:has-text('Расписание')");
  const sched = (await page.textContent("dialog[open][aria-label='Уведомления']")) ?? "";
  check("tab «Расписание» filters", sched.includes("Английский переехал") && !sched.includes("8 из 10") && !sched.includes("Экономикс"));
  await page.click("dialog[open] button[aria-pressed]:has-text('Все')");

  // «Продлить» прямо в шторке
  await page.click("dialog[open] [data-action-card] button:has-text('Продлить')");
  await page.waitForSelector("text=Продлено до 4 декабря");
  await page.waitForTimeout(800);
  const book = (await notes("a.vorontsova")).find((n) => n.category === "library");
  check("resolve: book extended, title updated", !!book.resolvedAt && book.title === "«Экономикс» продлена" && book.body === "Вернуть до 4 декабря", `${book.title} / ${book.body}`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  check("bell now 1, strip gone", (await bell(page)) === "1" && (await page.locator("[data-urgent]").count()) === 0, await bell(page));

  // подделки
  const maximNote = maximBefore.find((n) => n.level === "action");
  const linkNote = afterSeen.find((n) => n.actionKind === "link" && n.level === "action");
  const f1 = await forge(ctx, "resolveNotification", [maximNote.id]);
  const f2 = await forge(ctx, "resolveNotification", [linkNote.id]);
  const f3 = await forge(ctx, "resolveNotification", [book.id]);
  const f4 = await forge(ctx, "resolveNotification", ["' OR 1=1 --"]);
  const f5 = await forge(ctx, "resolveNotification", [{ id: maximNote.id }]);
  check("cannot resolve another user's notification", f1.body.includes("Уведомление не найдено") && !(await db.notification.findUniqueOrThrow({ where: { id: maximNote.id } })).resolvedAt);
  check("link-action cannot be «resolved» by request", f2.body.includes("не требует действия") && !(await db.notification.findUniqueOrThrow({ where: { id: linkNote.id } })).resolvedAt);
  check("double resolve rejected", f3.body.includes("Уже сделано"));
  check("garbage / object id rejected", f4.body.includes("Уведомление не найдено") && f5.body.includes("Уведомление не найдено"));

  // ---- заявка ждёт скан: ссылка «Загрузить» → окно заявки → загрузка
  const visa = await db.officeRequest.findUniqueOrThrow({ where: { number: "R-2481" } });
  const maxReq = await db.officeRequest.findUniqueOrThrow({ where: { number: "R-2479" } });
  // Подделка запроса к server action из браузера — тем же кодированием, что у клиента (React encodeReply):
  // в FormData сначала «_1_file», потом «0» с аргументами [id, "$K1"]. kind: pdf | exe (не PDF внутри) | big (9 МБ)
  const upload = (pg, reqId, kind = "pdf") =>
    pg.evaluate(
      async ({ action, reqId, kind }) => {
        const bytes = kind === "exe" ? new TextEncoder().encode("MZ fake exe") : new Uint8Array(kind === "big" ? 9 * 1024 * 1024 : 64);
        if (kind !== "exe") bytes.set([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
        const fd = new FormData();
        fd.append("_1_file", new File([bytes], "scan.pdf", { type: "application/pdf" }));
        fd.append("0", JSON.stringify([reqId, "$K1"]));
        const r = await fetch("/office", { method: "POST", headers: { "Next-Action": action, Accept: "text/x-component" }, body: fd });
        return r.text();
      },
      { action: actionId("uploadRequestFile", "office"), reqId, kind },
    );
  const PDF = Buffer.from("%PDF-1.4\n%demo\n%%EOF\n");
  const { page: mpage } = await login("m.orlov");
  const u1 = await upload(mpage, visa.id);
  check("Maxim cannot upload to Alisa's request", u1.includes("Заявка не найдена") && (await db.requestFile.count({ where: { requestId: visa.id } })) === 0, u1.slice(0, 80));
  const u2 = await upload(page, maxReq.id);
  check("Alisa cannot upload to Maxim's request", u2.includes("Заявка не найдена"));
  const u3 = await upload(page, visa.id, "exe");
  check("non-PDF content with .pdf name rejected (signature)", u3.includes("Нужен PDF, JPG или PNG"), u3.slice(0, 80));
  const u4 = await upload(page, visa.id, "big");
  check("file over 8 MB rejected", u4.includes("Файл больше 8 МБ"), u4.slice(0, 80));
  const reqB = (await db.officeRequest.findFirst({ where: { number: "R-2477" } }));
  const u5 = await upload(page, reqB.id);
  check("upload where office does not wait — rejected", u5.includes("не ждёт документов"));
  check("still nothing stored", (await db.requestFile.count()) === 0);

  await page.goto(BASE + "/office?request=R-2481");
  await page.waitForSelector("[data-upload]");
  const cardText = (await page.textContent('[data-request="R-2481"]')) ?? "";
  check("office card shows «ждёт вас» and what is awaited", cardText.includes("ждёт вас") && cardText.includes("Ждём скан загранпаспорта"));
  await page.setInputFiles("[data-upload] input[type=file]", { name: "passport.pdf", mimeType: "application/pdf", buffer: PDF });
  await page.click("button:has-text('Отправить в офис')");
  await page.waitForSelector("[data-file]");
  const visaAfter = await db.officeRequest.findUniqueOrThrow({ where: { id: visa.id }, include: { files: true } });
  const officeNote = (await notes("a.vorontsova")).find((n) => n.refId === "R-2481");
  check("upload via UI: file stored, request no longer waiting", visaAfter.files.length === 1 && !!visaAfter.docReceivedAt && visaAfter.files[0].mime === "application/pdf");
  check("upload resolves the «Загрузите скан» notification", !!officeNote.resolvedAt);
  check("file on disk under random name", existsSync(join("storage", "uploads", visaAfter.files[0].storedAs)) && /^[a-f0-9]{32}\.pdf$/.test(visaAfter.files[0].storedAs));
  const u6 = await upload(page, visa.id);
  check("second upload rejected", u6.includes("не ждёт документов"));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  check("bell: no pending actions left", ((await bell(page)) ?? "") !== "2" && ((await bell(page)) ?? "") !== "1", String(await bell(page)));
  for (const f of visaAfter.files) rmSync(join("storage", "uploads", f.storedAs), { force: true });

  // без входа
  const anonCtx = await browser.newContext();
  const anon = await forge(anonCtx, "resolveNotification", [maximNote.id]);
  check("anonymous resolve → redirect to /login, nothing changed", [303, 307, 308].includes(anon.status) || anon.body.includes("/login"), String(anon.status));
  check("Maxim still has his action", !(await db.notification.findUniqueOrThrow({ where: { id: maximNote.id } })).resolvedAt);

  // Максим: срок через неделю — без полосы, но число на колокольчике
  const { page: mp } = await login("m.orlov");
  check("Maxim: bell 1, no urgent strip", (await bell(mp)) === "1" && (await mp.locator("[data-urgent]").count()) === 0);

  // преподаватель: свои уведомления (сдачи, ведомость), без студенческих
  const { page: tp } = await login("e.petrova");
  await tp.click("[data-bell]");
  await tp.waitForSelector("text=Ведомость по Микроэкономике");
  const tc = (await tp.locator("dialog[open]").textContent()) ?? "";
  check("teacher: own notifications only", tc.includes("Problem set 6") && !tc.includes("8 из 10 за контрольную"));
} finally {
  await browser.close();
  server.kill();
  execSync("npm run db:seed", { stdio: "ignore" });
  await db.$disconnect();
}
const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
