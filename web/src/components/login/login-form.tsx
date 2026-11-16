"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ChevronDown, CircleAlert, Eye, EyeOff, Stamp, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { ThinkingOrb } from "thinking-orbs";
import { loginAction, type LoginState } from "@/server/auth/actions";
import { leavePage } from "@/components/shell/page-transition";
import { cn } from "@/lib/utils";

const DEMO = [
  { login: "a.vorontsova", initials: "АВ", name: "Алиса Воронцова", sub: "Студентка 2 курса", bg: "linear-gradient(140deg,#D6C3AE,#8F7A68)" },
  { login: "m.orlov", initials: "МО", name: "Максим Орлов", sub: "Студент 4 курса", bg: "linear-gradient(140deg,#C9D3E6,#7F8BA6)" },
  { login: "n.lanskaya", initials: "НЛ", name: "Ника Ланская", sub: "Первокурсница", bg: "linear-gradient(140deg,#D9C2E4,#9878A8)" },
  { login: "e.petrova", initials: "ЕП", name: "Елена Петрова", sub: "Преподаватель", bg: "linear-gradient(140deg,#E7CDB4,#A88A70)" },
  { login: "office", initials: "", name: "Учебный офис", sub: "Сотрудник", bg: "" },
];
const DEMO_PASSWORD = "orbita-demo";

const INPUT =
  "h-[50px] w-full rounded-[14px] border-0 bg-s1 px-4 text-[15px] text-text outline-none shadow-[inset_0_0_0_1px_transparent] transition-[box-shadow,background] duration-200 ease-soft placeholder:text-text-3 hover:bg-s2 focus:bg-s1 focus:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_60%,transparent),0_0_0_4px_color-mix(in_srgb,var(--accent)_14%,transparent)] focus-visible:outline-none";
