import { PrismaClient } from "@prisma/client";
import { hashPassword, PEPPER_VERSION } from "../src/server/auth/password";

const db = new PrismaClient();
const PASSWORD = "orbita-demo";

const users = [
  { login: "a.vorontsova", role: "student", firstName: "Алиса", lastName: "Воронцова", faculty: "Факультет международного бизнеса", program: "Международный бизнес", course: 2, groupName: "МБ-24-1", avatar: "sand", onboardingDone: true },
  { login: "m.orlov", role: "student", firstName: "Максим", lastName: "Орлов", faculty: "Факультет международных отношений", program: "Мировая политика", course: 4, groupName: "МП-22-2", avatar: "mist", onboardingDone: true },
  { login: "n.lanskaya", role: "student", firstName: "Ника", lastName: "Ланская", faculty: "Факультет международного бизнеса", program: "Маркетинг", course: 1, groupName: "МК-26-1", avatar: "lilac", onboardingDone: false },
  { login: "e.petrova", role: "teacher", firstName: "Елена", middleName: "Андреевна", lastName: "Петрова", faculty: "Кафедра экономики", position: "Преподаватель", avatar: "peach", onboardingDone: true },
  { login: "office", role: "staff", firstName: "Ирина", lastName: "Смирнова", position: "Учебный офис", avatar: "stone", onboardingDone: true },
];

for (const u of users) {
  const passwordHash = await hashPassword(PASSWORD);
  const data = { ...u, passwordHash, pepperVersion: PEPPER_VERSION };
  await db.user.upsert({ where: { login: u.login }, create: data, update: data });
}
console.log(`Seeded ${users.length} users`);
await db.$disconnect();
