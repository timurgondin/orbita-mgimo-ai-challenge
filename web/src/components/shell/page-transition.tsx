"use client";

import { useEffect } from "react";

/**
 * Мягкий переход «вход → кабинет».
 * leavePage: страница растворяется (класс page-out на <html>), затем вызывается переход.
 * PageEnter (ставится в оболочку кабинета и онбординга): когда новая страница готова — проявляет её.
 * <html> живёт между клиентскими переходами, поэтому класс доезжает до новой страницы.
 */
const OUT_MS = 340;
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function leavePage(go: () => void) {
  if (reduced()) return go();
  const root = document.documentElement;
  root.classList.add("page-out");
  window.setTimeout(go, OUT_MS);
  // страховка: если новая страница так и не смонтировалась — вернуть видимость
  window.setTimeout(() => root.classList.remove("page-out"), 4000);
}

export function PageEnter() {
  useEffect(() => {
    const root = document.documentElement;
    if (!root.classList.contains("page-out")) return;
    root.classList.remove("page-out");
    root.classList.add("page-in");
    const t = window.setTimeout(() => root.classList.remove("page-in"), 900);
    return () => window.clearTimeout(t);
  }, []);
  return null;
}
