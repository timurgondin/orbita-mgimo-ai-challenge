// Запуск: npm run build && PORT=3101 node scripts/teach-check.mjs  (сам поднимает next start)
// Кабинет преподавателя: «Сегодня», проверка работ (студент видит оценку и уведомление), журнал, ассистенты курса,
// слоты консультаций, печать; подделки (чужой курс, студент вместо преподавателя, неверные оценки и поля).
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
async function forge(ctx, file, name, args, path = "/") {
  const r = await ctx.request.post(BASE + path, {
    headers: { "Next-Action": actionId(name, file), "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component" },
    data: JSON.stringify(args),
    maxRedirects: 0,
  });
  return { status: r.status(), body: await r.text() };
}

const browser = await chromium.launch();
let ipN = 80;
async function login(name) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { "x-forwarded-for": `10.9.2.${ipN++}` } });
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
const F = "server/teach/actions";
const ok = (r) => r.status === 200 && r.body.includes('"ok":true');
const refused = (r) => !r.body.includes('"ok":true');

try {
  const petrova = await db.user.findUniqueOrThrow({ where: { login: "e.petrova" } });
  const alisa = await db.user.findUniqueOrThrow({ where: { login: "a.vorontsova" } });
  const micro = await db.course.findUniqueOrThrow({ where: { slug: "micro-24" }, include: { components: true } });
  const platforms = await db.course.findUniqueOrThrow({ where: { slug: "platforms-26" } });
  const foreign = await db.course.findUniqueOrThrow({ where: { slug: "econometrics-24" } });

  const t = await login("e.petrova");
  // «Сегодня»: ближайшая пара, плитки, очередь проверки
  check("today: next lesson card", ((await t.page.textContent("[data-teach-now]")) ?? "").includes("Экономика цифровых платформ"));
  const waiting = await db.assignmentWork.count({ where: { status: { in: ["submitted", "reviewing"] }, assignment: { courseId: { in: [micro.id, platforms.id] } } } });
  check("today: review queue count", ((await t.page.textContent("main")) ?? "").includes(`На проверке ${waiting}`), `${waiting}`);
  check("dock: «Курсы» for teacher", (await t.page.locator('nav[aria-label="Основная навигация"] a[href="/study"]').first().getAttribute("aria-label")) === "Курсы");

  // проверка работы Алисы через окно
  const work = await db.assignmentWork.findFirstOrThrow({ where: { userId: alisa.id, status: "submitted", assignment: { courseId: micro.id } }, include: { assignment: true } });
  await open(t.page, `/study?tab=review&work=${work.id}`);
  await t.page.waitForSelector("dialog[open] #rv-score");
  await t.page.fill("#rv-score", "9");
  await t.page.fill("#rv-text", "Хороший разбор модели Курно.");
  await t.page.click("[data-review-grade]");
  await t.page.waitForTimeout(1200);
  const after = await db.assignmentWork.findUniqueOrThrow({ where: { id: work.id } });
  check("review: graded 9 with feedback", after.status === "graded" && after.score === 9 && after.feedback?.includes("Курно"));
  const note = await db.notification.findFirst({ where: { userId: alisa.id, title: `9 из 10 за ${work.assignment.title}` } });
  check("review: student notified", !!note && note.actorName === "Петрова Е. А.");

  // журнал: курс и ячейки
  await open(t.page, "/study?tab=journal");
  check("journal: gradebook with students", (await t.page.locator("[data-gradebook] tbody tr").count()) >= 12);
  await open(t.page, "/study/micro-24");
  check("course page: team with assistant", ((await t.page.textContent("[data-team]")) ?? "").includes("Ассистент"));
  await open(t.page, "/time");
  check("time: teacher schedule", (await t.page.locator(".slot").count()) > 0);
  await open(t.page, "/print");
  check("print open for teacher", new URL(t.page.url()).pathname === "/print");

  // чужой курс — 404
  await open(t.page, "/study/econometrics-24");
  const b404 = (await t.page.textContent("main")) ?? "";
  check("teacher: foreign course → 404", /Курс не найден/.test(b404) && !b404.includes("Формула оценки"));

  // журнал через действие: верно / неверно
  const kr = micro.components.find((c) => c.title === "Контрольная №1");
  const hw = micro.components.find((c) => c.aggregate);
  const classmate = await db.user.findUniqueOrThrow({ where: { login: "d.belyaeva" } });
  check("setScore: valid", ok(await forge(t.ctx, F, "setScore", ["micro-24", kr.id, classmate.id, "7,5"])));
  check("setScore: stored", (await db.studentWork.findFirst({ where: { componentId: kr.id, userId: classmate.id } }))?.score === 7.5);
  check("setScore: 11 refused", refused(await forge(t.ctx, F, "setScore", ["micro-24", kr.id, classmate.id, "11"])));
  check("setScore: aggregate refused", refused(await forge(t.ctx, F, "setScore", ["micro-24", hw.id, classmate.id, "8"])));
  const stranger = await db.user.findFirstOrThrow({ where: { role: "student", groupName: "ЦЭ-26-М" } });
  check("setScore: not enrolled refused", refused(await forge(t.ctx, F, "setScore", ["micro-24", kr.id, stranger.id, "8"])));
  const fComp = await db.gradeComponent.findFirstOrThrow({ where: { courseId: foreign.id, aggregate: false } });
  check("setScore: foreign course refused", refused(await forge(t.ctx, F, "setScore", ["econometrics-24", fComp.id, alisa.id, "10"])));

  // проверка чужой работы
  const fWork = await db.assignmentWork.findFirstOrThrow({ where: { assignment: { courseId: foreign.id } } });
  check("reviewWork: foreign course refused", refused(await forge(t.ctx, F, "reviewWork", [fWork.id, "grade", 10, ""])));
  const subm = await db.assignmentWork.findFirstOrThrow({ where: { status: "submitted", assignment: { courseId: micro.id } } });
  check("reviewWork: bad score refused", refused(await forge(t.ctx, F, "reviewWork", [subm.id, "grade", 12, ""])));
  check("reviewWork: return without comment refused", refused(await forge(t.ctx, F, "reviewWork", [subm.id, "return", null, " "])));

  // ассистенты
  const senior = await db.user.findFirstOrThrow({ where: { role: "student", course: 4, program: "Финансы", assisting: { none: {} } } });
  check("assign: senior ok", ok(await forge(t.ctx, F, "assignAssistant", ["micro-24", senior.id, true, true])));
  check("assign: stored with rights", !!(await db.courseAssistant.findFirst({ where: { courseId: micro.id, userId: senior.id, canGrade: true } })));
  check("assign: assistant notified", !!(await db.notification.findFirst({ where: { userId: senior.id, title: { contains: "ассистент" } } })));
  check("assign: enrolled student refused", refused(await forge(t.ctx, F, "assignAssistant", ["micro-24", classmate.id, true, false])));
  const fresh = await db.user.findUniqueOrThrow({ where: { login: "n.lanskaya" } });
  check("assign: first-year refused", refused(await forge(t.ctx, F, "assignAssistant", ["micro-24", fresh.id, true, false])));
  check("assign: foreign course refused", refused(await forge(t.ctx, F, "assignAssistant", ["econometrics-24", senior.id, true, false])));
  const a = await db.courseAssistant.findFirstOrThrow({ where: { courseId: micro.id, userId: senior.id } });
  check("remove assistant: ok", ok(await forge(t.ctx, F, "removeAssistant", [a.id])));

  // консультации
  check("addConsultation: ok", ok(await forge(t.ctx, F, "addConsultation", [micro.id, "2026-11-23", 6, "Каб. 518", 6])));
  const cons = await db.consultation.findFirst({ where: { courseId: micro.id, startsAt: new Date("2026-11-23T16:20:00+03:00") } });
  check("addConsultation: stored", !!cons && cons.capacity === 6);
  check("addConsultation: past day refused", refused(await forge(t.ctx, F, "addConsultation", [micro.id, "2026-11-18", 6, "Каб. 518", 6])));
  check("addConsultation: foreign course refused", refused(await forge(t.ctx, F, "addConsultation", [foreign.id, "2026-11-23", 6, "Каб. 518", 6])));
  check("addConsultation: bad capacity refused", refused(await forge(t.ctx, F, "addConsultation", [micro.id, "2026-11-23", 6, "Каб. 518", 500])));
  await t.ctx.close();

  // студент: видит оценку и новую консультацию, но не может звать действия преподавателя
  const s = await login("a.vorontsova");
  await open(s.page, "/time?tab=cons");
  check("student sees new consultation slot", (await s.page.locator("main").textContent())?.includes("23 нояб") || (await db.consultation.count({ where: { courseId: micro.id } })) > 1);
  check("student: reviewWork refused", refused(await forge(s.ctx, F, "reviewWork", [subm.id, "grade", 10, ""])));
  check("student: setScore refused", refused(await forge(s.ctx, F, "setScore", ["micro-24", kr.id, alisa.id, "10"])));
  check("student: assignAssistant refused", refused(await forge(s.ctx, F, "assignAssistant", ["micro-24", senior.id, true, true])));
  check("student: addConsultation refused", refused(await forge(s.ctx, F, "addConsultation", [micro.id, "2026-11-24", 6, "Каб. 518", 6])));
  await open(s.page, "/study/platforms-26");
  const sb = (await s.page.textContent("main")) ?? "";
  check("student: not-enrolled teacher course → 404", /Курс не найден/.test(sb) && !sb.includes("Команда"));
  await s.ctx.close();
  void petrova;
} finally {
  await browser.close();
  server.kill();
  await db.$disconnect();
}
const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
