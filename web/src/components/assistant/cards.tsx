"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, MapPin, Video } from "lucide-react";
import { PersonAvatar } from "@/components/people/people-search";
import { ProgressBar } from "@/components/ui/progress";
import { TeacherAvatar } from "@/components/ui/teacher-avatar";
import type { Toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { AssistantCard } from "@/server/assistant/types";
import { signUp } from "@/server/consultations/actions";
import { createRequest } from "@/server/office/actions";

/** Карточки в ответе помощника: те же строки и цвета, что на экранах. Действия — через существующие серверные действия. */
export function ReplyCard({ card, toast }: { card: AssistantCard; toast: Toast }) {
  switch (card.kind) {
    case "lessons":
      return <Lessons card={card} />;
    case "grades":
      return <Grades card={card} />;
    case "tasks":
      return <Tasks card={card} />;
    case "request":
      return <Request card={card} toast={toast} />;
    case "consultations":
      return <Consultations card={card} toast={toast} />;
    case "people":
      return <People card={card} />;
    case "food":
      return <Food card={card} />;
  }
}

const box = "rounded-[20px] bg-s1 p-1.5 shadow-[inset_0_0_0_.5px_var(--line)]";
const row = "flex items-center gap-3.5 rounded-[14px] px-3 py-[11px]";
const dot = (color: string) => <i className="size-1.5 shrink-0 rounded-full" style={{ background: `var(--c-${color})` }} />;
const primary = "inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-text px-4 text-sm font-medium text-bg transition-[opacity,scale] duration-150 active:scale-[.97] disabled:opacity-50";

function Lessons({ card }: { card: Extract<AssistantCard, { kind: "lessons" }> }) {
  return (
    <div className={cn(box, "rows")} style={{ "--row-inset": "12px" } as React.CSSProperties}>
      {card.items.map((l) => (
        <div key={l.when + l.start} data-state={l.live ? "live" : undefined} className={cn(row, l.live && "bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]")}>
          <div className="w-12 shrink-0 text-[15px] font-medium tabular-nums">
            {l.start}
            <div className="text-xs font-normal text-text-3">{l.end}</div>
          </div>
          <div className="min-w-0 flex-1">
            <div className={cn("text-xs", l.live ? "text-accent" : "text-text-3")}>{l.when}</div>
            <div className="truncate text-[15px] font-medium">{l.title}</div>
          </div>
          {l.place && (
            <span className="flex shrink-0 items-center gap-1 text-sm text-text-2">
              <MapPin size={14} strokeWidth={1.6} className="text-text-3" />
              {l.place}
            </span>
          )}
          {l.teacher && <TeacherAvatar name={l.teacher} size={26} />}
        </div>
      ))}
    </div>
  );
}

function Grades({ card }: { card: Extract<AssistantCard, { kind: "grades" }> }) {
  return (
    <div className={cn(box, "p-4")}>
      <div className="flex items-baseline gap-2 px-1">
        <span className="text-[34px] leading-none font-medium tracking-[-.03em] tabular-nums">{card.average}</span>
        <span className="text-sm text-text-3">из 10</span>
        {card.rank && card.size && <span className="ml-auto text-sm text-text-2">{card.rank} место из {card.size}</span>}
      </div>
      <div className="mt-4 flex flex-col gap-3 px-1">
        {card.rows.map((r) => (
          <div key={r.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5">
            <span className="flex min-w-0 items-center gap-2 text-sm">
              {dot(r.color)}
              <span className="truncate">{r.title}</span>
            </span>
            <span className="text-sm font-medium tabular-nums">{r.value}</span>
            <ProgressBar value={r.fill} label={r.title} fill={`var(--c-${r.color})`} className="col-span-2 h-1" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Tasks({ card }: { card: Extract<AssistantCard, { kind: "tasks" }> }) {
  return (
    <div className={cn(box, "rows")} style={{ "--row-inset": "12px" } as React.CSSProperties}>
      {card.items.map((t) => (
        <Link key={t.id} href="/study?tab=tasks" className={cn(row, "transition-colors hover:bg-hover")}>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-medium">{t.title}</div>
            <div className="mt-0.5 flex items-center gap-2 text-[13px] text-text-3">
              {dot(t.color)}
              <span className="truncate">{t.course}</span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className={cn("text-sm font-medium", t.hot && "text-urgent")}>{t.due}</div>
            <div className="text-xs text-text-3">{t.note}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function Request({ card, toast }: { card: Extract<AssistantCard, { kind: "request" }>; toast: Toast }) {
  const [state, setState] = useState<"idle" | "sent" | "cancelled">("idle");
  const [number, setNumber] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const p = card.params;
  const fields = [
    ["Куда", p.purpose],
    ["Язык", p.lang],
    ["Формат", p.format],
    ["Срок", card.eta],
  ];

  const confirm = () =>
    start(async () => {
      const r = await createRequest(card.typeId, p);
      if (!r.ok) return toast(r.error, "error");
      setNumber(r.number ?? "");
      setState("sent");
      toast(r.message);
      router.refresh();
    });

  return (
    <div className={cn(box, "p-4", state === "cancelled" && "opacity-50")}>
      <div className="px-1 text-[17px] font-semibold tracking-[-.02em]">{card.title}</div>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 px-1 text-sm">
        {fields.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-text-3">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex items-center gap-2">
        {state === "idle" ? (
          <>
            <button type="button" onClick={confirm} disabled={pending} className={primary}>
              Подтвердить
            </button>
            <button
              type="button"
              onClick={() => setState("cancelled")}
              disabled={pending}
              className="h-9 rounded-full px-4 text-sm text-text-2 transition-colors hover:bg-hover hover:text-text"
            >
              Отмена
            </button>
          </>
        ) : state === "sent" ? (
          <>
            <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--st-green)_14%,transparent)] px-3.5 text-sm font-medium text-(--st-green)">
              <Check size={15} strokeWidth={1.8} />
              Заявка {number}
            </span>
            <Link href="/office" className="h-9 rounded-full px-4 text-sm leading-9 text-text-2 transition-colors hover:bg-hover hover:text-text">
              Открыть в Офисе
            </Link>
          </>
        ) : (
          <span className="px-1 text-sm text-text-3">Отменено</span>
        )}
      </div>
    </div>
  );
}

function Consultations({ card, toast }: { card: Extract<AssistantCard, { kind: "consultations" }>; toast: Toast }) {
  const [going, setGoing] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const router = useRouter();

  const book = (id: string) => {
    setBusyId(id);
    start(async () => {
      const r = await signUp(id);
      setBusyId(null);
      if (!r.ok) return toast(r.error, "error");
      setGoing(id);
      toast(r.message);
      router.refresh();
    });
  };

  return (
    <div className={cn(box, "rows")} style={{ "--row-inset": "12px" } as React.CSSProperties}>
      {card.items.map((c) => (
        <div key={c.id} className={cn(row, "flex-wrap gap-y-3")}>
          <div className="min-w-0 flex-1 basis-[220px]">
            <div className="text-[13px] text-text-3 tabular-nums">
              {c.day}, {c.start}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[15px] font-medium">
              {dot(c.color)}
              <span className="truncate">{c.courseTitle}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-text-3">
              <span className="flex items-center gap-1">
                {c.online ? <Video size={13} strokeWidth={1.6} /> : <MapPin size={13} strokeWidth={1.6} />}
                {c.place}
              </span>
              <span>
                Записались {c.count + (going === c.id ? 1 : 0)} из {c.capacity}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <TeacherAvatar name={c.teacher} size={26} gradient={c.teacherGradient} />
            {going === c.id ? (
              <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--st-green)_14%,transparent)] px-3.5 text-sm font-medium text-(--st-green)">
                <Check size={15} strokeWidth={1.8} />
                Вы идёте
              </span>
            ) : (
              <button type="button" onClick={() => book(c.id)} disabled={pending || going !== null} className={cn(primary, busyId === c.id && "opacity-50")}>
                Записаться
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function People({ card }: { card: Extract<AssistantCard, { kind: "people" }> }) {
  return (
    <div className={cn(box, "rows")} style={{ "--row-inset": "12px" } as React.CSSProperties} data-assistant-people>
      {card.items.map((p) => (
        <Link key={p.href} href={p.href} className={cn(row, "transition-colors duration-150 hover:bg-hover")}>
          <PersonAvatar p={p} size={32} />
          <span className="min-w-0 flex-1">
            <b className="block truncate text-[14.5px] font-medium">{p.name}</b>
            <small className="block truncate text-[13px] text-text-3">{p.sub}</small>
          </span>
          {p.tag && <span className="shrink-0 text-[13px] text-text-2 tabular-nums">{p.tag}</span>}
          <ChevronRight aria-hidden="true" size={16} strokeWidth={1.6} className="shrink-0 text-text-3" />
        </Link>
      ))}
    </div>
  );
}

function Food({ card }: { card: Extract<AssistantCard, { kind: "food" }> }) {
  return (
    <div className={cn(box, "rows")} style={{ "--row-inset": "12px" } as React.CSSProperties} data-assistant-food>
      {card.items.map((v) => (
        <Link key={v.slug} href={`/food?place=${v.slug}`} className={cn(row, "transition-colors duration-150 hover:bg-hover")}>
          {dot(v.color)}
          <span className="min-w-0 flex-1">
            <b className="block truncate text-[14.5px] font-medium">{v.name}</b>
            <small className="block truncate text-[13px] text-text-3">{v.note || v.place}</small>
          </span>
          <span className="shrink-0 text-[13px] text-text-2">{v.crowd.charAt(0).toUpperCase() + v.crowd.slice(1)}</span>
          <ChevronRight aria-hidden="true" size={16} strokeWidth={1.6} className="shrink-0 text-text-3" />
        </Link>
      ))}
    </div>
  );
}
