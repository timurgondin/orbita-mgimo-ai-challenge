"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BedDouble, BookOpen, Building2, CalendarClock, Check, ChevronRight, Circle, Dumbbell, FileText, HeartPulse, Landmark, Laptop, Lightbulb, LoaderCircle,
  MessageCircleWarning, Search, ShieldCheck, Sparkles, UtensilsCrossed, VenetianMask, type LucideIcon,
} from "lucide-react";
import { Modal } from "@/components/time/modal";
import { Switch } from "@/components/profile/privacy";
import { useToast } from "@/components/ui/toast";
import { KINDS, RECTOR_OFFICE, STATUS, TEXT_MAX, TEXT_MIN, kindOf, type AppealKind } from "@/lib/appeals";
import { cn } from "@/lib/utils";
import { AVATAR_GRADIENTS } from "@/lib/user-view";
import { sendAppeal } from "@/server/appeals/actions";
import type { AppealTarget, AppealView, AppealsData } from "@/server/data/appeals";

const UNIT_ICONS: Record<string, LucideIcon> = {
  office: FileText, schedule: CalendarClock, library: BookOpen, campus: Building2, canteen: UtensilsCrossed,
  it: Laptop, dorm: BedDouble, security: ShieldCheck, sport: Dumbbell, medical: HeartPulse, rector: Landmark,
};
const KIND_ICONS: Record<AppealKind, LucideIcon> = { complaint: MessageCircleWarning, thanks: Sparkles, idea: Lightbulb };

const NONE: AppealTarget = { kind: "unit", id: "", name: "Университет в целом", line: RECTOR_OFFICE, icon: "rector" };
const isNone = (t: AppealTarget) => t.id === "";

const initialsOf = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .reverse()
    .join("")
    .toUpperCase();
const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е");

/** Лицо адресата: монограмма человека или значок службы. */
function Face({ t, size = 40 }: { t: { name: string; gradient?: string; icon?: string }; size?: number }) {
  if (t.icon) {
    const I = UNIT_ICONS[t.icon] ?? Building2;
    return (
      <span className="grid shrink-0 place-items-center rounded-full bg-s3 text-text-2" style={{ width: size, height: size }} aria-hidden="true">
        <I size={Math.round(size * 0.45)} strokeWidth={1.7} />
      </span>
    );
  }
  return (
    <span aria-hidden="true" className="mono grid shrink-0 place-items-center rounded-full font-semibold" style={{ width: size, height: size, fontSize: Math.round(size * 0.38), background: t.gradient ?? AVATAR_GRADIENTS.sand }}>
      {initialsOf(t.name)}
    </span>
  );
}

function KindIcon({ kind, size = 40 }: { kind: AppealKind; size?: number }) {
  const I = KIND_ICONS[kind];
  return (
    <span
      aria-hidden="true"
      style={{ "--c": kindOf(kind).color, width: size, height: size } as React.CSSProperties}
      className="grid shrink-0 place-items-center rounded-[12px] bg-[color-mix(in_srgb,var(--c)_14%,transparent)] text-(--c)"
    >
      <I size={Math.round(size * 0.48)} strokeWidth={1.8} />
    </span>
  );
}

function StatusTag({ status }: { status: AppealView["status"] }) {
  const s = STATUS[status];
  return (
    <span
      style={{ "--c": s.color } as React.CSSProperties}
      className="inline-flex h-6 shrink-0 items-center gap-[5px] rounded-full bg-[color-mix(in_srgb,var(--c)_13%,transparent)] px-[9px] text-[12.5px] font-medium whitespace-nowrap text-(--c)"
    >
      <i className="size-1.5 rounded-full bg-current" />
      {s.label}
    </span>
  );
}

const H2 = ({ children }: { children: React.ReactNode }) => <h2 className="mb-3.5 text-lg font-semibold tracking-[-.02em]">{children}</h2>;
const LABEL = "mb-2 block text-[13px] font-medium text-text-3";

