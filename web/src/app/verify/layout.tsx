import type { Metadata } from "next";
import { Logo } from "@/components/shell/top-bar";

export const metadata: Metadata = { title: "Проверка документа — Орбита", robots: { index: false, follow: false } };

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-5 pt-6 sm:px-10">
        <Logo />
      </header>
      <main className="mx-auto flex w-full max-w-[520px] flex-1 flex-col justify-center px-5 pb-16">{children}</main>
      <footer className="px-5 pb-7 text-center text-xs text-text-3">
        Концепт для конкурса MGIMO×AI Challenge. Не официальный сервис, все данные вымышлены.
      </footer>
    </div>
  );
}
