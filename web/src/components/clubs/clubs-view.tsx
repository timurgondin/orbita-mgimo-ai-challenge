"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock3, Mail, MapPin, Send, Sparkles, UsersRound } from "lucide-react";
import { Modal } from "@/components/time/modal";
import { useToast } from "@/components/ui/toast";
import { plural } from "@/lib/phrases";
import { cn } from "@/lib/utils";
import { joinClub, leaveClub } from "@/server/clubs/actions";
import type { ClubCategory, ClubView } from "@/server/data/types";

const CATS: { id: ClubCategory | "all"; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "sport", label: "Спорт" },
  { id: "mind", label: "Интеллект" },
  { id: "tech", label: "Технологии" },
  { id: "career", label: "Карьера" },
  { id: "creative", label: "Творчество" },
  { id: "community", label: "Сообщество" },
];
const CAT_LABEL = Object.fromEntries(CATS.map((c) => [c.id, c.label])) as Record<ClubCategory, string>;

const chip = (on: boolean) =>
  cn("h-9 rounded-xl px-3.5 text-sm font-medium whitespace-nowrap transition-colors duration-150", on ? "bg-text text-bg" : "bg-s1 text-text-2 hover:bg-s2 hover:text-text");
const BTN = "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-medium transition-[transform,opacity,background] duration-150 active:scale-[.97] disabled:opacity-40";
const members = (n: number) => `${n} ${plural(n, "участник", "участника", "участников")}`;

