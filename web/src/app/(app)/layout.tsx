import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AssistantProvider } from "@/components/assistant/assistant";
import { ArriveBridge } from "@/components/onboarding/arrive-bridge";
import { PageEnter } from "@/components/shell/page-transition";
import { TopBar } from "@/components/shell/top-bar";
import { requireUser } from "@/server/auth/session";
import { NotificationCenter } from "@/components/notifications/center";
import { getNotificationCenter } from "@/server/data/notifications";

// Сессия читается в запросе, поэтому всё содержимое — за Suspense (Cache Components).
async function Shell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (user.role === "student" && !user.onboardingDone) redirect("/welcome");
  const center = await getNotificationCenter();
  return (
    <NotificationCenter data={center}>
      <AssistantProvider>
        <PageEnter />
        <TopBar user={user} />
        <main className="mx-auto max-w-[1180px] px-5 pt-6 pb-20 sm:px-10 sm:pt-11">{children}</main>
      </AssistantProvider>
    </NotificationCenter>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={<ArriveBridge />}>
        <Shell>{children}</Shell>
      </Suspense>
      <footer className="px-5 pb-7 text-center text-xs text-text-3 max-sm:pb-[calc(env(safe-area-inset-bottom)+104px)]">
        Концепт для конкурса MGIMO×AI Challenge. Не официальный сервис, все данные вымышлены.
      </footer>
    </>
  );
}
