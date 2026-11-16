"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { NewsItem, NotificationCenterData } from "@/server/data/types";
import { markSeen, resolveNotification } from "@/server/notifications/actions";
import { NoteAvatar, NoteRow, NoteSubtitle } from "./note-row";

/** Центр уведомлений: один источник, два входа — колокольчик и «Все» в «Новом». Правила — docs/notifications.md. */
type Ctx = { data: NotificationCenterData; open: () => void; resolve: (id: string) => void; resolving: string | null };
const CenterContext = createContext<Ctx | null>(null);

export function useNotifications(): Ctx {
  const ctx = useContext(CenterContext);
  if (!ctx) throw new Error("useNotifications: нет NotificationCenter выше по дереву");
  return ctx;
}

const TABS = [
  { id: "all", label: "Все" },
  { id: "study", label: "Учёба" },
  { id: "schedule", label: "Расписание" },
  { id: "office", label: "Офис" },
  { id: "announcement", label: "Объявления" },
] as const;
type Tab = (typeof TABS)[number]["id"];
// библиотека — часть учёбы; безопасность — только во «Всех»
const inTab = (n: NewsItem, tab: Tab) => tab === "all" || n.category === tab || (tab === "study" && n.category === "library");

export function NotificationCenter({ data, children }: { data: NotificationCenterData; children: React.ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [resolving, setResolving] = useState<string | null>(null);
  const [, start] = useTransition();
  const router = useRouter();
  const { toast, node } = useToast();

  const open = useCallback(() => {
    const unread = data.items.filter((i) => i.unread).map((i) => i.id);
    setFresh(new Set(unread)); // подсвечены до закрытия, хотя на сервере уже прочитаны
    setOpen(true);
    if (unread.length) start(() => markSeen());
  }, [data.items]);

  const close = useCallback(() => {
    setOpen(false);
    setFresh(new Set());
  }, []);

  const resolve = useCallback(
    (id: string) => {
      setResolving(id);
      start(async () => {
        const r = await resolveNotification(id);
        setResolving(null);
        toast(r.ok ? r.message : r.error, r.ok ? "ok" : "error");
        if (r.ok) router.refresh();
      });
    },
    [router, toast],
  );

  const value = useMemo(() => ({ data, open, resolve, resolving }), [data, open, resolve, resolving]);
  return (
    <CenterContext.Provider value={value}>
      {children}
      <Drawer open={isOpen} onClose={close} fresh={fresh} />
      {node}
    </CenterContext.Provider>
  );
}

/** Колокольчик: число — нерешённые «нужно действие», точка — непрочитанное важное. */
export function BellButton() {
  const { data, open } = useNotifications();
  const label = data.actions
    ? `Уведомления: нужно действие — ${data.actions}`
    : data.dot
      ? "Уведомления: есть новые"
      : "Уведомления";
  return (
    <button
      type="button"
      aria-label={label}
      aria-haspopup="dialog"
      onClick={open}
      data-bell={data.actions || (data.dot ? "dot" : "")}
      className="relative grid size-9 place-items-center rounded-full text-text-2 transition-[background,color] duration-150 hover:bg-hover hover:text-text"
    >
      <Bell size={16} strokeWidth={1.6} />
      {data.actions > 0 ? (
        <span className="absolute -top-px -right-px grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10.5px] leading-none font-semibold text-white tabular-nums shadow-[0_0_0_2px_var(--bg)]">
          {data.actions}
        </span>
      ) : (
        data.dot && <span className="absolute top-2 right-[9px] size-[7px] rounded-full bg-accent shadow-[0_0_0_2px_var(--bg)]" />
      )}
    </button>
  );
}

/** Карточка «нужно действие»: висит, пока не решено; действие — прямо здесь. */
export function ActionCard({ n, onNavigate, className, compact }: { n: NewsItem; onNavigate?: () => void; className?: string; compact?: boolean }) {
  const { resolve, resolving } = useNotifications();
  const btn =
    "inline-flex h-9 shrink-0 items-center rounded-[11px] bg-text px-3.5 text-[13.5px] font-semibold text-bg transition-[opacity,transform] duration-150 hover:opacity-90 active:scale-[.97] disabled:opacity-50";
  return (
    <div data-action-card={n.id} className={cn("flex items-center gap-3.5 rounded-[18px] bg-s1 px-4 py-3.5", className)}>
      <span className={cn(!compact && "max-sm:hidden")}>
        <NoteAvatar avatar={n.avatar} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-medium">{n.title}</div>
        {!compact && (
          <div className="mt-px text-sm text-text-3">
            <NoteSubtitle n={n} />
          </div>
        )}
        {n.due && <div className={cn("text-[13px]", compact ? "mt-px text-sm" : "mt-1", n.urgent ? "text-urgent" : "text-text-2")}>{n.due}</div>}
      </div>
      {n.action &&
        (n.action.kind === "resolve" ? (
          <button type="button" disabled={resolving === n.id} onClick={() => resolve(n.id)} className={btn}>
            {n.action.label}
          </button>
        ) : (
          <Link href={n.href ?? "#"} onClick={onNavigate} className={btn}>
            {n.action.label}
          </Link>
        ))}
    </div>
  );
}

function Drawer({ open, onClose, fresh }: { open: boolean; onClose: () => void; fresh: Set<string> }) {
  const { data } = useNotifications();
  const [tab, setTab] = useState<Tab>("all");
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus({ preventScroll: true });
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      if (e.key !== "Tab" || !panel.current) return;
      const f = [...panel.current.querySelectorAll<HTMLElement>("button:not([disabled]),a[href]")];
      if (!f.length) return;
      const [a, z] = [f[0], f[f.length - 1]];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      prev?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  const shown = data.items.filter((n) => inTab(n, tab));
  const pending = shown.filter((n) => n.pending);
  const groups = (["Сегодня", "Вчера", "Ранее"] as const)
    .map((g) => ({ g, list: shown.filter((n) => !n.pending && n.group === g) }))
    .filter((x) => x.list.length);
  const chip = "inline-flex h-8 shrink-0 items-center rounded-full px-3 text-[13.5px] font-medium transition-colors duration-150";

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className={cn(
          "fixed inset-0 z-40 bg-[rgba(10,10,12,.45)] backdrop-blur-[10px] backdrop-saturate-[1.2] transition-opacity duration-300 ease-soft",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Уведомления"
        aria-hidden={!open}
        inert={!open}
        className={cn(
          "fixed z-41 flex flex-col overflow-hidden bg-s2 shadow-[0_0_0_.5px_var(--line),0_40px_100px_-24px_rgba(0,0,0,.85)] transition-[transform,opacity] duration-[450ms,220ms] ease-[var(--spring),var(--ease)]",
          // компьютер: шторка справа; телефон: снизу почти на весь экран
          "top-3 right-3 bottom-3 w-[460px] rounded-[26px]",
          "max-sm:inset-x-0 max-sm:top-[6dvh] max-sm:right-0 max-sm:bottom-0 max-sm:w-auto max-sm:rounded-t-[28px] max-sm:rounded-b-none",
          open
            ? "translate-x-0 translate-y-0 opacity-100"
            : "pointer-events-none translate-x-[calc(100%+24px)] opacity-0 max-sm:translate-x-0 max-sm:translate-y-full",
        )}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="text-xl font-semibold tracking-[-.02em]">Уведомления</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="grid size-8 place-items-center rounded-full bg-s3 text-text transition-colors hover:bg-[color-mix(in_srgb,var(--text)_14%,var(--s3))]"
          >
            <X size={16} strokeWidth={1.6} />
          </button>
        </div>
        <div className="flex gap-1.5 overflow-x-auto px-6 pb-3 [scrollbar-width:none]" role="group" aria-label="Категория">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(chip, tab === t.id ? "bg-text text-bg" : "bg-s1 text-text-2 hover:text-text")}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 pt-2 pb-6 [scrollbar-width:thin]">
          {pending.length > 0 && (
            <section aria-label="Нужно действие" className="mb-6">
              <h3 className="mb-2.5 text-sm font-medium text-text-2">Нужно действие</h3>
              <div className="flex flex-col gap-2">
                {pending.map((n) => (
                  <ActionCard key={n.id} n={n} onNavigate={onClose} className="bg-s3/60" />
                ))}
              </div>
            </section>
          )}
          {groups.map(({ g, list }) => (
            <section key={g} aria-label={g} className="mb-5">
              <h3 className="mb-1 text-sm font-medium text-text-2">{g}</h3>
              <div className="rows [--row-inset:12px]">
                {list.map((n) => (
                  <NoteRow key={n.id} n={n} fresh={fresh.has(n.id)} onNavigate={onClose} />
                ))}
              </div>
            </section>
          ))}
          {!pending.length && !groups.length && <p className="pt-6 text-center text-[15px] text-text-3">Здесь пусто</p>}
        </div>
      </div>
    </>
  );
}
