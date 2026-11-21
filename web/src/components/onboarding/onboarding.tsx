"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PrefetchOptions } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { finishOnboarding } from "@/server/onboarding/actions";
import { BookOpen, ChevronLeft, DoorOpen, PackageOpen, Printer } from "lucide-react";
import { arriveNext } from "@/components/shell/page-transition";
import type { StudentCardView } from "@/server/data/types";
import { cn } from "@/lib/utils";
import { IdCard } from "./id-card";
import { OrbitField, type OrbitPhase } from "./orbit-field";
import { ContactsForm, DataReview, PhotoPicker, delay as d, primaryBtn as primary } from "./tasks";
import s from "./classes";

export interface OnboardingData {
  firstName: string;
  /** «Проверь свои данные»: [поле, значение]; поля совпадают с пунктами заявки «Исправление личных данных» */
  rows: [string, string][];
  program: string;
  group: string;
  phone: string | null;
  telegram: string | null;
  card: StudentCardView;
}

const STEPS = ["hello", "cohort", "data", "contacts", "photo", "card", "ready"] as const;
type Step = (typeof STEPS)[number];

const title = "text-[30px] leading-[1.12] font-medium tracking-[-.03em] max-sm:text-[26px]";


export function Onboarding({ data }: { data: OnboardingData }) {
  const [i, setI] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [launch, setLaunch] = useState(false);
  const [photo, setPhoto] = useState<string | null>(data.card.photo);
  const head = useRef<HTMLDivElement>(null);
  const step: Step = STEPS[i];

  const go = useCallback((to: number) => {
    setLeaving(true);
    setTimeout(() => {
      setI(to);
      setLeaving(false);
    }, 240);
  }, []);
  const next = useCallback(() => go(Math.min(i + 1, STEPS.length - 1)), [go, i]);

  // фокус — на заголовок нового шага (скринридер читает, клавиатура продолжает отсюда)
  useEffect(() => {
    if (i > 0) head.current?.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
  }, [i]);

  // «Открыть Орбиту»: текст растворяется, знак остаётся на месте — кабинет подхватит его «мостом» (arrive-bridge)
  const phase: OrbitPhase = step === "hello" || step === "ready" ? "gather" : "ambient";

  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-x-clip">
      <OrbitField phase={phase} />

      <header className={cn("relative z-10 mx-auto flex h-16 w-full max-w-[520px] items-center justify-between px-4 transition-opacity duration-300", launch && "opacity-0")}>
        <button
          type="button"
          onClick={() => go(i - 1)}
          aria-label="Назад"
          className={cn(
            "grid size-11 place-items-center rounded-full text-text-2 transition-[opacity,background-color] hover:bg-hover hover:text-text",
            (i === 0 || i === STEPS.length - 1) && "pointer-events-none opacity-0",
          )}
          tabIndex={i === 0 || i === STEPS.length - 1 ? -1 : 0}
        >
          <ChevronLeft size={22} strokeWidth={1.8} />
        </button>
        <div className={s.pager} role="img" aria-label={`Шаг ${i + 1} из ${STEPS.length}`}>
          {STEPS.map((id, k) => (
            <i key={id} data-on={k === i ? "" : undefined} data-done={k < i ? "" : undefined} />
          ))}
        </div>
        <span className="size-11" />
      </header>

      <div
        ref={head}
        key={step}
        className={cn(
          s.step,
          (leaving || launch) && s.leaving,
          launch && "ob-launch",
          "relative z-10 mx-auto flex w-full max-w-[460px] flex-1 flex-col px-7 pb-[max(24px,env(safe-area-inset-bottom))] sm:px-6",
          // на компьютере задачи — по центру экрана, кнопки сразу под содержимым
          step !== "hello" && step !== "ready" && "sm:justify-center sm:pb-16",
          // приветствие и финал: текст и кнопка не прижаты к нижнему краю
          (step === "hello" || step === "ready") && "sm:pb-[max(64px,11vh)]",
        )}
        data-step={step}
      >
        {step === "hello" && <Hello name={data.firstName} onNext={next} />}
        {step === "cohort" && <Cohort onNext={next} />}
        {step === "data" && <DataStep data={data} onNext={next} />}
        {step === "contacts" && <Contacts data={data} onNext={next} />}
        {step === "photo" && <PhotoStep card={data.card} photo={photo} onPhoto={setPhoto} onNext={next} />}
        {step === "card" && <CardStep data={data} photo={photo} onNext={next} />}
        {step === "ready" && <Ready onLaunch={() => setLaunch(true)} />}
      </div>
    </div>
  );
}

