import { Suspense } from "react";
import { PageEnter } from "@/components/shell/page-transition";
import { TopBar } from "@/components/shell/top-bar";
import { requireUser } from "@/server/auth/session";
import { NotificationCenter } from "@/components/notifications/center";
import { getNotificationCenter } from "@/server/data/notifications";

// Сессия читается в запросе, поэтому всё содержимое — за Suspense (Cache Components).
async function Shell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const center = await getNotificationCenter();
  return (
    <NotificationCenter data={center}>
      <PageEnter />
      <TopBar user={user} />
      <main className="mx-auto max-w-[1180px] px-5 pt-11 pb-20 sm:px-10">{children}</main>
    </NotificationCenter>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <Shell>{children}</Shell>
      </Suspense>
      <footer className="px-5 pb-7 text-center text-xs text-text-3">
        Концепт для конкурса MGIMO×AI Challenge. Не официальный сервис, все данные вымышлены.
        <br />
        Иконки —{" "}
        <a href="https://www.figma.com/community/file/1166831539721848736" target="_blank" rel="noreferrer" className="underline-offset-2 hover:text-text-2 hover:underline">
          Solar, 480 Design
        </a>
        , CC BY 4.0.
      </footer>
    </>
  );
}
