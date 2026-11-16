import { Suspense } from "react";
import type { Metadata } from "next";
import { PageEnter } from "@/components/shell/page-transition";
import { completeOnboardingAction } from "@/server/auth/actions";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Добро пожаловать — Орбита" };

async function Welcome() {
  await requireUser();
  return (
    <>
      <PageEnter />
      <form
        action={completeOnboardingAction}
        className="mx-auto flex min-h-dvh max-w-[380px] flex-col items-start justify-center gap-6 px-5"
      >
        <h1 className="text-[34px] leading-[1.15] font-medium tracking-[-.03em] max-sm:text-[28px]">
          Добро пожаловать
        </h1>
        <button
          type="submit"
          className="h-[50px] rounded-[14px] bg-text px-8 text-[15px] font-semibold tracking-[-.01em] text-bg transition-[transform,opacity] duration-150 ease-soft hover:opacity-90 active:scale-[.985]"
        >
          Продолжить
        </button>
      </form>
    </>
  );
}

export default function WelcomePage() {
  return (
    <Suspense fallback={null}>
      <Welcome />
    </Suspense>
  );
}
