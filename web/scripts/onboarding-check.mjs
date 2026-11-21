// Запуск: npm run build && PORT=3101 node scripts/onboarding-check.mjs  (сам поднимает next start)
// Онбординг первокурсницы: обход по адресу, роли, полный проход, фото только своё, подделки, «Первые шаги», сброс при входе.
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
const actionId = (name, file) => Object.entries(manifest).find(([, v]) => v.exportedName === name && v.filename.includes(file))?.[0];

const server = spawn("node", ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], { env: { ...process.env, COOKIE_SECURE: "false" }, stdio: "ignore" });
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(BASE + "/login")).ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 500));
}

const browser = await chromium.launch();
let ipN = 20;
async function login(name, opts = {}) {
  const ctx = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": `10.7.0.${ipN++}` }, ...opts });
  const page = await ctx.newPage();
  await page.goto(BASE + "/login");
  await page.fill("#login", name);
  await page.fill("#pass", "orbita-demo");
  await page.click("button[type=submit]");
  await page.waitForURL((u) => u.pathname === "/" || u.pathname === "/welcome");
  return { ctx, page };
}
// Подделка вызова server action тем же кодированием, что у клиента (React encodeReply)
async function forgeJson(ctx, name, file, args) {
  const r = await ctx.request.post(BASE + "/", {
    headers: { "Next-Action": actionId(name, file), "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component" },
    data: JSON.stringify(args),
    maxRedirects: 0,
  });
  return { status: r.status(), body: await r.text() };
}
const uploadPhoto = (page, kind) =>
  page.evaluate(
    async ({ action, kind }) => {
      let bytes;
      if (kind === "exe") bytes = new TextEncoder().encode("MZ not an image");
      else if (kind === "big") bytes = new Uint8Array(2 * 1024 * 1024).fill(1);
      else bytes = new Uint8Array(256);
      if (kind !== "exe") bytes.set([0xff, 0xd8, 0xff, 0xe0]); // сигнатура JPEG
      const fd = new FormData();
      fd.append("_1_photo", new File([bytes], "photo.jpg", { type: "image/jpeg" }));
      fd.append("0", JSON.stringify(["$K1"]));
      const r = await fetch("/welcome", { method: "POST", headers: { "Next-Action": action, Accept: "text/x-component" }, body: fd });
      return r.text();
    },
    { action: actionId("savePhoto", "onboarding"), kind },
  );
const user = (login) => db.user.findUniqueOrThrow({ where: { login } });

