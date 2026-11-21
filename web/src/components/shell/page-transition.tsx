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

/**
 * Конец онбординга: кабинет «собирается» (класс arrive, стили — globals.css). Метку онбординг ставит перед переходом
 * в sessionStorage: редирект из server action перерисовывает <html>, и класс на нём не доживёт до новой страницы.
 */
const ARRIVE = "orbita-arrive";
export function arriveNext() {
  try {
    sessionStorage.setItem(ARRIVE, "1");
  } catch {}
}
/** Идёт переход из онбординга (метка ещё не снята): кабинет показывает «мост» — то же кольцо из точек. */
export function arrivePending() {
  try {
    return sessionStorage.getItem(ARRIVE) === "1";
  } catch {
    return false;
  }
}
function takeArrive() {
  try {
    const v = sessionStorage.getItem(ARRIVE);
    sessionStorage.removeItem(ARRIVE);
    return v === "1";
  } catch {
    return false;
  }
}

export function PageEnter() {
  useEffect(() => {
    const root = document.documentElement;
    if (takeArrive()) {
      root.classList.remove("page-out");
      root.classList.add("arrive");
      window.setTimeout(() => root.classList.remove("arrive"), 1700);
      return;
    }
    if (!root.classList.contains("page-out")) return;
    root.classList.remove("page-out");
    root.classList.add("page-in");
    // без отмены при размонтировании: иначе (двойной эффект в dev) класс остаётся, а filter на body
    // превращает его в контейнер для position: fixed — нижний док уезжает вниз страницы
    window.setTimeout(() => root.classList.remove("page-in"), 900);
  }, []);
  return null;
}
