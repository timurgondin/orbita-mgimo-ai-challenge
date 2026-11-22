// Кабинет преподавателя (e.petrova): работы однокурсников Алисы на проверку, второй курс — магистерская
// «Экономика цифровых платформ», учебный ассистент, уведомления. Все люди вымышленные.
import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

// Входа нет: у каждого своя случайная строка в формате Argon2id (своя соль, случайные байты вместо хеша), как в справочнике
const b64 = (n: number) => randomBytes(n).toString("base64").replace(/=/g, "");
const noPassword = (sample: string) => `${sample.split("$").slice(0, 4).join("$")}$${b64(16)}$${b64(32)}`;

const at = (s: string) => new Date(`${s}:00+03:00`);

/** Детерминированный генератор: один и тот же сид — одни и те же оценки. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

const MAG = [
  ["Афанасьева", "Ульяна"], ["Борисов", "Никита"], ["Власова", "Ксения"], ["Гусев", "Роман"], ["Егорова", "Таисия"], ["Зуев", "Марк"],
  ["Карпова", "Алёна"], ["Логинов", "Савелий"], ["Миронова", "Ева"], ["Носков", "Даниил"], ["Петренко", "Яна"], ["Рябова", "Злата"],
] as const;

export async function seedTeacher(db: PrismaClient, passwordHash: string, pepperVersion: number, login: (first: string, last: string) => string) {
  const r = rng(2611);
  const score = (lo: number, hi: number) => Math.round((lo + r() * (hi - lo)) * 2) / 2;
  const teacher = await db.user.findUniqueOrThrow({ where: { login: "e.petrova" } });
  const petrova = await db.teacher.findUniqueOrThrow({ where: { short: "Петрова Е. А." } });
  const alisa = await db.user.findUniqueOrThrow({ where: { login: "a.vorontsova" } });

  // ---------- Микроэкономика: работы однокурсников ----------
  const micro = await db.course.findUniqueOrThrow({
    where: { slug: "micro-24" },
    include: { components: true, assignments: { orderBy: { dueAt: "asc" } }, enrollments: { where: { userId: { not: alisa.id } }, include: { user: true } } },
  });
  const comp = (title: string) => micro.components.find((c) => c.title === title)!;
  for (const [i, e] of micro.enrollments.entries()) {
    const uid = e.userId;
    await db.studentWork.create({ data: { userId: uid, componentId: comp("Контрольная №1").id, status: "graded", score: score(4, 10), gradedAt: at("2026-11-10T16:00"), submittedAt: at("2026-11-10T11:00") } });
    await db.studentWork.create({ data: { userId: uid, componentId: comp("Работа на семинарах").id, status: "graded", score: score(5.5, 9.5), gradedAt: at("2026-11-14T12:00") } });
    await db.studentWork.create({ data: { userId: uid, componentId: comp("Домашние задания").id, status: "upcoming" } });
    await db.studentWork.create({ data: { userId: uid, componentId: comp("Экзамен").id, status: "upcoming" } });
    for (const [n, a] of micro.assignments.entries()) {
      if (!a.dueAt || a.dueAt > at("2026-11-22T00:00")) continue;
      const file = `ps${n + 1}_${e.user.login.split(".")[1]}.pdf`;
      const size = 600_000 + Math.round(r() * 1_400_000);
      if (n < 5) {
        if (r() < 0.06) continue; // не сдал
        const sent = new Date(a.dueAt.getTime() - Math.round(r() * 60) * 3600_000);
        await db.assignmentWork.create({
          data: { assignmentId: a.id, userId: uid, status: "graded", score: score(5, 10), submittedAt: sent, gradedAt: new Date(a.dueAt.getTime() + 3 * 86400_000), fileName: file, fileSize: size },
        });
      } else if (i % 3 !== 2) {
        // Problem set 6: сдали заранее, ждут проверки
        const sent = new Date(at("2026-11-17T12:00").getTime() + Math.round(r() * 46) * 3600_000);
        await db.assignmentWork.create({ data: { assignmentId: a.id, userId: uid, status: "submitted", submittedAt: sent, fileName: file, fileSize: size } });
      }
    }
  }

  // ---------- Экономика цифровых платформ: магистратура, группа ЦЭ-26-М ----------
  const course = await db.course.create({
    data: {
      slug: "platforms-26", title: "Экономика цифровых платформ", color: "py", format: "offline", assessment: "exam", credits: 5,
      kindsLabel: "Лекции и семинары", teacherName: "Петрова Е. А.", teacherAvatar: "peach", teacherId: teacher.id,
      staff: { create: { teacherId: petrova.id, role: "Занятия" } },
    },
  });
  await db.scheduleEvent.updateMany({ where: { teacherName: "Петрова Е. А.", title: "Экономика цифровых платформ" }, data: { courseId: course.id } });
  const comps = [
    await db.gradeComponent.create({ data: { courseId: course.id, title: "Кейсы", kind: "homework", weight: 30, aggregate: true, order: 0 } }),
    await db.gradeComponent.create({ data: { courseId: course.id, title: "Работа на семинарах", kind: "participation", weight: 20, order: 1 } }),
    await db.gradeComponent.create({ data: { courseId: course.id, title: "Проект «Разбор платформы»", shortTitle: "Проект", kind: "project", weight: 20, dueAt: at("2026-12-10T23:59"), order: 2 } }),
    await db.gradeComponent.create({ data: { courseId: course.id, title: "Экзамен", kind: "exam", weight: 30, dueAt: at("2026-12-24T10:00"), room: "5203", order: 3 } }),
  ];
  const cases = [
    ["Кейс 1. Двусторонние рынки", "2026-10-01T23:59"],
    ["Кейс 2. Сетевые эффекты", "2026-10-22T23:59"],
    ["Кейс 3. Ценообразование маркетплейса", "2026-11-18T23:59"],
    ["Кейс 4. Регулирование экосистем", "2026-12-03T23:59"],
  ] as const;
  const tasks = [];
  for (const [i, [title, due]] of cases.entries()) {
    tasks.push(await db.assignment.create({ data: { courseId: course.id, componentId: comps[0].id, title, kind: "homework", dueAt: at(due), order: i } }));
  }
  const project = await db.assignment.create({ data: { courseId: course.id, componentId: comps[2].id, title: "Проект «Разбор платформы»", kind: "project", dueAt: at("2026-12-10T23:59"), order: 10 } });
  void project;
  for (const [i, [lastName, firstName]] of MAG.entries()) {
    // логин как у всех; если такой уже есть в справочнике — с цифрой
    const base = login(firstName, lastName);
    let lg = base;
    for (let k = 2; await db.user.findUnique({ where: { login: lg } }); k++) lg = `${base}${k}`;
    const data = {
      login: lg, passwordHash: noPassword(passwordHash), pepperVersion, role: "student", firstName, lastName,
      faculty: "Факультет экономики", program: "Цифровая экономика", course: 1, groupName: "ЦЭ-26-М", degree: "Магистратура",
      avatar: ["sand", "mist", "lilac", "peach"][i % 4], onboardingDone: true,
    };
    const u = await db.user.create({ data });
    await db.enrollment.create({ data: { userId: u.id, courseId: course.id } });
    await db.studentWork.create({ data: { userId: u.id, componentId: comps[1].id, status: "graded", score: score(6, 10), gradedAt: at("2026-11-13T12:00") } });
    for (const [n, a] of tasks.entries()) {
      const file = `case${n + 1}_${data.login.split(".")[1]}.pdf`;
      const size = 400_000 + Math.round(r() * 900_000);
      if (n < 2) {
        await db.assignmentWork.create({ data: { assignmentId: a.id, userId: u.id, status: "graded", score: score(6, 10), submittedAt: new Date(a.dueAt!.getTime() - 20 * 3600_000), gradedAt: new Date(a.dueAt!.getTime() + 4 * 86400_000), fileName: file, fileSize: size } });
      } else if (n === 2 && i % 4 !== 3) {
        const late = i % 5 === 1;
        const sent = late ? at("2026-11-19T09:40") : new Date(a.dueAt!.getTime() - Math.round(r() * 40) * 3600_000);
        await db.assignmentWork.create({ data: { assignmentId: a.id, userId: u.id, status: i % 4 === 0 ? "reviewing" : "submitted", submittedAt: sent, fileName: file, fileSize: size } });
      }
    }
  }

  // ---------- Учебные ассистенты: старшекурсники с хорошими оценками ----------
  const seniors = await db.user.findMany({ where: { role: "student", program: "Экономика и данные", course: 4 }, orderBy: { login: "asc" }, take: 2 });
  if (seniors[0]) await db.courseAssistant.create({ data: { courseId: micro.id, userId: seniors[0].id, canReview: true, canGrade: false, createdAt: at("2026-09-02T10:00") } });

  // ---------- Уведомления преподавателя ----------
  const waiting = await db.assignmentWork.count({ where: { assignment: { courseId: micro.id }, status: "submitted" } });
  const notes = [
    { kind: "material", category: "study", level: "info", title: `Problem set 6: сдали ${waiting} из ${micro.enrollments.length + 1}`, body: "Срок — **суббота, 18:00**", link: "/study?tab=review", createdAt: at("2026-11-19T09:00") },
    { kind: "office", category: "office", level: "action", title: "Ведомость по Микроэкономике", body: "Учебный офис ждёт оценки за экзамен до **25 декабря**", link: "/office", createdAt: at("2026-11-18T15:20"), dueAt: at("2026-12-25T18:00"), actorName: "Учебный офис" },
    { kind: "schedule", category: "schedule", level: "important", title: "Лекция 20 ноября — в ауд. 101", body: "Поток МБ-24, вторая пара", link: "/time", createdAt: at("2026-11-17T11:00"), readAt: at("2026-11-17T12:00") },
    { kind: "announcement", category: "announcement", level: "info", title: "Методический семинар кафедры", body: "Пятница, **15:00**, каб. 518", link: null, createdAt: at("2026-11-16T10:00"), readAt: at("2026-11-16T10:30") },
  ];
  for (const n of notes) await db.notification.create({ data: { userId: teacher.id, ...n } });
}