export function AppealsView({ data }: { data: AppealsData }) {
  const { toast, node } = useToast();
  const [kind, setKind] = useState<AppealKind>("complaint");
  const [target, setTarget] = useState<AppealTarget | null>(null);
  const [text, setText] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();

  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState<AppealView | null>(null);
  const openAppeal = useCallback((a: AppealView) => {
    setShown(a);
    setOpen(true);
  }, []);

  // ?appeal=1037 — открыть обращение сразу (так ведёт уведомление об ответе); адрес чистим
  const params = useSearchParams();
  const router = useRouter();
  const wanted = params.get("appeal");
  useEffect(() => {
    if (!wanted) return;
    const a = data.appeals.find((x) => String(x.number) === wanted);
    if (a) requestAnimationFrame(() => openAppeal(a));
    router.replace("/redbutton", { scroll: false });
  }, [wanted, data.appeals, router, openAppeal]);

  const k = kindOf(kind);
  const ready = target && text.trim().length >= TEXT_MIN;

  const submit = () =>
    start(async () => {
      if (!target) return;
      const r = await sendAppeal({ kind, targetKind: isNone(target) ? "none" : target.kind, targetId: isNone(target) ? null : target.id, text, anonymous });
      if (!r.ok) return toast(r.error, "error");
      toast(`Обращение № ${r.number} у ректора`);
      setTarget(null);
      setText("");
      setAnonymous(false);
    });

  return (
    <>
      <h1 className="text-[34px] leading-[1.15] font-medium tracking-[-.03em] max-sm:text-[28px]">Красная кнопка</h1>

      <div className="mt-11 grid grid-cols-[1.25fr_1fr] items-start gap-12 max-[960px]:grid-cols-1 max-sm:mt-8">
        <section aria-label="Новое обращение" data-composer className="rounded-[26px] bg-s1 p-7 max-sm:-mx-1 max-sm:p-5">
          <div role="radiogroup" aria-label="Вид обращения" className="grid grid-cols-3 gap-2.5 max-[400px]:gap-2">
            {KINDS.map((x) => {
              const on = x.id === kind;
              return (
                <button
                  key={x.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  data-kind={x.id}
                  onClick={() => setKind(x.id)}
                  style={{ "--c": x.color } as React.CSSProperties}
                  className={cn(
                    "flex min-h-[92px] flex-col items-start justify-between gap-3 rounded-[18px] p-3.5 text-left transition-[background,box-shadow,transform] duration-300 ease-spring active:scale-[.97]",
                    on ? "bg-[color-mix(in_srgb,var(--c)_10%,var(--s2))] shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--c)_70%,transparent)]" : "bg-s2 hover:bg-s3",
                  )}
                >
                  <KindIcon kind={x.id} size={32} />
                  <b className="text-[14.5px] leading-tight font-semibold tracking-[-.01em]">
                    <span className="max-sm:hidden">{x.label}</span>
                    <span className="sm:hidden">{x.short}</span>
                  </b>
                </button>
              );
            })}
          </div>

          <div className="mt-6">
            <span className={LABEL} id="appeal-to">
              Кому
            </span>
            <button
              type="button"
              aria-labelledby="appeal-to"
              data-pick
              onClick={() => {
                setQ("");
                setPicking(true);
              }}
              className="flex min-h-[60px] w-full items-center gap-3 rounded-[16px] bg-s2 px-3.5 py-2.5 text-left transition-colors duration-150 hover:bg-s3"
            >
              {target ? (
                <>
                  <Face t={target} size={36} />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate font-medium" data-picked={target.id || "none"}>
                      {target.name}
                    </b>
                    <small className="block truncate text-[13px] text-text-3">{target.line}</small>
                  </span>
                </>
              ) : (
                <>
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-s3 text-text-3">
                    <Search size={16} strokeWidth={1.8} />
                  </span>
                  <span className="flex-1 text-text-3">Преподаватель, сотрудник или служба</span>
                </>
              )}
              <ChevronRight size={18} strokeWidth={1.6} className="shrink-0 text-text-3" />
            </button>
          </div>

          <label className="mt-5 block">
            <span className={LABEL}>{k.field}</span>
            <textarea
              data-text
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={TEXT_MAX}
              autoComplete="off"
              enterKeyHint="enter"
              className="block h-[168px] w-full resize-none rounded-[16px] bg-s2 px-4 py-3.5 text-[15px] leading-[1.5] text-text outline-none placeholder:text-text-3 focus:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_60%,transparent),0_0_0_4px_color-mix(in_srgb,var(--accent)_14%,transparent)]"
            />
          </label>

          <label className="mt-4 flex min-h-[56px] cursor-pointer items-center gap-3 rounded-[16px] px-0.5" data-author>
            {anonymous ? (
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-s3 text-text-2" aria-hidden="true">
                <VenetianMask size={18} strokeWidth={1.7} />
              </span>
            ) : data.me.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.me.photo} alt="" className="size-9 shrink-0 rounded-full object-cover" />
            ) : (
              <span aria-hidden="true" className="mono grid size-9 shrink-0 place-items-center rounded-full text-[13px] font-semibold" style={{ background: data.me.gradient }}>
                {data.me.initials}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <b className="block truncate font-medium">{anonymous ? "Анонимно" : data.me.name}</b>
              <small className="block truncate text-[13px] text-text-3">{anonymous ? "Имя скрыто от ректората" : data.me.line}</small>
            </span>
            <Switch on={anonymous} label="Анонимно" onClick={() => setAnonymous((v) => !v)} />
          </label>

          <button
            type="button"
            data-send
            disabled={!ready || pending}
            onClick={submit}
            className="mt-5 flex h-[54px] w-full items-center justify-center gap-2.5 rounded-[18px] bg-(--st-red) text-[15.5px] font-semibold text-bg shadow-[0_8px_24px_-10px_color-mix(in_srgb,var(--st-red)_70%,transparent)] transition-[opacity,transform,box-shadow] duration-200 ease-spring hover:opacity-92 active:scale-[.97] disabled:opacity-40 disabled:shadow-none"
          >
            {pending ? <LoaderCircle size={18} strokeWidth={2} className="animate-spin" /> : <span className="size-3 rounded-full bg-current opacity-80" aria-hidden="true" />}
            Отправить ректору
          </button>
        </section>

        <section aria-label="Мои обращения">
          <H2>Мои обращения</H2>
          {data.appeals.length ? (
            <div className="rows [--row-inset:14px]" data-appeals>
              {data.appeals.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  data-appeal={a.number}
                  data-status={a.status}
                  onClick={() => openAppeal(a)}
                  className="-mx-3.5 grid w-[calc(100%+28px)] grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl px-3.5 py-3 text-left transition-colors duration-150 hover:bg-hover max-sm:gap-3"
                >
                  <KindIcon kind={a.kind} />
                  <span className="min-w-0">
                    <b className="block truncate font-medium">{a.target.name}</b>
                    <small className="block truncate text-sm text-text-3">{a.text}</small>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <StatusTag status={a.status} />
                    <small className="text-[12.5px] text-text-3">{a.when}</small>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[15px] text-text-3">Обращений пока нет</p>
          )}
        </section>
      </div>

      <Picker
        open={picking}
        onClose={() => setPicking(false)}
        targets={data.targets}
        q={q}
        setQ={setQ}
        onPick={(t) => {
          setTarget(t);
          setPicking(false);
        }}
      />

      <Modal open={open} onClose={() => setOpen(false)} accent="var(--accent)" cover={false} title={shown ? `Обращение № ${shown.number}` : "Обращение"} width={520}>
        {shown && <AppealContent a={data.appeals.find((x) => x.id === shown.id) ?? shown} />}
      </Modal>
      {node}
    </>
  );
}

/** Выбор адресата: поиск по преподавателям, сотрудникам и службам; пустой поиск — мои преподаватели и службы. */
function Picker({ open, onClose, targets, q, setQ, onPick }: { open: boolean; onClose: () => void; targets: AppealTarget[]; q: string; setQ: (q: string) => void; onPick: (t: AppealTarget) => void }) {
  const query = useDeferredValue(norm(q.trim()));

  const groups = useMemo(() => {
    if (query) {
      const hit = targets.filter((t) => norm(`${t.name} ${t.line}`).includes(query));
      const by = (k: AppealTarget["kind"]) => hit.filter((t) => t.kind === k).slice(0, 12);
      return [
        { title: "Преподаватели", items: by("teacher") },
        { title: "Сотрудники", items: by("staff") },
        { title: "Службы", items: by("unit") },
      ].filter((g) => g.items.length);
    }
    const mine = targets.filter((t) => t.mine);
    return [
      { title: "", items: [NONE] },
      ...(mine.length ? [{ title: "Мои преподаватели", items: mine }] : []),
      { title: "Сотрудники", items: targets.filter((t) => t.kind === "staff") },
      { title: "Службы", items: targets.filter((t) => t.kind === "unit") },
    ];
  }, [query, targets]);

  return (
    <Modal open={open} onClose={onClose} accent="var(--accent)" cover={false} title="Кому" width={500} sheet="full">
      <h2 className="mb-4 text-[22px] font-semibold tracking-[-.025em]">Кому</h2>
      <div className="relative">
        <Search size={17} strokeWidth={1.8} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-text-3" />
        <input
          type="search"
          data-picker-search
          aria-label="Поиск"
          placeholder="Фамилия или служба"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          className="h-12 w-full rounded-[14px] bg-s3 pr-4 pl-10 text-[15px] text-text outline-none placeholder:text-text-3 focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_30%,transparent)]"
        />
      </div>
      <div className="mt-3 min-h-[320px]">
        {groups.length ? (
          groups.map((g) => (
            <div key={g.title || "top"} className="mt-3 first:mt-0">
              {g.title && <div className="px-0.5 pt-2 pb-1 text-[13px] font-medium text-text-3">{g.title}</div>}
              <div className="rows [--row-inset:12px]">
                {g.items.map((t) => (
                  <button
                    key={`${t.kind}:${t.id}`}
                    type="button"
                    data-target={t.id || "none"}
                    data-target-kind={t.kind}
                    onClick={() => onPick(t)}
                    className="-mx-3 flex w-[calc(100%+24px)] items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors duration-150 hover:bg-hover"
                  >
                    <Face t={t} size={36} />
                    <span className="min-w-0 flex-1">
                      <b className="block truncate font-medium">{t.name}</b>
                      <small className="block truncate text-[13px] text-text-3">{t.line}</small>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))
        ) : (
          <p className="px-0.5 pt-3 text-[15px] text-text-3">Никого не нашли</p>
        )}
      </div>
    </Modal>
  );
}

function AppealContent({ a }: { a: AppealView }) {
  const k = kindOf(a.kind);
  return (
    <div data-appeal-modal={a.number}>
      <div className="flex items-center gap-2 text-sm text-text-2">
        <span style={{ color: k.color }}>{k.label}</span>
        <span className="text-text-3">№ {a.number}</span>
      </div>
      <div className="mt-3 flex items-center gap-3 pr-10">
        <Face t={a.target} size={44} />
        <div className="min-w-0">
          <div className="text-[22px] leading-[1.2] font-semibold tracking-[-.025em]">{a.target.name}</div>
          {a.target.line && <div className="mt-0.5 truncate text-sm text-text-3">{a.target.line}</div>}
        </div>
      </div>
      <div className="mt-3.5 flex items-center gap-2">
        <StatusTag status={a.status} />
        {a.eta && <span className="text-sm text-text-3">{a.eta}</span>}
      </div>

      <blockquote className="mt-5 rounded-[16px] bg-s1 px-4 py-3.5 text-[15px] leading-[1.5] break-words whitespace-pre-wrap text-text-2">
        {a.text}
        {a.anonymous && (
          <span className="mt-2.5 flex items-center gap-1.5 text-[13px] text-text-3">
            <VenetianMask size={14} strokeWidth={1.8} />
            Анонимно
          </span>
        )}
      </blockquote>

      <div className="mt-[22px]">
        {a.steps.map((e, i) => (
          <div key={i} className="relative grid grid-cols-[24px_1fr_auto] gap-3.5 pb-[18px] last:pb-0" data-step={e.state}>
            {i < a.steps.length - 1 && <span className="absolute top-6 bottom-0.5 left-[11.5px] w-px bg-line" />}
            <span
              className={cn(
                "grid size-6 place-items-center rounded-full",
                e.state === "fin" ? "bg-text text-bg" : e.state === "cur" ? "bg-[color-mix(in_srgb,var(--st-blue)_20%,transparent)] text-(--st-blue)" : "bg-s3 text-text-3",
              )}
            >
              {e.state === "fin" ? <Check size={13} strokeWidth={2.4} /> : e.state === "cur" ? <LoaderCircle size={13} strokeWidth={2.4} /> : <Circle size={13} strokeWidth={2.4} />}
            </span>
            <div className="min-w-0">
              <b className={cn("block font-medium", e.state === "todo" && "text-text-3")}>{e.title}</b>
              {e.small && <small className="text-[13.5px] text-text-3">{e.small}</small>}
            </div>
            <span className="text-[13px] whitespace-nowrap text-text-3">{e.at}</span>
          </div>
        ))}
      </div>

      {a.answer && (
        <div className="mt-[22px] flex gap-3 rounded-[16px] bg-s1 px-4 py-3.5" data-answer>
          <Face t={{ name: a.answer.by, icon: "rector" }} size={32} />
          <div className="min-w-0 text-[15px] leading-[1.5]">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <b className="font-medium">{a.answer.by}</b>
              <small className="text-[13px] text-text-3">{a.answer.at}</small>
            </div>
            <p className="mt-1 break-words whitespace-pre-wrap text-text-2">{a.answer.text}</p>
          </div>
        </div>
      )}
    </div>
  );
}
