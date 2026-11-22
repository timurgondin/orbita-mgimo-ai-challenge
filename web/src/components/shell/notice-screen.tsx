import Link from "next/link";
import { Logo } from "./top-bar";

const BTN =
  "inline-flex min-h-11 items-center rounded-full px-5 text-[15px] font-medium transition-[background-color,transform] duration-150 active:scale-[.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** Экран-сообщение вне оболочки: 404 и ошибки. Без поясняющего текста. */
export function NoticeScreen({
  big,
  title,
  onRetry,
}: {
  big?: string;
  title: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex min-h-dvh flex-col px-5 pt-[calc(env(safe-area-inset-top)+22px)] pb-[calc(env(safe-area-inset-bottom)+24px)] sm:px-10 sm:pt-8">
      <Logo />
      <main className="flex flex-1 flex-col items-start justify-center pb-16">
        {big && (
          <p className="text-[96px] leading-none font-medium tracking-[-.05em] text-text-3 tabular-nums max-sm:text-[72px]">
            {big}
          </p>
        )}
        <h1 className="mt-4 text-[34px] leading-[1.15] font-medium tracking-[-.03em] max-sm:text-[28px]">{title}</h1>
        <div className="mt-8 flex flex-wrap gap-3">
          {onRetry && (
            <button type="button" onClick={onRetry} className={`${BTN} bg-text text-bg hover:opacity-90`}>
              Повторить
            </button>
          )}
          <Link href="/" className={`${BTN} ${onRetry ? "bg-s2 text-text hover:bg-s3" : "bg-text text-bg hover:opacity-90"}`}>
            На главную
          </Link>
        </div>
      </main>
    </div>
  );
}
