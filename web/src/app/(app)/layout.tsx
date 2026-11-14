import { TopBar } from "@/components/shell/top-bar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-[1180px] px-5 pt-11 pb-20 sm:px-10">{children}</main>
      <footer className="px-5 pb-7 text-center text-xs text-text-3">
        Концепт для конкурса MGIMO×AI Challenge. Не официальный сервис, все данные вымышлены.
      </footer>
    </>
  );
}