/* ---------- 1. Приветствие: точки собираются в знак, проявляется текст ---------- */
function Hello({ name, onNext }: { name: string; onNext: () => void }) {
  return (
    <>
      <div className="flex-1" />
      <div className="text-center">
        <h1 className={cn(s.serif, s.rise, "text-[46px] leading-[1.05] max-sm:text-[38px]")} style={d(1300)}>
          {name}, поздравляем
        </h1>
        <p className={cn(s.serif, s.rise, "mt-4 text-[22px] leading-[1.3] text-text-2 italic max-sm:text-[19px]")} style={d(1900)}>
          Теперь ты — часть Университета Будущего
        </p>
      </div>
      <div className={cn(s.rise, "mt-12")} style={d(2700)}>
        <button type="button" onClick={onNext} className={primary} autoFocus>
          Начать
        </button>
      </div>
    </>
  );
}

/* ---------- 2. Поток: числа считаются вверх ---------- */
function useCount(to: number, delay: number, ms = 1600) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const t0 = reduce ? -Infinity : performance.now() + delay;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - t0) / ms));
      setV(Math.round(to * (1 - Math.pow(1 - p, 4))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, delay, ms]);
  return v.toLocaleString("ru-RU");
}

function Cohort({ onNext }: { onNext: () => void }) {
  const total = useCount(1240, 300);
  const countries = useCount(38, 900, 1200);
  const teachers = useCount(212, 1100, 1200);
  return (
    <>
      <div className="flex flex-1 flex-col justify-center text-center sm:flex-none">
        <h1 tabIndex={-1} className="outline-none">
          <span className={cn(s.serif, s.rise, "block text-[104px] leading-none tabular-nums max-sm:text-[84px]")} style={d(100)}>
            {total}
          </span>
          <span className={cn(s.rise, "mt-3 block text-[19px] leading-[1.35] text-balance text-text-2 max-sm:text-[17px]")} style={d(500)}>
            первокурсников начинают путь вместе с тобой
          </span>
        </h1>
        <div className={cn(s.rise, "mt-12 grid grid-cols-2 gap-3")} style={d(900)}>
          {[
            [countries, "стран"],
            [teachers, "преподавателей"],
          ].map(([n, label]) => (
            <div key={label} className="rounded-[20px] bg-s1/80 px-4 py-5 backdrop-blur-md">
              <b className={cn(s.serif, "block text-[40px] leading-none tabular-nums")}>{n}</b>
              <span className="mt-2 block text-[14px] text-text-2">{label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className={cn(s.rise, "mt-10")} style={d(1500)}>
        <button type="button" onClick={onNext} className={primary}>
          Дальше
        </button>
      </div>
    </>
  );
}

/* ---------- 3–5. Задачи: данные, контакты, фото (сами формы — tasks.tsx) ---------- */
function DataStep({ data, onNext }: { data: OnboardingData; onNext: () => void }) {
  return (
    <>
      <h1 tabIndex={-1} className={cn(title, s.rise, "mt-4 outline-none")}>
        Проверь свои данные
      </h1>
      <DataReview rows={data.rows} layout="page" onDone={onNext} />
    </>
  );
}

function Contacts({ data, onNext }: { data: OnboardingData; onNext: () => void }) {
  return (
    <>
      <h1 tabIndex={-1} className={cn(title, s.rise, "mt-4 outline-none")}>
        Как с тобой связаться
      </h1>
      <ContactsForm phone={data.phone} telegram={data.telegram} layout="page" onDone={onNext} onSkip={onNext} />
    </>
  );
}

function PhotoStep({ card, photo, onPhoto, onNext }: { card: StudentCardView; photo: string | null; onPhoto: (url: string) => void; onNext: () => void }) {
  return (
    <>
      <h1 tabIndex={-1} className={cn(title, s.rise, "mt-4 text-center outline-none")}>
        Фото для Орбита ID
      </h1>
      <PhotoPicker initials={card.initials} background={card.avatar} photo={photo} layout="page" onPhoto={onPhoto} onDone={onNext} onSkip={onNext} />
    </>
  );
}

/* ---------- 6. Орбита ID ---------- */
const ROLES = [
  { icon: DoorOpen, label: "Пропуск в корпуса" },
  { icon: BookOpen, label: "Читательский билет" },
  { icon: PackageOpen, label: "Ячейка постамата" },
  { icon: Printer, label: "Печать и сканы" },
];

function CardStep({ data, photo, onNext }: { data: OnboardingData; photo: string | null; onNext: () => void }) {
  return (
    <>
      <h1 tabIndex={-1} className={cn(s.serif, s.rise, "mt-4 text-center text-[36px] leading-[1.1] outline-none max-sm:text-[31px]")}>
        Это твой Орбита ID
      </h1>
      <p className={cn(s.rise, "mt-2 text-center text-[16px] text-text-2")} style={d(150)}>
        Один код на весь университет
      </p>
      <div className="mt-9">
        <IdCard card={data.card} photo={photo} program={data.program} group={data.group} />
      </div>
      <ul className="mt-9 grid grid-cols-2 gap-2.5">
        {ROLES.map(({ icon: Icon, label }, n) => (
          <li
            key={label}
            className={cn(s.rise, "flex items-center gap-3 rounded-[16px] bg-s1/80 py-3.5 pr-4 pl-3.5 text-[14px] leading-tight backdrop-blur-md")}
            style={d(2300 + n * 140)}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-s2 text-(--accent)">
              <Icon size={18} strokeWidth={1.8} />
            </span>
            {label}
          </li>
        ))}
      </ul>
      <div className="min-h-8 flex-1 sm:flex-none" />
      <div className={s.rise} style={d(2900)}>
        <button type="button" onClick={onNext} className={primary}>
          Дальше
        </button>
      </div>
    </>
  );
}

/* ---------- 7. Готово: кольцо снова собирается, по кнопке разлетается — и открывается «Сегодня» ---------- */
function Ready({ onLaunch }: { onLaunch: () => void }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const ready = useRef<Promise<unknown> | null>(null);
  // Пока проявляется текст, онбординг отмечается пройденным и «Сегодня» загружается заранее (данные целиком)
  useEffect(() => {
    ready.current = finishOnboarding().then((r) => {
      if (r.ok) router.prefetch("/", { kind: "full" as PrefetchOptions["kind"] });
    });
  }, [router]);
  const go = async () => {
    setPending(true);
    onLaunch(); // текст уходит к зрителю и растворяется
    // переход начинается почти сразу, параллельно с анимацией: данные «Сегодня» (~0,3 с) приходят,
    // пока кольцо разлетается, и кабинет «собирается» без пустого экрана между ними
    await Promise.all([ready.current, new Promise((r) => setTimeout(r, 280))]);
    arriveNext();
    startTransition(() => router.push("/"));
  };
  return (
    <>
      <div className="flex-1" />
      <div className="text-center">
        <h1 tabIndex={-1} className={cn(s.serif, s.rise, "text-[44px] leading-[1.08] outline-none max-sm:text-[36px]")} style={d(700)}>
          Твоя Орбита готова
        </h1>
        <p className={cn(s.rise, "mt-4 text-[17px] leading-[1.4] text-balance text-text-2")} style={d(1100)}>
          Расписание, оценки, справки и библиотека — здесь
        </p>
      </div>
      <div className={cn(s.rise, "mt-12")} style={d(1500)}>
        <button type="button" onClick={go} disabled={pending} className={primary} data-finish>
          Открыть Орбиту
        </button>
      </div>
    </>
  );
}
