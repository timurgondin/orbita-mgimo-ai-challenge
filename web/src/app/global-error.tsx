"use client";

import "./globals.css";

// Запасной экран: корневой layout недоступен, поэтому свои html/body, тема — тёмная по умолчанию.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ru">
      <body>
        <div className="flex min-h-dvh flex-col items-start justify-center px-5 sm:px-10">
          <h1 className="text-[34px] leading-[1.15] font-medium tracking-[-.03em] max-sm:text-[28px]">Что-то пошло не так</h1>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={reset}
              className="inline-flex min-h-11 items-center rounded-full bg-text px-5 text-[15px] font-medium text-bg"
            >
              Повторить
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- полная загрузка: дерево React могло сломаться */}
            <a href="/" className="inline-flex min-h-11 items-center rounded-full bg-s2 px-5 text-[15px] font-medium text-text">
              На главную
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
