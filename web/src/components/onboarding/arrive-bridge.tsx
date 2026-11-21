"use client";

import { useSyncExternalStore } from "react";
import { arrivePending } from "@/components/shell/page-transition";
import { OrbitField } from "./orbit-field";

const noop = () => () => {};

/**
 * Заглушка кабинета (fallback Suspense в app/(app)/layout), пока сервер отдаёт «Сегодня».
 * Сразу после онбординга вместо пустого экрана — то же кольцо из точек в том же повороте;
 * когда кабинет готов, кольцо сменяется вспышкой (класс arrive). В остальных случаях — ничего.
 */
export function ArriveBridge() {
  const on = useSyncExternalStore(noop, arrivePending, () => false);
  if (!on) return null;
  return (
    <div className="fixed inset-0 z-40 bg-bg" aria-hidden="true">
      <OrbitField phase="gather" formed />
    </div>
  );
}
