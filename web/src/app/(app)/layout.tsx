import { Suspense } from "react";
import { TopBar } from "@/components/shell/top-bar";
import { requireUser } from "@/server/auth/session";
import { getUnreadCount } from "@/server/data/today";

// Сессия читается в запросе, поэтому всё содержимое — за Suspense (Cache Components).
async function Shell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const unread = user.role === "student" ? await getUnreadCount() : 0;
  return (
    <>
      <TopBar user={user} unread={unread} />
      <main className="mx-auto max-w-[1180px] px-5 pt-11 pb-20 sm:px-10">{children}</main>
    </>
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
      </footer>
    </>
  );
}