const INPUT_ERR = "shadow-[inset_0_0_0_1px_color-mix(in_srgb,#F58A8A_60%,transparent)]";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<LoginState | null>(null);
  const [flash, setFlash] = useState(0);
  const demoRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const busy = pending || !!state.to;

  useEffect(() => {
    const to = state.to;
    if (!to) return;
    router.prefetch(to);
    leavePage(() => router.replace(to));
  }, [state.to, router]);

  const error = state.error && dismissed !== state ? state.error : undefined;
  const hide = () => setDismissed(state);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!demoRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    const t = setTimeout(() => demoRef.current?.querySelector<HTMLElement>("[role=option]")?.focus({ preventScroll: true }), 200);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [open]);

  return (
    <div className="m-auto w-full max-w-[380px] max-[900px]:mx-auto max-[900px]:mb-0 max-[900px]:mt-0">
      <h2 className="text-[28px] font-medium tracking-[-.03em]">Вход</h2>

      <form action={action} className="mt-7 flex flex-col gap-3.5">
        <div>
          <label htmlFor="login" className="mb-[7px] block text-[13px] text-text-2">
            Логин
          </label>
          <input
            id="login"
            name="login"
            autoComplete="username"
            placeholder="i.familiya"
            spellCheck={false}
            maxLength={64}
            value={login}
            onChange={(e) => {
              setLogin(e.target.value);
              hide();
            }}
            key={`l${flash}`}
            className={cn(INPUT, error && INPUT_ERR, flash > 0 && "fill-flash")}
          />
        </div>
        <div>
          <label htmlFor="pass" className="mb-[7px] block text-[13px] text-text-2">
            Пароль
          </label>
          <div className="relative">
            <input
              id="pass"
              name="password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              maxLength={256}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                hide();
              }}
              key={`p${flash}`}
              className={cn(INPUT, "pr-12", error && INPUT_ERR, flash > 0 && "fill-flash")}
            />
            <button
              type="button"
              aria-label={show ? "Скрыть пароль" : "Показать пароль"}
              onClick={() => setShow((s) => !s)}
              className="absolute top-1/2 right-1.5 grid size-[38px] -translate-y-1/2 place-items-center rounded-[10px] text-text-3 hover:bg-hover hover:text-text"
            >
              {show ? <EyeOff size={16} strokeWidth={1.6} /> : <Eye size={16} strokeWidth={1.6} />}
            </button>
          </div>
        </div>
        <div className="-mt-0.5 flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-text-2">
            <input
              type="checkbox"
              name="remember"
              defaultChecked
              className="grid size-[18px] cursor-pointer appearance-none place-items-center rounded-md bg-s2 transition-colors checked:bg-text checked:after:h-[5px] checked:after:w-[9px] checked:after:translate-x-px checked:after:-translate-y-px checked:after:-rotate-45 checked:after:border-2 checked:after:border-t-0 checked:after:border-r-0 checked:after:border-bg checked:after:content-['']"
            />
            Запомнить меня
          </label>
          <a href="#" className="text-sm text-text-2 transition-colors hover:text-text">
            Забыли пароль?
          </a>
        </div>
        {error && (
          <div role="alert" className="flex items-center gap-2 text-sm text-[#F58A8A]">
            <CircleAlert size={16} strokeWidth={1.6} className="shrink-0" />
            {error}
          </div>
        )}
        <button
          ref={submitRef}
          type="submit"
          disabled={busy}
          aria-busy={busy}
          className="mt-2 flex h-[50px] items-center justify-center gap-2.5 rounded-[14px] bg-text text-[15px] font-semibold tracking-[-.01em] text-bg transition-[transform,opacity] duration-150 ease-soft hover:opacity-90 active:scale-[.985] disabled:pointer-events-none"
        >
          {busy ? (
            <>
              {/* светлая кнопка в тёмной теме → тёмные точки, и наоборот */}
              <ThinkingOrb state="connecting" size={20} theme={resolvedTheme === "light" ? "dark" : "light"} aria-hidden="true" />
              <span className="sr-only">Входим</span>
            </>
          ) : (
            "Войти"
          )}
        </button>
      </form>

      <div ref={demoRef} className="mt-3.5 flex flex-col items-center">
        <button
          ref={btnRef}
          type="button"
          aria-expanded={open}
          aria-controls="demoList"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm transition-[background,color] duration-150 hover:bg-hover hover:text-text",
            open ? "bg-hover text-text" : "text-text-2",
          )}
        >
          <UsersRound size={16} strokeWidth={1.6} />
          Демо-доступ
          <ChevronDown size={15} strokeWidth={1.6} className={cn("transition-transform duration-[350ms] ease-spring", open && "rotate-180")} />
        </button>
        <div
          id="demoList"
          role="listbox"
          aria-label="Демо-аккаунты"
          inert={!open}
          className={cn("grid w-full transition-[grid-template-rows] duration-[450ms] ease-soft", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}
        >
          <div className="min-h-0 overflow-hidden">
            <div
              className={cn(
                "mt-2 rounded-[18px] bg-s1 p-1.5 transition-[opacity,transform] duration-300 ease-soft",
                open ? "opacity-100" : "-translate-y-1.5 scale-[.98] opacity-0",
              )}
            >
              {DEMO.map((a) => (
                <button
                  key={a.login}
                  type="button"
                  role="option"
                  aria-selected={login === a.login}
                  onClick={() => {
                    setLogin(a.login);
                    setPassword(DEMO_PASSWORD);
                    setFlash((f) => f + 1);
                    hide();
                    setOpen(false);
                    submitRef.current?.focus();
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-hover focus-visible:bg-hover focus-visible:outline-none"
                >
                  <span
                    className={cn("grid size-[34px] shrink-0 place-items-center rounded-full text-xs font-semibold", a.bg ? "text-[#1d1d20]" : "bg-s3 text-text-2")}
                    style={a.bg ? { background: a.bg } : undefined}
                  >
                    {a.bg ? a.initials : <Stamp size={16} strokeWidth={1.6} />}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-[14.5px] font-medium">{a.name}</span>
                    <span className="text-[13px] text-text-3">{a.sub}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
