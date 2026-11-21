import { Suspense } from "react";
import type { Metadata } from "next";
import { Source_Serif_4 } from "next/font/google";
import { redirect } from "next/navigation";
import { Onboarding } from "@/components/onboarding/onboarding";
import { PageEnter } from "@/components/shell/page-transition";
import { requireUser } from "@/server/auth/session";
import { personalRows } from "@/server/data/first-steps";
import { getStudentCard } from "@/server/data/profile";

export const metadata: Metadata = { title: "Добро пожаловать — Орбита" };

// Засечки — только для «больших моментов» онбординга (docs/design.md)
const serif = Source_Serif_4({ subsets: ["latin", "cyrillic"], weight: ["400"], style: ["normal", "italic"], variable: "--font-serif" });

async function Welcome() {
  const user = await requireUser();
  // онбординг — только для студента. Прошедший может открыть его снова: на последнем экране онбординг
  // уже отмечен пройденным (finishOnboarding), и обновление страницы после server action не должно уводить на «/»
  if (user.role !== "student") redirect("/");
  const card = await getStudentCard();
  if (!card) redirect("/");
  return (
    <>
      <PageEnter />
      <Onboarding
        data={{
          firstName: user.firstName,
          rows: personalRows(user),
          program: user.program ?? "",
          group: user.groupName ? `Группа ${user.groupName}` : "",
          phone: user.phone,
          telegram: user.telegram,
          card,
        }}
      />
    </>
  );
}

export default function WelcomePage() {
  return (
    <div className={serif.variable}>
      <Suspense fallback={null}>
        <Welcome />
      </Suspense>
    </div>
  );
}
