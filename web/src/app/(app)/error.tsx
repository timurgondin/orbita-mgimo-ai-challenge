"use client";

import { NoticeScreen } from "@/components/shell/notice-screen";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <NoticeScreen title="Что-то пошло не так" onRetry={reset} />;
}
