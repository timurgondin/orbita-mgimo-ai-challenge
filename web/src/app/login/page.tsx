import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login/login-form";
import { OrbitCanvas } from "@/components/login/orbit-canvas";
import { Logo } from "@/components/shell/top-bar";
import { getCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Вход — Орбита" };

async function RedirectIfSignedIn() {
  if (await getCurrentUser()) redirect("/");
  return null;
}

export default function LoginPage() {
  return (
    <div className="grid min-h-dvh grid-cols-1 min-[901px]:h-dvh min-[901px]:grid-cols-[minmax(0,1.1fr)_minmax(420px,1fr)] min-[901px]:overflow-hidden">
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>

      <section className="relative h-60 overflow-hidden bg-bg min-[901px]:h-auto">
        <OrbitCanvas />
        <div className="absolute top-[22px] left-6 min-[901px]:top-8 min-[901px]:left-14">
          <Logo textOnMobile />
        </div>
        <div className="absolute top-6 right-6 text-right min-[901px]:top-auto min-[901px]:right-14 min-[901px]:bottom-[52px] min-[901px]:left-14 min-[901px]:text-left">
          <div className="text-[15px] text-text-2">Университет Будущего</div>
          <h1 className="mt-2 hidden max-w-[14ch] text-[44px] leading-[1.08] font-medium tracking-[-.035em] min-[901px]:block">
            Вся учёба — на одной орбите
          </h1>
        </div>
      </section>

      <section className="flex min-h-0 flex-col bg-bg px-5 py-7 shadow-none [scrollbar-width:none] min-[901px]:overflow-y-auto min-[901px]:px-14 min-[901px]:pt-8 min-[901px]:pb-6 min-[901px]:shadow-[-.5px_0_0_var(--line)]">
        <LoginForm />
        <p className="pt-6 text-center text-xs text-text-3">
          Концепт для конкурса MGIMO×AI Challenge. Не официальный сервис, все данные вымышлены.
        </p>
      </section>
    </div>
  );
}