function Card({ c, onOpen }: { c: ClubView; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      data-club={c.slug}
      style={{ "--cc": `var(--c-${c.color})` } as React.CSSProperties}
      className="course-card flex flex-col overflow-hidden rounded-3xl bg-s1 text-left transition-colors duration-200 hover:bg-s2"
    >
      <div className="course-cover !h-[88px]">
        <span className="absolute top-4 left-5 text-xs font-medium text-[color-mix(in_srgb,var(--cc)_60%,var(--text))]">{CAT_LABEL[c.category]}</span>
        {c.mine && (
          <span className="absolute top-3.5 right-4 inline-flex items-center gap-1 rounded-full bg-black/25 px-2.5 py-1 text-xs font-medium text-white">
            {c.mine === "member" ? <Check size={12} strokeWidth={2.2} /> : <Clock3 size={12} strokeWidth={2} />}
            {c.mine === "member" ? "Вы в клубе" : "Заявка"}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col px-5 pt-4 pb-5">
        <b className="text-[17px] font-semibold tracking-[-.02em]">{c.title}</b>
        <span className="mt-0.5 text-sm text-text-2">{c.short}</span>
        <span className="mt-auto flex items-center justify-between gap-3 pt-4 text-[13px] text-text-3">
          <span className="inline-flex items-center gap-1.5">
            <Clock3 size={13} strokeWidth={1.7} />
            {c.schedule}
          </span>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <UsersRound size={13} strokeWidth={1.7} />
            {c.members}
          </span>
        </span>
      </div>
    </button>
  );
}

function ClubContent({ c, onDone }: { c: ClubView; onDone: (msg: string, ok: boolean) => void }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => ReturnType<typeof joinClub>) =>
    start(async () => {
      const r = await fn();
      onDone(r.ok ? r.message : r.error, r.ok);
      if (r.ok) router.refresh();
    });

  return (
    <>
      <div className="text-sm text-text-2">{CAT_LABEL[c.category]}</div>
      <div className="mt-1 text-[26px] leading-[1.15] font-semibold tracking-[-.03em]">{c.title}</div>
      <div className="mt-4 flex flex-col gap-3 text-[15px] text-text-2">
        {c.description.split("\n\n").map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
      {c.highlights.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1.5">
          {c.highlights.map((h) => (
            <li key={h} className="flex items-start gap-2.5 text-sm">
              <Sparkles size={15} strokeWidth={1.7} className="mt-0.5 shrink-0 text-(--cc)" />
              {h}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-text-2">
        <span className="inline-flex items-center gap-1.5">
          <Clock3 size={15} strokeWidth={1.6} className="text-text-3" />
          {c.schedule}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MapPin size={15} strokeWidth={1.6} className="text-text-3" />
          {c.place}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <UsersRound size={15} strokeWidth={1.6} className="text-text-3" />
          {members(c.members)}
        </span>
      </div>

      <section aria-label="Руководитель" data-leader className="mt-5 flex items-center gap-3.5 rounded-2xl bg-s3 px-3.5 py-3">
        <span className="mono grid size-10 shrink-0 place-items-center rounded-full text-[13px] font-semibold" style={{ background: c.leader.gradient }}>
          {c.leader.initials}
        </span>
        <span className="min-w-0 flex-1">
          <b className="block truncate font-medium">{c.leader.name}</b>
          <small className="text-[13px] text-text-3">{c.leader.role}</small>
        </span>
        <a
          href={`mailto:${c.leader.email}`}
          aria-label={`Написать ${c.leader.name}`}
          data-leader-mail
          className="inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-s2 px-3 text-[13px] font-medium hover:bg-s1"
        >
          <Mail size={14} strokeWidth={1.6} />
          Написать
        </a>
        <button
          type="button"
          aria-label={`Скопировать Telegram ${c.leader.name}`}
          title={`@${c.leader.telegram}`}
          data-leader-tg
          onClick={() => {
            navigator.clipboard?.writeText(`@${c.leader.telegram}`).catch(() => {});
            onDone(`Telegram @${c.leader.telegram} скопирован`, true);
          }}
          className="grid size-8 place-items-center rounded-[9px] bg-s2 text-text-2 hover:bg-s1 hover:text-text"
        >
          <Send size={15} strokeWidth={1.6} />
        </button>
      </section>

      <div className="mt-5">
        {c.mine === "member" ? (
          <div className="flex items-center gap-3">
            <span className="inline-flex flex-1 items-center gap-1.5 text-[15px] font-medium" style={{ color: "var(--st-green)" }}>
              <Check size={17} strokeWidth={2} />
              Вы в клубе
            </span>
            <button type="button" disabled={pending} onClick={() => run(() => leaveClub(c.id))} className={cn(BTN, "bg-s3 text-text-2 hover:text-text")} data-club-leave>
              Выйти
            </button>
          </div>
        ) : c.mine === "pending" ? (
          <div className="flex items-center gap-3">
            <span className="flex-1 text-sm text-text-2">Заявка у руководителя. Ответ придёт в Орбиту</span>
            <button type="button" disabled={pending} onClick={() => run(() => leaveClub(c.id))} className={cn(BTN, "bg-s3 text-text-2 hover:text-text")} data-club-leave>
              Отозвать
            </button>
          </div>
        ) : (
          <button type="button" disabled={pending} onClick={() => run(() => joinClub(c.id))} className={cn(BTN, "w-full bg-text text-bg")} data-club-join>
            {c.joinMode === "open" ? "Вступить" : "Отправить заявку"}
          </button>
        )}
      </div>
    </>
  );
}

export function ClubsView({ clubs }: { clubs: ClubView[] }) {
  const [cat, setCat] = useState<ClubCategory | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const { toast, node } = useToast();
  const mine = clubs.filter((c) => c.mine);
  const shown = clubs.filter((c) => cat === "all" || c.category === cat);
  const current = clubs.find((c) => c.id === openId);
  const show = (c: ClubView) => {
    setOpenId(c.id);
    setOpen(true);
  };

  return (
    <>
      <h1 className="text-[34px] leading-[1.15] font-medium tracking-[-.03em] max-sm:text-[28px]">Клубы</h1>

      {mine.length > 0 && (
        <section aria-label="Мои клубы" className="mt-9">
          <h2 className="mb-2 text-lg font-semibold tracking-[-.02em]">Мои клубы</h2>
          <div className="rows [--row-inset:14px]">
            {mine.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => show(c)}
                data-my-club={c.slug}
                style={{ "--cc": `var(--c-${c.color})` } as React.CSSProperties}
                className="-mx-3.5 grid w-[calc(100%+28px)] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl px-3.5 py-3 text-left transition-colors duration-150 hover:bg-hover"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2.5 font-medium">
                    <i className="size-2 shrink-0 rounded-full bg-(--cc)" />
                    <span className="truncate">{c.title}</span>
                  </span>
                  <span className="mt-px ml-[18px] block text-[13px] text-text-3">
                    {c.schedule}, {c.place.charAt(0).toLowerCase() + c.place.slice(1)}
                  </span>
                </span>
                <span className="text-right text-[13px] whitespace-nowrap text-text-3">{c.mine === "member" ? members(c.members) : "заявка у руководителя"}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section aria-label="Все клубы" className="mt-12">
        <div className="-mx-5 mb-6 flex gap-1.5 overflow-x-auto px-5 [scrollbar-width:none]" role="group" aria-label="Направление">
          {CATS.map((c) => (
            <button key={c.id} type="button" aria-pressed={cat === c.id} onClick={() => setCat(c.id)} className={chip(cat === c.id)}>
              {c.label}
            </button>
          ))}
        </div>
        <div key={cat} className="view-in grid grid-cols-3 gap-4 max-[1000px]:grid-cols-2 max-[640px]:grid-cols-1">
          {shown.map((c) => (
            <Card key={c.id} c={c} onOpen={() => show(c)} />
          ))}
        </div>
      </section>

      <Modal open={open} onClose={close} accent={`var(--c-${current?.color ?? "econ"})`} title={current?.title ?? "Клуб"} width={540}>
        {current && (
          <ClubContent
            key={current.id + (current.mine ?? "")}
            c={current}
            onDone={(msg, ok) => {
              toast(msg, ok ? "ok" : "error");
            }}
          />
        )}
      </Modal>
      {node}
    </>
  );
}