try {
  check("action ids found", !!actionId("savePhoto", "onboarding") && !!actionId("confirmPersonalData", "onboarding"));

  // ---- без входа
  const anon = await fetch(BASE + "/me/photo", { redirect: "manual" });
  check("anonymous /me/photo → /login", [307, 308].includes(anon.status) && anon.headers.get("location")?.includes("/login"));
  const anonW = await fetch(BASE + "/welcome", { redirect: "manual" });
  check("anonymous /welcome → /login", [307, 308].includes(anonW.status));

  // ---- роли: онбординг только у студента без него
  const { page: ap } = await login("a.vorontsova");
  check("Alisa (done) lands on /", new URL(ap.url()).pathname === "/");
  const { page: tp } = await login("e.petrova");
  await tp.goto(BASE + "/welcome");
  await tp.waitForURL((u) => u.pathname === "/");
  check("teacher /welcome → /", new URL(tp.url()).pathname === "/");
  const tPhoto = await uploadPhoto(tp, "ok");
  check("teacher cannot save a photo", tPhoto.includes("Только для студентов"), tPhoto.slice(-80));

  // ---- первокурсница: сброс при входе и обход по адресу
  await db.user.update({ where: { login: "n.lanskaya" }, data: { onboardingDone: true, phone: "+7 900 000-00-01", dataConfirmedAt: new Date() } });
  const { ctx: nctx, page: np } = await login("n.lanskaya", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  check("Nika login → /welcome", new URL(np.url()).pathname === "/welcome");
  const reset = await user("n.lanskaya");
  check("login resets demo freshman", !reset.onboardingDone && !reset.phone && !reset.dataConfirmedAt && !reset.photoAt);
  for (const path of ["/", "/profile", "/study", "/office"]) {
    const p2 = await nctx.newPage();
    await p2.goto(BASE + path);
    await p2.waitForURL((u) => u.pathname === "/welcome", { timeout: 10000 }).catch(() => {});
    check(`onboarding not bypassed via ${path}`, new URL(p2.url()).pathname === "/welcome");
    await p2.close();
  }
  const noPhoto = await nctx.request.get(BASE + "/me/photo");
  check("no photo yet → 404", noPhoto.status() === 404);

  // ---- подделки фото
  const bad = await uploadPhoto(np, "exe");
  check("non-image with .jpg name rejected (signature)", bad.includes("Нужна фотография JPG или PNG"), bad.slice(-80));
  const big = await uploadPhoto(np, "big");
  check("photo over 1.5 MB rejected", big.includes("Фото слишком большое"), big.slice(-80));
  check("rejected uploads stored nothing", (await db.userPhoto.count({ where: { user: { login: "n.lanskaya" } } })) === 0);

  // ---- проход
  await np.getByRole("button", { name: "Начать" }).click();
  await np.waitForSelector('[data-step="cohort"]');
  await np.getByRole("button", { name: "Дальше" }).click();
  await np.waitForSelector('[data-step="data"]');
  const dataText = (await np.textContent('[data-step="data"]')) ?? "";
  check("data step shows own data", dataText.includes("Ланская Ника Игоревна") && dataText.includes("МК-26-1") && dataText.includes("26-МК-0931") && !dataText.includes("Воронцова"));
  await np.locator("[data-confirm]").click();
  await np.waitForSelector('[data-step="contacts"]');
  check("«Всё верно» saved", !!(await user("n.lanskaya")).dataConfirmedAt);
  await np.fill("[data-contact=phone]", "12");
  await np.locator("[data-next]").click();
  await np.waitForSelector("text=Проверьте номер телефона");
  check("bad phone shows error, stays on step", (await np.locator('[data-step="contacts"]').count()) === 1);
  await np.fill("[data-contact=phone]", "89001112233");
  await np.fill("[data-contact=telegram]", "nika_l");
  await np.locator("[data-next]").click();
  await np.waitForSelector('[data-step="photo"]');
  const afterContacts = await user("n.lanskaya");
  check("contacts saved and normalized", afterContacts.phone === "+7 900 111-22-33" && afterContacts.telegram === "@nika_l");

  // настоящее изображение: браузер ужимает до квадрата и шлёт JPEG
  const png = await np.evaluate(async () => {
    const cv = document.createElement("canvas");
    cv.width = 1200;
    cv.height = 900;
    const c = cv.getContext("2d");
    c.fillStyle = "#b79bcc";
    c.fillRect(0, 0, 1200, 900);
    const b = await new Promise((r) => cv.toBlob(r, "image/png"));
    return Array.from(new Uint8Array(await b.arrayBuffer()));
  });
  await np.setInputFiles("[data-photo-input]", { name: "me.png", mimeType: "image/png", buffer: Buffer.from(png) });
  await np.waitForSelector('[data-step="photo"] [data-next]', { timeout: 15000 });
  const photoRow = await db.userPhoto.findFirst({ where: { user: { login: "n.lanskaya" } } });
  check("photo saved as JPEG", photoRow?.mime === "image/jpeg" && photoRow.data.length < 1.5 * 1024 * 1024);
  const own = await nctx.request.get(BASE + "/me/photo");
  check("own /me/photo → 200 image/jpeg, private", own.status() === 200 && own.headers()["content-type"] === "image/jpeg" && own.headers()["cache-control"]?.includes("private"));
  const alien = await ap.context().request.get(BASE + "/me/photo?user=n.lanskaya");
  check("Alisa gets only her own (no photo → 404), not Nika's", alien.status() === 404);

  await np.locator("[data-next]").click();
  await np.waitForSelector("[data-id-card]");
  check("Orbita ID card shows the photo and QR", (await np.locator("[data-card-photo]").count()) === 1 && (await np.locator("[data-id-card] [data-orbita-qr] svg").count()) === 1);
  await np.waitForTimeout(3200);
  await np.getByRole("button", { name: "Дальше" }).click();
  await np.waitForSelector('[data-step="ready"]');
  await np.waitForTimeout(1800);
  check("last screen marks onboarding done (Today preloads)", (await user("n.lanskaya")).onboardingDone === true && new URL(np.url()).pathname === "/welcome");
  await np.locator("[data-finish]").click();
  await np.waitForURL((u) => u.pathname === "/", { timeout: 15000 });
  check("finish → /", new URL(np.url()).pathname === "/");

  // ---- «Первые шаги»
  await np.waitForSelector("[data-first-steps]");
  const doneSteps = await np.locator("[data-first-steps] [data-done]").count();
  const allSteps = await np.locator("[data-first-steps] li").count();
  check("first steps: 3 of 5 done after onboarding", doneSteps === 3 && allSteps === 5, `${doneSteps}/${allSteps}`);
  check("avatar in top bar is the photo", (await np.locator('button[aria-label="Профиль и настройки"] img').count()) === 1);
  const { page: a2 } = await login("a.vorontsova");
  check("Alisa (2nd year) has no first steps", (await a2.locator("[data-first-steps]").count()) === 0);

  // «Первые шаги»: данные — в окне прямо на «Сегодня»; «Есть ошибка» — несколько полей в одной заявке
  await np.locator('[data-first-steps] [data-step="data"] button').click();
  await np.waitForSelector('[data-first-step-dialog="data"]');
  await np.locator("[data-report]").click();
  await np.fill("[data-fix-input]", "Ланская Вероника Игоревна");
  await np.locator('[data-fix-chip="Курс и группа"]').click();
  await np.fill("[data-fix-input]", "1 курс, группа МК-26-2");
  await np.locator('[data-fix-chip="Форма обучения"]').click(); // выбран, но не изменён — в заявку не идёт
  const yellow = await np.locator("[data-fix-chip][data-fixed]").count();
  const rowsChanged = await np.locator('[data-first-step-dialog="data"] [data-row][data-changed]').count();
  check("two fixed chips turn yellow, rows show new values", yellow === 2 && rowsChanged === 2, `${yellow}/${rowsChanged}`);
  await np.locator("[data-send-fix]").click();
  await np.waitForSelector("text=в учебном офисе");
  const fix = await db.officeRequest.findFirst({ where: { user: { login: "n.lanskaya" }, typeId: "data-fix" } });
  const fp = JSON.parse(fix?.params ?? "{}");
  check("one request with both fixes", fp.subject === "ФИО, Курс и группа" && fp.comment.includes("Вероника") && fp.comment.includes("МК-26-2") && !fp.comment.includes("Форма"), fix?.params);
  const forgedFix = await forgeJson(nctx, "createRequest", "office", ["data-fix", { subject: ["ФИО", "Пароль"], comment: "" }]);
  check("forged fix with unknown field rejected", forgedFix.body.includes("Некорректный выбор"));
  const dupFix = await forgeJson(nctx, "createRequest", "office", ["data-fix", { subject: ["ФИО", "ФИО"], comment: "" }]);
  check("forged fix with duplicate fields rejected", dupFix.body.includes("Некорректный выбор"));
  const multiOther = await forgeJson(nctx, "createRequest", "office", ["retake", { subject: ["Микроэкономика", "Эконометрика"], comment: "" }]);
  check("multi-select only where allowed", multiOther.body.includes("Некорректный выбор"));

  // контакты и фото — тоже в окне, без перехода в профиль
  await np.waitForSelector('[data-first-step-dialog]', { state: "hidden" }).catch(() => {});
  await np.locator('[data-first-steps] [data-step="contacts"] button').click();
  await np.waitForSelector('[data-first-step-dialog="contacts"] [data-contact=telegram]');
  await np.fill('[data-first-step-dialog="contacts"] [data-contact=telegram]', "nika_lanskaya");
  await np.locator('[data-first-step-dialog="contacts"] [data-next]').click();
  await np.waitForFunction(async () => true);
  await np.waitForTimeout(800);
  check("contacts saved from the Today dialog", (await user("n.lanskaya")).telegram === "@nika_lanskaya" && new URL(np.url()).pathname === "/");

  // подделка confirm от преподавателя
  const tConfirm = await forgeJson(tp.context(), "confirmPersonalData", "onboarding", []);
  check("teacher cannot confirm personal data", tConfirm.body.includes("Только для студентов"));

  // ---- повторный вход — всё заново
  const { page: np2 } = await login("n.lanskaya");
  const again = await user("n.lanskaya");
  check("re-login: onboarding again, photo and contacts cleared", new URL(np2.url()).pathname === "/welcome" && !again.onboardingDone && !again.photoAt && !again.phone && (await db.userPhoto.count({ where: { userId: again.id } })) === 0);
} finally {
  await browser.close();
  server.kill();
  execSync("npm run db:seed", { stdio: "ignore" });
  await db.$disconnect();
}
const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
